# Data Warehouse Abstraction Layer

## Overview

The data warehouse abstraction decouples analytics writes from a specific backend. Coop ships with **ClickHouse** and **PostgreSQL** adapters; the `IDataWarehouse` interface can be implemented to support additional backends. Define your warehouse settings by changing one environment variable.

## Quick start

```typescript
import { inject, type Dependencies } from '../iocContainer/index.js';

class MyService {
  constructor(private readonly dataWarehouse: Dependencies['DataWarehouse']) {}

  async getUserData(userId: string, tracer: SafeTracer) {
    return this.dataWarehouse.query(
      'SELECT * FROM users WHERE id = :1',
      tracer,
      [userId],
    );
  }
}

export default inject(['DataWarehouse'], MyService);
```

## Configuration

Select the engine with `ANALYTICS_DIALECT` (`clickhouse`, `postgres`, or `noop`; defaults to `clickhouse`). It controls both reads and writes. `ANALYTICS_ADAPTER=noop` disables analytics writes while keeping reads; it cannot select a different engine than `ANALYTICS_DIALECT`.

`WAREHOUSE_ADAPTER` and `DATA_WAREHOUSE_PROVIDER` are deprecated and only read when `ANALYTICS_DIALECT` is unset.

### PostgreSQL

Analytics can share the app database or use a separate Postgres server. Either way it gets its own connection pool.

```sh
ANALYTICS_DIALECT=postgres

# Same database as the app: leave ANALYTICS_DB_HOST unset and the connection
# comes from DATABASE_*.

# Separate database: set ANALYTICS_DB_HOST, and every field is then read from
# ANALYTICS_DB_* (nothing falls back to DATABASE_*).
ANALYTICS_DB_HOST=analytics-db.internal
ANALYTICS_DB_PORT=5432
ANALYTICS_DB_NAME=analytics
ANALYTICS_DB_USER=coop_analytics
ANALYTICS_DB_PASSWORD=password
# ANALYTICS_DB_SSL=true

# Pool size (default 5) and optional server-side statement timeout.
# ANALYTICS_DB_POOL_MAX=5
# ANALYTICS_DB_STATEMENT_TIMEOUT_MS=60000
```

Raw `DataWarehouse.query` statements on Postgres use `$1, $2, ...` placeholders.

### ClickHouse

```sh
ANALYTICS_DIALECT=clickhouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=password
CLICKHOUSE_DATABASE=analytics
CLICKHOUSE_PROTOCOL=http

# Disable analytics writes (while keeping the warehouse)
# ANALYTICS_ADAPTER=noop
```

## How it works

### Three interfaces

**1. IDataWarehouse** - Raw SQL queries

```typescript
await dataWarehouse.query('SELECT * FROM users', tracer);
await dataWarehouse.transaction(async (query) => {
  await query('UPDATE users SET score = :1', [100]);
  await query('INSERT INTO audit_log VALUES (:1)', [userId]);
});
```

**2. IDataWarehouseDialect** - Type-safe Kysely queries

```typescript
const kysely = dialect.getKyselyInstance();
await kysely.selectFrom('users').selectAll().execute();
```

**3. IDataWarehouseAnalytics** - Bulk writes & logging

```typescript
await analytics.bulkWrite('RULE_EXECUTIONS', [
  { ds: '2024-01-01', ts: Date.now(), org_id: 'org1', ... }
]);
```

### How loggers work

**All analytics loggers use the abstraction:**

```typescript
// server/services/analyticsLoggers/RuleExecutionLogger.ts
class RuleExecutionLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}

  async logRuleExecutions(executions: any[]) {
    await this.analytics.bulkWrite('RULE_EXECUTIONS', executions);
  }
}

export default inject(['DataWarehouseAnalytics'], RuleExecutionLogger);
```

**What happens:**

1. Service calls `logger.logRuleExecutions(data)`
2. Logger calls `analytics.bulkWrite('RULE_EXECUTIONS', data)`
3. For **ClickHouse**: Chunked JSONEachRow inserts over HTTP (default batches of 500 rows)
4. For **PostgreSQL**: Buffers → COPY or batch INSERT

**No warehouse-specific code in loggers!** They just call `bulkWrite()`.

### Data flow

#### Clickhouse / PostgreSQL (direct)

