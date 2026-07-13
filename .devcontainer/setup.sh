#!/usr/bin/env bash
# First-pass Codespace setup for the Coop TrustCon demo. It brings up the
# stack and prepares the databases; the org-creation and CCF seeding steps
# are printed at the end (see trustcon/PREP.md). Validate end to end in a real
# Codespace during the dry run.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Copying .env files (defaults work for local/Codespace dev)"
cp -n server/.env.example server/.env || true
cp -n db/.env.example db/.env || true
cp -n client/.env.example client/.env || true

echo "==> Starting backing services (Postgres, ClickHouse, Scylla, Redis, HMA)"
npm run up

echo "==> Installing dependencies (root, server, client, db)"
npm install
(cd server && npm install)
(cd client && npm install)
(cd db && npm install)

echo "==> Creating and migrating databases (staging includes the atproto item types seed)"
for db in api-server-pg scylla clickhouse; do
  npm run db:create -- --env staging --db "$db" || true
  npm run db:update -- --env staging --db "$db"
done

echo "==> Building the client (production build; the Codespace proxy is unreliable with the vite HMR socket)"
(cd client && npm run build)

cat <<'NEXT'

==> Base setup complete. Remaining steps (see trustcon/PREP.md):

  1. Create the demo org (pick any password):
       npm run create-org -- --name "TrustCon Demo" --email admin@trustcon.local \
         --website https://example.com --firstName Demo --lastName Admin --password CHANGE_ME

  2. Seed the CCF TVEC demo (org id is printed by step 1):
       (cd server && npm run seed-trustcon -- --org-id <ORG_ID> --relay-url <RELAY_URL>)

  3. Turn on Jetstream ingestion: set INGEST_ORG_ID=<ORG_ID> (and INGEST_API_KEY) in server/.env

  4. Start the app:
       npm run server:start        # serves the built client on :3000, GraphQL on :8080

  5. Populate the HMA hash bank with benign images (e.g. chicken photos) via
     Settings, then Matching Banks in the UI.
NEXT
