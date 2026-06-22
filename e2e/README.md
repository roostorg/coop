# Coop E2E (Playwright)

End-to-end tests for the moderator-critical dashboard flows ([#485]). This is an
independent package (own `package.json` / lockfile), like `server`, `client`,
`db`, and `migrator`.

The suite drives the **real** dashboard, so it needs the full stack running and
reachable at `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`).

## Run locally

Bring up the app the usual way (see the repo root `AGENTS.md` / `README.md`):
backing services, migrations, a seeded org/admin, then `npm run server:start`
and `npm run client:start`. Then:

```bash
cd e2e
npm install
npm run install:browsers   # one-time: download the Chromium binary
npm test                   # headless run
npm run test:ui            # interactive UI mode
npm run test:headed        # headed run
npm run report             # open the last HTML report
npm run codegen            # record selectors against the running app
```

Point at a non-default URL:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 npm test
```

## Layout

- `playwright.config.ts` — config (base URL, reporters, retries, browsers).
- `tests/` — specs (`*.spec.ts`). `login.spec.ts` covers the login flow; the
  remaining #485 flows go here too.
- `fixtures/` — shared fixtures/helpers (e.g. an authenticated-session fixture).

## In-scope flows ([#485])

- Login + session
- Create an item type with mixed field types (STRING, AUDIO, IMAGE, USER_ID)
- Create a rule routed to a manual review queue
- MRT job: render text + image + audio + video fields, play audio, apply a
  decision, verify it lands in the dashboard
- View item details and signal results

## CI

`.github/workflows/e2e.yaml` runs the suite nightly and as a release gate (not
per-PR). It is a **draft** pending maintainer review and end-to-end validation.

[#485]: https://github.com/roostorg/coop/issues/485
