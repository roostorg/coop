# Coop E2E (Playwright)

End-to-end tests for the moderator-critical dashboard flows ([#485]).

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
  `getBottle()` (committed writes, not the transaction-rollback used by unit
  tests) and closes its connections at the end of the worker;
- a test-scoped `seed` fixture exposing factory wrappers (e.g.
  `seed.orgWithAdmin()`) that commit DB state and register cleanups run after
  each test.

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

## CI

`.github/workflows/e2e.yaml` runs the suite on PRs and on pushes to main (not
nightly), gated by `paths-filter` and caching the browser binaries. It is a
**draft** pending maintainer review.

[#485]: https://github.com/roostorg/coop/issues/485
