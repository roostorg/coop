# Local Development Guide

This guide covers configuration details and troubleshooting for local development. For the quickstart, see the [root README](../README.md).

## Prerequisites

- **Operating System**: macOS, Linux, or Windows with WSL2
- **Node.js 24** (use `nvm install && nvm use` so local matches `.nvmrc`)
- **pnpm 10** (`npm install -g pnpm@10` or `corepack enable`)
- **Docker and Docker Compose**
- **16 GB RAM** or more recommended

## Environment Setup

### Server Configuration

Copy `server/.env.example` to `server/.env`. The example file contains all available options with documentation. Key sections:

- **Database connections**: PostgreSQL, ClickHouse, ScyllaDB, Redis
- **External APIs**: OpenAI, SendGrid, Google APIs (optional)
- **Security**: Session secrets, JWT signing keys

The default values work with Docker Compose services out of the box.

### Client Configuration

Copy `client/.env.example` to `client/.env`. Defaults work for local development.

## Docker Services

Start all backing services:

```bash
pnpm run up
```

This starts:

Service         | Port       | Notes         
----------------|------------|---------------------------------
PostgreSQL      | 5432       | Primary DB (with pgvector) 
ClickHouse      | 8123, 9000 | Analytics warehouse 
ScyllaDB        | 9042       | Item submission history 
Redis           | 6379       | Caching and job queues
Jaeger          | 16686      | Tracing UI (opens automatically)
OTEL Collector  | 4317       | Telemetry collection 

Check service health:

```bash
docker ps
docker logs <container-name>
```

Stop services:

```bash
pnpm run down
```

## Database Operations

### Running Migrations

```bash
pnpm run db:update -- --env staging --db api-server-pg
pnpm run db:update -- --env staging --db clickhouse
#Creating keyspace
pnpm run db:create -- --env staging --db scylla
#Running migrations
pnpm run db:update -- --env staging --db scylla
```

### Other Commands

```bash
pnpm run db:add -- --name <migration-name> --db api-server-pg
pnpm run db:clean    # Drop and recreate (destructive)
pnpm run db:create   # Create database
pnpm run db:drop     # Drop database
```

### Migration Locations

```
db/src/scripts/
├── api-server-pg/    # PostgreSQL
├── clickhouse/       # ClickHouse
└── scylla/           # ScyllaDB
```

## Running the Application

### All Services Together

```bash
pnpm run start       # Client + server + GraphQL codegen (opens browser)
pnpm run compile     # Same, without opening browser
```

### Individual Services (Recommended for Debugging)

```bash
# Terminal 1
pnpm run client:start

# Terminal 2
pnpm run server:start

# Terminal 3 (optional, for GraphQL schema changes)
pnpm run generate:watch
```

### Background Workers

Item submissions are processed asynchronously via a BullMQ worker that consumes from Redis. To process items locally, run the worker in a separate terminal:

```bash
cd server
pnpm run runWorkerOrJob ItemProcessingWorker
```

Without this running, submitted items will be enqueued in Redis but not processed. Other available workers/jobs can be found in `server/iocContainer/services/workersAndJobs.ts`.

### With Distributed Tracing

```bash
cd server && pnpm run start:trace
```

View traces at http://localhost:16686

### Access Points

Service    | URL 
-----------|------------------------------
Client     | http://localhost:3000 
API Server | http://localhost:8080 
GraphQL    | http://localhost:8080/graphql 
Jaeger UI  | http://localhost:16686 

## Testing

```bash
# Server
cd server
pnpm run test              # Watch mode
pnpm run test:prepush      # Single run
pnpm run test:integ        # Integration tests

# Client
cd client
pnpm run test              # Watch mode
pnpm run test:prepush      # Single run

# Full validation (run before pushing)
pnpm run check:prepush
```

## GraphQL Development

Coop uses schema-first GraphQL with bidirectional code generation.

```bash
pnpm run generate          # One-time
pnpm run generate:watch    # Watch mode
```

Generated files:
- `client/src/graphql/generated.ts`
- `server/graphql/generated.ts`

Schema changes trigger recompilation of both client and server. If you experience regeneration loops, stop watch mode and run manually.

## HMA Development
HMA is not started automatically with `pnpm run up`. Start it separately if you're doing hash matching: `docker compose up --build -d hma`

HMA is pre-configured in `server/.env` with `HMA_SERVICE_URL=http://localhost:9876`. No additional environment setup is needed for local development.

### Image URL Accessibility
When submitting items to Coop, image URLs must be reachable by the HMA Docker container and not just your browser or the Node.js server. 
HMA fetches the image itself to compute the hash. This means localhost URLs will silently fail: HMA will return empty hashes, the image similarity signal will not evaluate, and no rule will fire.

For local development, if you're serving images from your host machine, add the following to /etc/hosts:

127.0.0.1 host.docker.internal

Then use `host.docker.internal:<port>` in image URLs when submitting items. This URL resolves correctly from both the browser and inside Docker.

## Troubleshooting

### ScyllaDB Not Ready

ScyllaDB takes 30-60 seconds to initialize. If migrations fail immediately after `pnpm run up`, wait and retry.

### ClickHouse Migration Fails

Ensure `CLICKHOUSE_USERNAME` and `CLICKHOUSE_PASSWORD` are set in your `.env`.

### Port Conflicts

```bash
lsof -i :3000    # Client
lsof -i :8080    # Server
lsof -i :5432    # PostgreSQL
```

### Reset Everything

```bash
pnpm run down
docker volume prune    # Warning: removes all Docker volumes
pnpm run up
pnpm run db:update -- --env staging --db api-server-pg
pnpm run db:update -- --env staging --db clickhouse
pnpm run create-org
```

### Connecting to Databases Directly

```bash
# PostgreSQL
psql -h localhost -U postgres -d postgres
# Password: postgres123

# ClickHouse
clickhouse-client --host localhost --user default --password clickhouse

# Redis
redis-cli
```

## Code Quality

```bash
pnpm run lint       # ESLint across all workspace packages
pnpm run format     # Prettier
pnpm run check:prepush    # Run before pushing
```
