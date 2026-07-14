#!/usr/bin/env bash
# One-click Codespace setup for the Coop TrustCon demo: brings up the stack,
# migrates, creates the demo org, wires Jetstream ingestion into it, and seeds
# the CCF TVEC + general demo config. Long-running services (API server and the
# connector worker) are started separately by .devcontainer/start.sh
# (postStartCommand). Each step here was validated against a live stack; this
# assembles them, so give it one real-Codespace run before the workshop.
set -euo pipefail
cd "$(dirname "$0")/.."

DEMO_EMAIL="admin@trustcon.local"
DEMO_WEBSITE="https://trustcon-demo.example"
DEMO_PASSWORD="trustcon"
RELAY_URL="${RELAY_URL:-http://localhost:8090}"

echo "==> Copying .env files"
cp -n server/.env.example server/.env || true
cp -n db/.env.example db/.env || true
cp -n client/.env.example client/.env || true

echo "==> Starting backing services (Postgres, ClickHouse, Scylla, Redis, HMA)"
# Use docker compose directly, not `npm run up` (that also tries to open Jaeger
# in a browser, which fails headless and would abort under `set -e`).
docker compose up --detach postgres clickhouse hma scylla redis otel-collector

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

echo "==> Creating the demo org"
strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }
ORG_OUT=$(cd server && npm run create-org -- --name "TrustCon Demo" \
  --email "$DEMO_EMAIL" --website "$DEMO_WEBSITE" \
  --firstName Demo --lastName Admin --password "$DEMO_PASSWORD" 2>&1 || true)
ORG_ID=$(echo "$ORG_OUT" | grep -a "Organization ID:" | strip_ansi | awk '{print $3}')
API_KEY=$(echo "$ORG_OUT" | grep -a "API Key:" | strip_ansi | awk '{print $3}')

if [ -z "${ORG_ID:-}" ]; then
  echo "    (org may already exist; looking it up in Postgres)"
  ORG_ID=$(docker compose exec -T postgres psql -U postgres -d postgres -tAc \
    "select id from orgs where email='$DEMO_EMAIL' order by created_at desc limit 1;" \
    2>/dev/null | tr -d '[:space:]')
fi
[ -n "${ORG_ID:-}" ] || { echo "ERROR: could not determine the demo org id"; exit 1; }
echo "    demo org: $ORG_ID"

echo "==> Wiring Jetstream ingestion into the demo org"
perl -pi -e "s#^INGEST_ORG_ID=.*#INGEST_ORG_ID=$ORG_ID#;" server/.env
grep -q '^INGEST_ORG_ID=' server/.env || echo "INGEST_ORG_ID=$ORG_ID" >> server/.env
if [ -n "${API_KEY:-}" ]; then
  perl -pi -e "s#^INGEST_API_KEY=.*#INGEST_API_KEY=$API_KEY#;" server/.env
  grep -q '^INGEST_API_KEY=' server/.env || echo "INGEST_API_KEY=$API_KEY" >> server/.env
fi

echo "==> Seeding the CCF TVEC + general demo config"
(cd server && npm run seed-trustcon -- --org-id "$ORG_ID" --relay-url "$RELAY_URL")

cat <<NEXT

==> Setup complete. Org $ORG_ID is seeded and Jetstream ingestion is wired.
    Sign in as: $DEMO_EMAIL / $DEMO_PASSWORD

    Services start automatically via .devcontainer/start.sh. To (re)start by hand:
      bash .devcontainer/start.sh

    Client:  http://localhost:3000
    GraphQL: http://localhost:8080

    Notes:
    - The real-label action posts to the Ozone relay at $RELAY_URL. Start the
      relay separately (it needs the labeler admin secret) or use the mock path.
    - Populate the HMA hash bank with benign images via Settings, then Matching Banks.
NEXT
