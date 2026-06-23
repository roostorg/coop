# Local Development

Dive into configuration details and troubleshooting for local development.

> [!NOTE]
> You may also want to familiarize yourself with Coop's [Basic Concepts](../user/concepts.md) for additional context.

These docs focus on providing more detailed information and reference. See the [Getting Started](./) guide to just get up and running quickly. You may also wish to learn more about Coop's [Architecture](architecture.md).

## Prerequisites

- **Operating System**: macOS, Linux, or Windows with WSL2
- **git** for cloning and contributing
- **Node.js 24**, **nvm**, and **npm**
- **Docker** and **Docker Compose**
- **4 GiB RAM** minimum for a bare instance, 8 GiB or more recommended for development

Ensure you're using the preferred version of Node.js:

```sh
nvm install && nvm use
```

## Dependencies

The Coop repository is composed of multiple components, managed as individual npm packages each with their own dependencies.

```sh
npm install
(cd db && npm install)
(cd server && npm install)
(cd client && npm install)
(cd migrator && npm install)
```

## Environment setup

Copy the `.env.example` files to `.env` in `db/`, `server/`, and `client/`. Edit for your environment, though the defaults work for local development and demoing. The example files contain all available options with documentation.

### `db/.env`

Postgres, ClickHouse, and Scylla database connection settings.

### `server/.env`

Redis connection settings, external API keys for integrations, session secrets, and JWT signing keys.

### `client/.env`

Settings for Vite, content proxying, and generating sourcemaps.

## Docker services

`npm run up` starts the backing services using Docker:

| Service        | Port       | Notes                   |
| -------------- | ---------- | ----------------------- |
| PostgreSQL     | 5432       | Primary database        |
| ClickHouse     | 8123, 9000 | Analytics warehouse     |
| ScyllaDB       | 9042       | Item submission history |
| Redis          | 6379       | Caching and job queues  |
| Jaeger         | 16686      | Tracing UI              |
| OTEL Collector | 4317       | Telemetry collection    |

Check service health:

```sh
docker ps
docker logs <container-name>
```

Stop services:

```sh
npm run down
```

## Database operations

### Create databases

```sh
npm run db:create -- --env staging --db api-server-pg
npm run db:create -- --env staging --db scylla
npm run db:create -- --env staging --db clickhouse
```

### Run migrations

```sh
npm run db:update -- --env staging --db api-server-pg
npm run db:update -- --env staging --db scylla
npm run db:update -- --env staging --db clickhouse
```

### Other commands

```sh
npm run db:add -- --name <migration-name> --db api-server-pg
npm run db:clean    # Drop and recreate (destructive)
npm run db:create   # Create database
npm run db:drop     # Drop database
```

### Migration locations

```text
db/src/scripts/
├── api-server-pg/    # PostgreSQL
├── clickhouse/       # ClickHouse
└── scylla/           # ScyllaDB
```

## Running the application

For convenience, the `start` npm script in the root of the repository will start each of the client, server, and GraphQL codegen, plus open a web browser. The `compile` script does the same without opening the browser.

```sh
npm run start
```

or

```sh
npm run compile
```

### Individual services

To start services individually (i.e. to aid in debugging), run the `start` npm script for the `server` and `client` packages in individual terminal windows/tabs.

<!-- TODO: confirm and standardize https://github.com/roostorg/coop/issues/476 -->

Start the server your first terminal:

```sh
cd server && npm run start
```

Start the client in your second terminal:

```sh
cd client && npm run start
```

Optionally, to keep GraphQL schema changes up to date, run in a third terminal:

```sh
npm run generate:watch
```

### Background workers

Item submissions are processed asynchronously via a BullMQ worker that consumes from Redis. To process items locally, run the worker in a separate terminal:

```sh
cd server
npm run runWorkerOrJob ItemProcessingWorker
```

Without this running, submitted items will be enqueued in Redis but not processed. Other available workers/jobs can be found in `server/iocContainer/services/workersAndJobs.ts`.

### With distributed tracing

```sh
cd server && npm run start:trace
```

<!-- TODO: Expand on this https://github.com/roostorg/coop/issues/416 -->

