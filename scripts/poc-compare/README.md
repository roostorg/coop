# Server comparison scripts (framework PoC)

Run `main` and a branch side by side against the same databases, then diff.

```bash
# Golden requests: status, ~30 headers, normalized body for 52 requests.
node scripts/poc-compare/golden.mjs http://127.0.0.1:8081 "$API_KEY" "$EMAIL" "$PASSWORD" "$ORG_ID" > main.json
node scripts/poc-compare/golden.mjs http://127.0.0.1:8080 "$API_KEY" "$EMAIL" "$PASSWORD" "$ORG_ID" > branch.json

# Introspected SDL (development mode).
node scripts/poc-compare/sdl.mjs http://127.0.0.1:8081 > main.graphql
node scripts/poc-compare/sdl.mjs http://127.0.0.1:8080 > branch.graphql

# Startup (spawn to first 200 on /api/v1/ready) and RSS, median of 5.
node scripts/poc-compare/startup.mjs ./server 8091 5

# Same, from a built image (`docker build --target build_server -t <tag> .`).
node scripts/poc-compare/startup-container.mjs <tag> 8092 server/.env 5

# Latency, per endpoint.
npx autocannon -c 10 -d 20 http://127.0.0.1:8080/api/v1/ready
```

Create the org, admin user and API key with
`node --env-file-if-exists=.env transpiled/bin/create-org-and-user.js ...` in
`server/`. Start the servers with `ITEM_QUEUE_TRAFFIC_PERCENTAGE=0`.
`sdl.mjs` imports `graphql`, so run it from a directory that resolves it
(e.g. copy it into `server/`).

`startup-container.mjs` runs containers with `--network host` so they reach
the local stack's databases on `localhost`; the server then listens on every
host interface. Use it only on a development machine.
