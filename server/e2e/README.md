# Coop E2E (Playwright)

End-to-end tests for the moderator-critical dashboard flows.

These live in `server/` — rather than a standalone package — so each test can
**seed the state it needs** through the server's DI container and the existing
`test/fixtureHelpers` factories (`createOrg`, `createUser`, `createRule`,
`createContentItemTypes`, …), then tear it down. Tests never rely on
pre-seeded data.

The suite drives the **real** dashboard, so it needs the full stack running and
reachable at `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`).

## How seeding works

`fixtures/coop.ts` extends Playwright's `test` with:

- a worker-scoped `deps` fixture that builds the real DI container via
  `getBottle()` and closes its connections at the end of the worker;
- a test-scoped `seed` fixture exposing factory wrappers (e.g.
  `seed.orgWithAdmin()`) that commit DB state.

There is **no per-test cleanup**. Every seeded org gets a unique id, so the
app's own multi-tenancy isolates tests from one another, and the CI database is
disposable (created fresh, migrated, thrown away). This keeps tests trivially
parallel (`fullyParallel: true`) without per-worker databases. Locally, just
recreate the DB if you want a clean slate.

```ts
import { expect, test } from '../fixtures/coop.js';

test('does a thing', async ({ page, seed }) => {
  const admin = await seed.orgWithAdmin();
  // ...log in as admin.email / admin.password, drive the flow...
});
```

Add more seed helpers to `Seeder` in `fixtures/coop.ts` as new flows need them —
they should wrap the existing `test/fixtureHelpers` factories.

## Run locally

Bring up the app (backing services, migrations, `npm run server:start`,
`npm run client:start` — see the repo root `AGENTS.md`). You do **not** need to
`create-org`; the tests seed their own orgs. Then, from `server/`:

```bash
npm run e2e:install-browsers   # one-time: download Chromium
npm run test:e2e               # headless
npm run test:e2e:ui            # interactive UI mode
```

Point at a non-default URL:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e
```

## Layout

- `playwright.config.ts` — config (base URL, reporters, retries, browsers).
- `fixtures/coop.ts` — the seeding-aware `test`/`expect` and the `Seeder`.
- `tests/` — specs (`*.spec.ts`). `login.spec.ts` covers login; the remaining
  #485 flows go here too.

Jest ignores `e2e/` (`testPathIgnorePatterns`), so these specs run only under
Playwright, never the unit-test runner.

## Test isolation & ordering

Tests run with `fullyParallel: true` and no fixed order. Each one **seeds the
state it needs** under a unique org and **only asserts about that org**, so the
app's multi-tenancy guarantees isolation regardless of interleaving — implicit
ordering dependencies are impossible to write accidentally.

Two disciplines keep this true (and keep the door open to scaling, below):

1. Always seed your own data; never assume pre-existing rows or an empty DB.
2. Never assert on global/cross-tenant state ("there are N orgs", "the list has
   exactly X rows"). Scope every assertion to your seeded org.

## Scaling to per-worker databases

Today all workers share one server + one Postgres, isolated by tenant. That's
right for a small suite. When the suite grows large (or needs tests that mutate
**global**, non-tenant state), switch to the Django/Rails model: one cloned
database — and therefore one server process — **per worker**.

Because the `deps` fixture is already **worker-scoped** and tests already seed
their own data, that change is **infra-only, with zero test rewrites**: a
worker-scoped fixture provisions `{cloned DB + server on port 8080+i + baseURL}`
(the `getBottle()` pool override that `test/setupMockedServer.ts` already uses),
and resets within a worker via truncate. As long as the two disciplines above
hold, no spec needs to change.

## CI

`.github/workflows/e2e.yaml` runs the suite on PRs and on pushes to main (not
nightly), gated by `paths-filter` and caching the browser binaries. It is a
**draft** pending maintainer review.

[#485]: https://github.com/roostorg/coop/issues/485
