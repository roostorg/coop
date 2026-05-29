# Integration tests

End-to-end tests that exercise the real Coop stack — Postgres, Scylla,
ClickHouse, Redis, and an inline item-processing worker. Unlike unit tests
(which mock the data warehouse), these run against the same services that
`npm start` uses.

These tests implement the scenarios filed under issue
[#288](https://github.com/roostorg/coop/issues/288).

## Running

From the repo root:

```bash
npm run up           # boot postgres, clickhouse, scylla, redis, hma, otel
npm run db:update    # apply Postgres + ClickHouse migrations
cd server && npm run test:integ
```

`npm run up` opens Jaeger at <http://localhost:16686>. Stop infra with
`npm run down` when done.

## Layout

| File                        | Purpose                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `setupIntegrationServer.ts` | Boots the real IoC container, starts the express app and `ItemProcessingWorker` inline, returns a `supertest` agent + shutdown handle. |
| `wait.ts`                   | Polling helpers — `waitForItemInScylla`, `waitForItemInClickHouse`, generic `waitFor`.                                                 |
| `*.integ.test.ts`           | The tests themselves. Picked up by `jest.integ.config.cjs`, excluded from the unit `jest.config.cjs`.                                  |

Fixture helpers (`createOrg`, `createContentItemTypes`, ...) live in
`server/test/fixtureHelpers/` and are shared with unit tests.

## Conventions

- One `describe` per scenario; one or more `test()`s inside.
- Generate unique `orgId` / `itemId` per `describe` so concurrent runs don't
  collide.
- `beforeAll` boots the harness and creates fixtures; `afterAll` cleans them
  up and calls `harness.shutdown()`.
- Default timeouts: 60s for `beforeAll`/`test`, 30s for `afterAll`.
- Polls default to 250ms interval, 30s timeout — override per-call when a
  scenario is known to be faster or slower.

## CI

Not yet wired. A follow-up PR will add a workflow that boots the
`docker-compose.yaml` services and runs `npm run test:integ`.
