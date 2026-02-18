# Local Development Guide

This guide covers configuration details and troubleshooting for local development. For the quickstart, see the [root README](../README.md).

## Prerequisites

- **Operating System**: macOS, Linux, or Windows with WSL2
- **Node.js 24** (use `nvm install && nvm use` so local matches `.nvmrc`)
- **npm** (included with Node.js)
- **Docker and Docker Compose**
- **16 GB RAM** or more recommended

## Environment Setup

### Server Configuration

Copy `server/.env.example` to `server/.env`. The example file contains all available options with documentation. Key sections:

- **Database connections**: PostgreSQL, ClickHouse, ScyllaDB, Redis
- **Kafka**: Broker and schema registry settings
- **External APIs**: OpenAI, SendGrid, Google APIs (optional)
- **Security**: Session secrets, JWT signing keys

The default values work with Docker Compose services out of the box.

### Client Configuration

Copy `client/.env.example` to `client/.env`. Defaults work for local development.

## Docker Services

Start all backing services:

```bash
npm run up
```

This starts:

Service         | Port       | Notes         
----------------|------------|---------------------------------
PostgreSQL      | 5432       | Primary DB (with pgvector) 
ClickHouse      | 8123, 9000 | Analytics warehouse 
ScyllaDB        | 9042       | Item submission history 
Redis           | 6379       | Caching and job queues 
Kafka           | 29092      | Event streaming 
Schema Registry | 8081       | Kafka schemas 
Zookeeper       | 22181      | Kafka coordination 
Jaeger          | 16686      | Tracing UI (opens automatically) 
OTEL Collector  | 4317       | Telemetry collection 

Check service health:

```bash
docker ps
docker logs <container-name>
```

Stop services:

```bash
npm run down
```

## Database Operations

### Running Migrations

```bash
npm run db:update -- --env staging --db api-server-pg
npm run db:update -- --env staging --db clickhouse
#Creating keyspace
npm run db:create -- --env staging --db scylla
#Running migrations
npm run db:update -- --env staging --db scylla
```

### Other Commands

```bash
npm run db:add -- --name <migration-name> --db api-server-pg
npm run db:clean    # Drop and recreate (destructive)
npm run db:create   # Create database
npm run db:drop     # Drop database
```

### Migration Locations

```
.devops/migrator/src/scripts/
├── api-server-pg/    # PostgreSQL
├── clickhouse/       # ClickHouse
├── scylla/           # ScyllaDB
└── snowflake/        # Snowflake (optional)
```

## Running the Application

### All Services Together

```bash
npm run start       # Client + server + GraphQL codegen (opens browser)
npm run compile     # Same, without opening browser
```

### Individual Services (Recommended for Debugging)

```bash
# Terminal 1
npm run client:start

# Terminal 2
npm run server:start

# Terminal 3 (optional, for GraphQL schema changes)
npm run generate:watch
```

### With Distributed Tracing

```bash
cd server && npm run start:trace
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
npm run test              # Watch mode
npm run test:prepush      # Single run
npm run test:integ        # Integration tests

# Client
cd client
npm run test              # Watch mode
npm run test:prepush      # Single run

# Full validation (run before pushing)
npm run check:prepush
```

## GraphQL Development

Coop uses schema-first GraphQL with bidirectional code generation.

```bash
npm run generate          # One-time
npm run generate:watch    # Watch mode
```

Generated files:
- `client/src/graphql/generated.ts`
- `server/graphql/generated.ts`

Schema changes trigger recompilation of both client and server. If you experience regeneration loops, stop watch mode and run manually.

## HMA Development
HMA is not started automatically with `npm run up`. Start it separately if you're doing hash matching: `docker compose up --build -d hma`

HMA is pre-configured in `server/.env` with `HMA_SERVICE_URL=http://localhost:5000`. No additional environment setup is needed for local development.

### Image URL Accessibility
When submitting items to Coop, image URLs must be reachable by the HMA Docker container and not just your browser or the Node.js server. 
HMA fetches the image itself to compute the hash. This means localhost URLs will silently fail: HMA will return empty hashes, the image similarity signal will not evaluate, and no rule will fire.

For local development, if you're serving images from your host machine, add the following to /etc/hosts:

127.0.0.1 host.docker.internal

Then use `host.docker.internal:<port>` in image URLs when submitting items. This URL resolves correctly from both the browser and inside Docker.

## Troubleshooting

### ScyllaDB Not Ready

ScyllaDB takes 30-60 seconds to initialize. If migrations fail immediately after `npm run up`, wait and retry.

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
npm run down
docker volume prune    # Warning: removes all Docker volumes
npm run up
npm run db:update -- --env staging --db api-server-pg
npm run db:update -- --env staging --db clickhouse
npm run create-org
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
npm run lint       # ESLint
npm run format     # Prettier
npm run check:prepush    # Run before pushing
```