```
RuleExecutionLogger
    ↓
DataWarehouseAnalytics.bulkWrite()
    ↓
ClickhouseAnalyticsAdapter / PostgresAnalyticsAdapter
    ↓
HTTP JSONEachRow (Clickhouse) or batched INSERT (PostgreSQL)
    ↓
Analytics tables
```

## Required tables

All warehouses need these tables. Schema types defined in `/server/storage/dataWarehouse/IDataWarehouseAnalytics.ts`.

**Core tables:**

- `RULE_EXECUTIONS` - Rule evaluation logs
- `ACTION_EXECUTIONS` - Moderation action logs
- `ITEM_MODEL_SCORES_LOG` - ML model prediction logs
- `CONTENT_API_REQUESTS` - API request logs

ClickHouse DDL lives alongside the rest of our migrations at `db/src/scripts/clickhouse/`. Add new files there when the schema evolves.

**Migration examples:**

### ClickHouse

```sql
CREATE TABLE rule_executions (
  ds Date,
  ts UInt64,
  org_id String,
  rule_id String,
  passed UInt8,
  result String,  -- JSON as string
  -- ... ~20 more fields
) ENGINE = MergeTree()
PARTITION BY ds
ORDER BY (ds, ts, org_id);
```

### PostgreSQL

```sql
CREATE TABLE rule_executions (
  ds DATE,
  ts BIGINT,
  org_id VARCHAR(255),
  rule_id VARCHAR(255),
  passed BOOLEAN,
  result JSONB,
  -- ... ~20 more fields
) PARTITION BY RANGE (ds);
```

**Full schema:** See `/server/storage/dataWarehouse/IDataWarehouseAnalytics.ts` lines 23-140.

## Implementing a custom warehouse

### Step 1: Implement an `IWarehouseAdapter` plugin

Create a warehouse adapter under `server/plugins/warehouse/adapters`:

```typescript
// server/plugins/warehouse/adapters/MyWarehouseAdapter.ts
import type SafeTracer from '../../../utils/SafeTracer.js';
import type { IWarehouseAdapter } from '../IWarehouseAdapter.js';
import {
  type WarehouseQueryFn,
  type WarehouseQueryResult,
  type WarehouseTransactionFn,
} from '../types.js';

export class MyWarehouseAdapter implements IWarehouseAdapter {
  readonly name = 'my-warehouse';

  constructor(
    private readonly client: SomeWarehouseClient,
    private readonly tracer?: SafeTracer,
  ) {}

  start(): void {
    // Optional: warm up connection pools
  }

  async query<T = WarehouseQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const execute = async () => {
      const rows = await this.client.execute(sql, params);
      return rows as readonly T[];
    };

    return this.tracer
      ? (this.tracer.addActiveSpan(
          { resource: 'my-warehouse.query', operation: 'query' },
          execute,
        ) as Promise<readonly T[]>)
      : execute();
  }

  async transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T> {
    return this.client.transaction(async () =>
      fn((statement, parameters) => this.query(statement, parameters)),
    );
  }

  async flush(): Promise<void> {}

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

### Step 2: Provide a `IDataWarehouseDialect` (Kysely) implementation

If you need type-safe queries, create a dialect wrapper (see `ClickhouseKyselyAdapter` for a concrete example) and return it from `DataWarehouseFactory.createKyselyDialect`.

### Step 3: Implement an `IAnalyticsAdapter` plugin

Analytics adapters live under `server/plugins/analytics/adapters` and implement bulk writes plus optional CDC:

```typescript
// server/plugins/analytics/adapters/MyAnalyticsAdapter.ts
import type { IAnalyticsAdapter } from '../IAnalyticsAdapter.js';
import {
  type AnalyticsEventInput,
  type AnalyticsQueryResult,
  type AnalyticsWriteOptions,
} from '../types.js';

export class MyAnalyticsAdapter implements IAnalyticsAdapter {
  readonly name = 'my-analytics';

  constructor(private readonly client: SomeWarehouseClient) {}

  async writeEvents(
    table: string,
    events: readonly AnalyticsEventInput[],
    _options?: AnalyticsWriteOptions,
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.client.insert(table, events);
  }

  async query<T = AnalyticsQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    return (await this.client.query(sql, params)) as readonly T[];
  }

  async flush(): Promise<void> {}

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