View traces at [localhost:16686](http://localhost:16686).

### Access points

| Service    | URL                           |
| ---------- | ----------------------------- |
| Client     | http://localhost:3000         |
| API Server | http://localhost:8080         |
| GraphQL    | http://localhost:8080/graphql |
| Jaeger UI  | http://localhost:16686        |

## Testing

```sh
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

## Running CI locally

All PR checks are defined as `docker compose` services to reproduce any CI job locally.

| CI job                                   | Local command                                   |
| ---------------------------------------- | ----------------------------------------------- |
| `check_generated_graphql`                | `docker compose run --rm codegen-check`         |
| `check_api_server` (lint)                | `docker compose run --rm backend npm run lint`  |
| `check_api_server` (build)               | `docker compose run --rm backend npm run build` |
| `run_frontend_checks_if_changed` (lint)  | `docker compose run --rm client npm run lint`   |
| `run_frontend_checks_if_changed` (build) | `docker compose run --rm client npm run build`  |
| `check_api_server` (test)                | `docker compose run --rm test`                  |

Run the full suite (stops at first failure):

```sh
docker compose run --rm codegen-check \
  && docker compose run --rm backend npm run lint \
  && docker compose run --rm backend npm run build \
  && docker compose run --rm client npm run lint \
  && docker compose run --rm client npm run build \
  && docker compose run --rm test
```

Tear down:

```sh
docker compose down        # stop containers, keep DB volumes
docker compose down -v     # also drop DB volumes (fresh DBs next run)
```

`check_migration_order` runs only in GitHub Actions; it's GitHub-specific and not needed locally. When adding a migration, use `date -u +"%Y.%m.%dT%H.%M.%S"` for the filename prefix and CI will pass.

## GraphQL development

Coop uses schema-first GraphQL with bidirectional code generation.

```sh
npm run generate          # One-time
npm run generate:watch    # Watch mode
```

Generated files:

- `client/src/graphql/generated.ts`
- `server/graphql/generated.ts`

Schema changes trigger recompilation of both client and server. If you experience regeneration loops, stop watch mode and run manually.

Backend GraphQL definitions are annotated with `/* GraphQL */` at the start of each block and are mostly in `/server/graphql/`. Frontend GraphQL is defined alongside the components that use it, so a file may use queries not defined within it.

## Management scripts

Two utility scripts in `server/bin/` help with common operations:

- **`npm run create-org`**: creates a new organization with an admin user and API key.
- **`npm run get-invite`**: retrieves the signup link for a user who has been invited via the UI.

See `server/bin/README.md` for detailed usage and examples.

## HMA development

HMA is started automatically with `npm run up` along with the other backing services.

HMA is pre-configured in `server/.env` with `HMA_SERVICE_URL=http://localhost:9876`. No additional environment setup is needed for local development.

### Image URL accessibility

When submitting items to Coop, image URLs must be reachable by the HMA Docker container and not just your browser or the Node.js server.
HMA fetches the image itself to compute the hash. This means localhost URLs will silently fail: HMA will return empty hashes, the image similarity signal will not evaluate, and no rule will fire.

For local development, if you're serving images from your host machine, add the following to /etc/hosts:

127.0.0.1 host.docker.internal

Then use `host.docker.internal:<port>` in image URLs when submitting items. This URL resolves correctly from both the browser and inside Docker.

## Troubleshooting

### ScyllaDB not ready

ScyllaDB takes 30-60 seconds to initialize. If migrations fail immediately after `npm run up`, wait and retry.

### ClickHouse migration fails

Ensure `CLICKHOUSE_USERNAME` and `CLICKHOUSE_PASSWORD` are set in your `.env`.

### Port conflicts

```sh
lsof -i :3000    # Client
lsof -i :8080    # Server
lsof -i :5432    # PostgreSQL
```

### Reset everything

```sh
npm run down
docker volume prune    # Warning: removes all Docker volumes
npm run up
npm run db:update -- --env staging --db api-server-pg
npm run db:update -- --env staging --db clickhouse
npm run create-org
```

### Connecting to databases directly

```sh
# PostgreSQL
psql -h localhost -U postgres -d postgres
# Password: postgres123

# ClickHouse
clickhouse-client --host localhost --user default --password clickhouse

# Redis
redis-cli
```

## Code quality

```sh
npm run lint           # ESLint
npm run prettier       # Prettier (check only; use `npm run prettier:fix` to write, alias `npm run format`)
npm run check:prepush    # Run before pushing
```
