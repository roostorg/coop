# Docker Images

Pre-built images are published to the GitHub Container Registry on every push to `main`:

```
ghcr.io/roostorg/coop-server   # API server
ghcr.io/roostorg/coop-worker   # Background worker
ghcr.io/roostorg/coop-client   # Frontend (nginx)
```

Images are tagged with `latest`, the git SHA, and semver tags on release.

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
- **Postgres** (pgvector), **Redis**, **ScyllaDB**, **ClickHouse**
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

| Image         | Dockerfile          | Build target          | Base                              |
| ------------- | ------------------- | --------------------- | --------------------------------- |
| `coop-server` | `Dockerfile`        | `build_server`        | node:24-bullseye-slim + dumb-init |
| `coop-worker` | `Dockerfile`        | `build_worker_runner` | node:24-bullseye-slim + dumb-init |
| `coop-client` | `client/Dockerfile` | `serve`               | nginx:1.27-bookworm               |

The client image serves the Vite-built SPA via nginx and proxies `/api/` requests (including `/api/v1/graphql`) to a backend service named `server` on port 8080.