### Step 4: Register the provider in `DataWarehouseFactory`

Update `DataWarehouseFactory.createDataWarehouse`, `createKyselyDialect`, and `createAnalyticsAdapter` to instantiate your plugins. The factory wraps them in bridges so the rest of the application only speaks the generic interfaces.

### Step 5: Create analytics tables

All warehouses need the same tables (schema in `IDataWarehouseAnalytics.ts`):

```sql
-- Adapt syntax for your warehouse
CREATE TABLE rule_executions (
  ds DATE,
  ts BIGINT,
  org_id VARCHAR,
  item_id VARCHAR,
  rule_id VARCHAR,
  passed BOOLEAN,
  result JSON,  -- Or JSONB, String depending on warehouse
  -- ... see IDataWarehouseAnalytics.ts for all ~20 fields
);
```

### Step 6: Configure and run

```sh
export WAREHOUSE_ADAPTER=your-warehouse
# Optional overrides
# export ANALYTICS_ADAPTER=your-warehouse
# Legacy fallback:
# export DATA_WAREHOUSE_PROVIDER=your-warehouse
export YOUR_WAREHOUSE_HOST=localhost
# ... other config vars

pnpm start
```

## How services consume analytics data

Services query analytics data using `DataWarehouseDialect`:

```typescript
// server/services/analyticsQueries/UserHistoryQueries.ts
class UserHistoryQueries {
  constructor(private readonly dialect: Dependencies['DataWarehouseDialect']) {}

  async getUserRuleExecutionsHistory(orgId: string, userId: string) {
    const kysely = this.dialect.getKyselyInstance();

    return kysely
      .selectFrom('RULE_EXECUTIONS')
      .where('ORG_ID', '=', orgId)
      .where('ITEM_CREATOR_ID', '=', userId)
      .selectAll()
      .execute();
  }
}

export default inject(['DataWarehouseDialect'], UserHistoryQueries);
```

**Works with any supported warehouse:**

- Clickhouse: Uses ClickhouseDialect
- PostgreSQL: Uses PostgresDialect

## Available IOC Services

| Service                  | Type                      | Purpose               |
| ------------------------ | ------------------------- | --------------------- |
| `DataWarehouse`          | `IDataWarehouse`          | Raw SQL, transactions |
| `DataWarehouseDialect`   | `IDataWarehouseDialect`   | Type-safe queries     |
| `DataWarehouseAnalytics` | `IDataWarehouseAnalytics` | Bulk writes, logging  |

## File Structure

```
server/storage/dataWarehouse/
├── IDataWarehouse.ts              # Core interface
├── IDataWarehouseAnalytics.ts     # Analytics interface + schema types
├── DataWarehouseFactory.ts        # Instantiates adapters via env configuration
├── ClickhouseAdapter.ts           # 📝 Stub - implement this
├── ClickhouseAnalyticsAdapter.ts  # 📝 Stub - implement this
├── PostgresAnalyticsAdapter.ts    # 📝 Stub - implement this
└── index.ts

server/plugins/warehouse/           # Pluggable warehouse adapters
├── examples/NoOpWarehouseAdapter.ts
└── ...

server/plugins/analytics/           # Pluggable analytics adapters
├── examples/NoOpAnalyticsAdapter.ts
└── ...

server/services/analyticsLoggers/   # Warehouse-agnostic loggers
├── RuleExecutionLogger.ts         # Uses DataWarehouseAnalytics
├── ActionExecutionLogger.ts       # Uses DataWarehouseAnalytics
├── ItemModelScoreLogger.ts        # Uses DataWarehouseAnalytics
└── ...

server/services/analyticsQueries/   # Warehouse-agnostic queries
├── UserHistoryQueries.ts          # Uses DataWarehouseDialect
├── ItemHistoryQueries.ts          # Uses DataWarehouseDialect
└── ...
```

## References

- **Schema types:** `/server/storage/dataWarehouse/IDataWarehouseAnalytics.ts`
- **ClickHouse:** `server/plugins/warehouse` and `server/plugins/analytics` adapters
- **PostgreSQL migrations:** `db/src/scripts/api-server-pg/` (app DB); analytics tables may live in a dedicated analytics database per deployment
- **Loggers:** `/server/services/analyticsLoggers/`
- **Queries:** `/server/services/analyticsQueries/`
