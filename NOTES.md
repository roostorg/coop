# Coop Local Setup Notes

Observations and issues found while getting Coop running locally (April 2026) for the atproto demo work. Intended as upstream issue/doc improvement material.

## Setup issues

### `db:create` required before `db:update` for Scylla and ClickHouse

Both `README.md` and `AGENTS.md` only show `db:update` in their setup steps. On a fresh install, Scylla and ClickHouse need `db:create` first to create the keyspace/database before migrations can run. Running `db:update` alone on a fresh Scylla gives:

```
ResponseError: Keyspace 'item_investigation_service' does not exist
```

**Fix:** Both docs should include `db:create` before `db:update` for Scylla and ClickHouse (Postgres handles this automatically via its migration runner).

### `create-org` leaks a raw SQL line in its output

Running `create-org` prints one raw Sequelize debug line:

```
Executing (default): INSERT INTO "users" ("id","org_id",...
```

before the friendly success output. Looks like a missing `logging: false` in the Sequelize call that creates the user.

### `npm run create-org` is not in the root `package.json`

`README.md` says to run `npm run create-org` but that script only exists in `server/package.json`. From the repo root it errors. Should either add a proxy script to the root or clarify in the README that you need to `cd server` first.

### Items endpoint is at `/api/v1/items/async/`, not `/items/async/`

The `routes/index.ts` comment says path prefixes are concatenated with `/api/v1`, but this isn't called out in any docs. Easy to miss when building against the API.

### `atproto-demo.mts` needs `TS_NODE_PROJECT` pointing at server's tsconfig

Running `node --loader ts-node/esm` from the root directory (which has no `tsconfig.json` and no `"type": "module"`) fails with a cryptic `ERR_REQUIRE_CYCLE_MODULE` error. Fix was to set `TS_NODE_PROJECT=server/tsconfig.json` in the npm script. Using `.mts` extension alone was not sufficient.

### `replyTo` field must be `STRING`, not `URL`

AT URIs (`at://did:plc:.../app.bsky.feed.post/...`) don't pass Coop's URL field validator, which expects HTTP/HTTPS URLs. Any field storing AT URIs should use `STRING` type.

### Content proxy required for iframe display, not mentioned in setup docs

`IframeContentDisplayComponent` proxies item URLs through a separate content proxy service. In dev mode it defaults to `http://localhost:4000`; nothing runs there locally and the setup docs don't mention it. The production fallback URL (`https://content.getcoop.com`) also does not exist (filed as #370).

The iframe appears unconditionally on the review queue page for any item with a `url` field — regardless of `VITE_CONTENT_URL_PATTERN`. The pattern filter only applies to the investigation/summary page. So the broken iframe will always appear for atproto posts in the review queue until a working proxy is configured or the component is updated.

**Workaround:** Set `VITE_CONTENT_PROXY_URL` in `client/.env` to a working proxy URL.

## What works

- All three databases (Postgres, Scylla, ClickHouse) migrate cleanly on a fresh `docker compose down -v` restart
- `create-org` creates an org, user, and API key correctly
- `atproto:setup` creates atproto User and atproto Post item types via the IoC container
- `atproto:demo` connects to Jetstream, rate-limits correctly, fetches author handle and display name from the Bluesky public API, maps posts to Coop's item submission format, and POSTs successfully to `/api/v1/items/async/`
- Items land in ClickHouse (`CONTENT_API_REQUESTS`) as confirmed by direct query
