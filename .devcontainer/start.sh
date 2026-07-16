#!/usr/bin/env bash
# Start the Coop demo's long-running services: the API server (which also serves
# the built client) and the Jetstream connector worker (a separate process from
# the server). Launched by postStartCommand so they come up on Codespace start;
# safe to run by hand too. Setup (org, seed, INGEST_ORG_ID) is done by setup.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p .devcontainer/logs

# Ingestion only runs when INGEST_ORG_ID is set (setup.sh sets it).
if ! grep -q '^INGEST_ORG_ID=[^[:space:]]' server/.env 2>/dev/null; then
  echo "WARNING: INGEST_ORG_ID not set in server/.env; run .devcontainer/setup.sh first."
fi

echo "==> Starting the Coop server (:8080, GraphQL + REST API)"
# `server:start` is a root script (cd server && npm start); run it from root.
nohup bash -c 'npm run server:start' \
  > .devcontainer/logs/server.log 2>&1 &

echo "==> Serving the built client on :3000 (vite preview; proxies /api to :8080)"
# The client is a production build (setup.sh ran `vite build`); nothing serves
# it otherwise, so `vite preview` hosts build/ and proxies /api to the server.
nohup bash -c 'cd client && npm run preview' \
  > .devcontainer/logs/client.log 2>&1 &

echo "==> Starting the Jetstream connector worker"
nohup bash -c 'cd server && npm run runWorkerOrJob -- TapConnectorWorker' \
  > .devcontainer/logs/connector.log 2>&1 &

# One-time: once the server accepts connections, backfill every org's review
# queues with sample posts. Guarded by a marker so it runs once per fresh seed
# (setup.sh clears the marker); backfill uses stable item ids, so it's safe.
if [ -f server/workshop-credentials.json ] && [ ! -f .devcontainer/.workshop-backfilled ]; then
  echo "==> Scheduling one-time queue backfill (waits for the server; runs in background)"
  nohup bash -c '
    for _ in $(seq 1 60); do curl -s http://localhost:8080 >/dev/null 2>&1 && break; sleep 2; done
    sleep 3
    if (cd server && npm run backfill-items -- --base-url http://localhost:8080); then
      touch .devcontainer/.workshop-backfilled
    fi
  ' > .devcontainer/logs/backfill.log 2>&1 &
fi

cat <<'DONE'
==> Services launched in the background.
    Logs:   .devcontainer/logs/server.log · .devcontainer/logs/connector.log
    Client: http://localhost:3000   GraphQL: http://localhost:8080
    Live Bluesky posts should start landing in the "Incoming reports" queue.
DONE
