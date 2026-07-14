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

echo "==> Starting the Coop server (:8080, serves client on :3000)"
nohup bash -c 'cd server && npm run server:start' \
  > .devcontainer/logs/server.log 2>&1 &

echo "==> Starting the Jetstream connector worker"
nohup bash -c 'cd server && npm run runWorkerOrJob -- TapConnectorWorker' \
  > .devcontainer/logs/connector.log 2>&1 &

cat <<'DONE'
==> Services launched in the background.
    Logs:   .devcontainer/logs/server.log · .devcontainer/logs/connector.log
    Client: http://localhost:3000   GraphQL: http://localhost:8080
    Live Bluesky posts should start landing in the "Incoming reports" queue.
DONE
