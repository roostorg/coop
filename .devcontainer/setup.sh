#!/usr/bin/env bash
# One-click Codespace setup for the Coop TrustCon demo: brings up the stack,
# migrates, creates the demo org, wires Jetstream ingestion into it, and seeds
# the CCF TVEC + general demo config. Long-running services (API server and the
# connector worker) are started separately by .devcontainer/start.sh
# (postStartCommand). Each step here was validated against a live stack; this
# assembles them, so give it one real-Codespace run before the workshop.
set -euo pipefail
cd "$(dirname "$0")/.."

DEMO_PASSWORD="trustcon"
RELAY_URL="${RELAY_URL:-http://localhost:8090}"
RELAY_TOKEN="${RELAY_TOKEN:-}"
ORGS="${WORKSHOP_ORGS:-6}"

echo "==> Copying .env files"
cp -n server/.env.example server/.env || true
cp -n db/.env.example db/.env || true
cp -n client/.env.example client/.env || true

echo "==> Starting backing services (Postgres, ClickHouse, Scylla, Redis, HMA)"
# Use docker compose directly, not `npm run up` (that also tries to open Jaeger
# in a browser, which fails headless and would abort under `set -e`).
docker compose up --detach postgres clickhouse hma scylla redis otel-collector

echo "==> Waiting for data services to be healthy (migrations and the seed need them)"
wait_healthy() {
  local name="coop-${1}-1"
  for _ in $(seq 1 60); do
    [ "$(docker inspect "$name" --format '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ] && return 0
    sleep 3
  done
  echo "WARNING: $name did not become healthy in time"; return 1
}
wait_healthy postgres
wait_healthy scylla
wait_healthy clickhouse

# HMA runs its own DB migration on startup and can lose the race with Postgres
# (it exits with "relation ... does not exist"). Ensure it is actually serving,
# restarting it if it raced. The seed's hash bank needs it.
echo "==> Ensuring HMA is up"
HMA_URL="$(grep -E '^HMA_SERVICE_URL=' server/.env 2>/dev/null | cut -d= -f2)"
HMA_URL="${HMA_URL:-http://localhost:9876}"
for _ in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$HMA_URL/status" 2>/dev/null)" = "200" ] && break
  [ "$(docker inspect coop-hma-1 --format '{{.State.Status}}' 2>/dev/null)" != "running" ] \
    && docker compose up -d hma >/dev/null 2>&1
  sleep 5
done

echo "==> Installing dependencies"
npm install
(cd server && npm install)
(cd client && npm install)
(cd db && npm install)

echo "==> Creating and migrating databases (staging)"
for db in api-server-pg scylla clickhouse; do
  npm run db:create -- --env staging --db "$db" || true
  npm run db:update -- --env staging --db "$db"
done

echo "==> Building the client (production build; the Codespace proxy is unreliable with vite HMR)"
(cd client && npm run build)

echo "==> Creating $ORGS workshop orgs (role-based teams) and seeding each with the CCF config"
(cd server && npm run seed-orgs -- --orgs "$ORGS" --users-per-org 5 \
  --password "$DEMO_PASSWORD" --relay-url "$RELAY_URL" --relay-token "$RELAY_TOKEN")

CREDS="server/workshop-credentials.json"
[ -f "$CREDS" ] || { echo "ERROR: seed-orgs did not write $CREDS"; exit 1; }

# Team 1 (the first org) gets the live Jetstream connector; every org, Team 1
# included, is backfilled with sample items by start.sh once the server is up.
ORG_ID=$(node -e "process.stdout.write(require('./$CREDS')[0].orgId)")
API_KEY=$(node -e "process.stdout.write(require('./$CREDS')[0].apiKey)")
[ -n "$ORG_ID" ] || { echo "ERROR: could not read the first org from $CREDS"; exit 1; }
echo "    live-ingestion org (Team 1): $ORG_ID"

echo "==> Wiring Jetstream ingestion into Team 1"
perl -pi -e "s#^INGEST_ORG_ID=.*#INGEST_ORG_ID=$ORG_ID#;" server/.env
grep -q '^INGEST_ORG_ID=' server/.env || echo "INGEST_ORG_ID=$ORG_ID" >> server/.env
perl -pi -e "s#^INGEST_API_KEY=.*#INGEST_API_KEY=$API_KEY#;" server/.env
grep -q '^INGEST_API_KEY=' server/.env || echo "INGEST_API_KEY=$API_KEY" >> server/.env

# Let start.sh run its one-time queue backfill against this fresh set of orgs.
rm -f .devcontainer/.workshop-backfilled

cat <<NEXT

==> Setup complete. $ORGS orgs seeded; Team 1 ($ORG_ID) has live Jetstream ingestion.
    Logins for every org (shared password "$DEMO_PASSWORD") are in
    server/workshop-credentials.md (also .csv). Hand these out by table.

    Services start automatically via .devcontainer/start.sh, which also backfills
    every org's queues with sample items once the server is up. To (re)start by hand:
      bash .devcontainer/start.sh

    Client:  http://localhost:3000
    GraphQL: http://localhost:8080

    Notes:
    - The real-label action posts to the Ozone relay at $RELAY_URL. Start the
      relay separately (it needs the labeler admin secret) or use the mock path.
    - Populate the HMA hash bank with benign images via Settings, then Matching Banks.
NEXT
