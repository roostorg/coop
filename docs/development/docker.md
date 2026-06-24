# Docker Images

Pre-built images are published to the GitHub Container Registry on every push to `main`:

```
ghcr.io/roostorg/coop-server       # API server
ghcr.io/roostorg/coop-worker       # Background worker
ghcr.io/roostorg/coop-client       # Frontend (nginx)
ghcr.io/roostorg/coop-migrations   # One-shot database migrations runner
```

Images are tagged with `latest`, the git SHA, and semver tags on release. The
`coop-migrations` image is only rebuilt when something under `db/` changes (e.g.
a new migration script) or on a release, so its tags track the schema rather
than every server/client change.

## Quick start

Pull the published images and run the full stack locally with a single command:

```bash
docker compose -f docker-compose.images.yaml up -d
```

> [!WARNING]
> `docker-compose.images.yaml` uses `.env.docker`, which ships working defaults for local evaluation but includes placeholder secrets. **Review and replace secrets before any non-local deployment.**

This starts:

- **Coop server** on port 8080
- **Coop client** (nginx) on port 3000
- **Postgres**, **Redis**, **ScyllaDB**, **ClickHouse**
- Database migrations (run automatically)
- A seed service that creates an admin user with a randomly generated password

### Get your login credentials

The seed service prints the generated credentials to its logs:

```bash
docker compose -f docker-compose.images.yaml logs seed
```

Look for the output at the bottom:

```
============================================
  Login:    admin@coop.local
  Password: <randomly-generated>
============================================
```

Then open [http://localhost:3000](http://localhost:3000) and log in.

On subsequent startups (with the same volumes), the seed service detects the existing user and skips — your credentials remain the same. If you lose the password, tear down with `-v` to reset.

## Create additional users

```bash
docker compose -f docker-compose.images.yaml exec server \
  node bin/create-org-and-user.js \
  --name "My Org" \
  --email "you@example.com" \
  --website "https://example.com" \
  --firstName "Jane" \
  --lastName "Doe" \
  --password "your-password"
```

## Tear down

```bash
# Stop containers, keep data volumes
docker compose -f docker-compose.images.yaml down

# Stop containers and wipe all data
docker compose -f docker-compose.images.yaml down -v
```

## Image details

| Image             | Dockerfile          | Build target          | Base                              |
| ----------------- | ------------------- | --------------------- | --------------------------------- |
| `coop-server`     | `Dockerfile`        | `build_server`        | node:24-bullseye-slim + dumb-init |
| `coop-worker`     | `Dockerfile`        | `build_worker_runner` | node:24-bullseye-slim + dumb-init |
| `coop-client`     | `client/Dockerfile` | `serve`               | nginx:1.27-bookworm               |
| `coop-migrations` | `db/Dockerfile`     | _(final stage)_       | node:24-bullseye-slim             |

The client image serves the Vite-built SPA via nginx and proxies `/api/` requests (including `/api/v1/graphql`) to a backend service named `server` on port 8080.

## Running migrations

The `coop-migrations` image bundles the migration scripts under `db/` together
with the migrator engine, so it can run as a one-shot task (an ECS `RunTask`, a
Kubernetes `Job`, or the `migrations` service in `docker-compose.images.yaml`).
It exposes the same `npm run db:*` commands used in local development, so the
invocation matches what you'd run from the repo root:

```bash
# Apply all pending migrations to an existing prod database
docker run --rm --env-file .env.docker ghcr.io/roostorg/coop-migrations:latest \
  npm run db:update -- --db api-server-pg --env prod
```

Supported `--db` values are `api-server-pg`, `scylla`, and `clickhouse`.
Connection settings come from environment variables (see `db/.env.example`),
which must be present for any command since the database configs are read at
startup.

### What `--env` controls

`--env` (`staging` or `prod`) only affects **seed scripts**, not migrations:

- Migration scripts run in every environment.
- A seed named `*.seed.<env>.sql` runs **only** when `--env` matches it. Seed
  files are timestamp-prefixed; the repo currently ships
  `db/src/scripts/api-server-pg/2025.12.01T00.00.01.initial-test-data.seed.staging.sql`,
  which creates a sample org with default-password users — so **use `--env prod`
  in production** to skip it. Running `--env staging` against a prod database
  would seed that test data.
- `db:create` ignores `--env` functionally and is allowed in prod, so you can
  provision schemas for self-hosted Scylla/ClickHouse (which have no managed
  "create the database" step).
- `db:clean` and `db:drop` are destructive and **reject `--env prod`** as a
  safety guard.
