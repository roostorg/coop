# AGENTS.md

Instructions for AI coding agents working on Coop. `README.md` is for humans; this file is for machines. The nearest `AGENTS.md` to the edited file wins; explicit user prompts override everything.

This file inherits from the ROOST community policy — read it once:

- [ROOST community `AGENTS.md`](https://github.com/roostorg/community/blob/main/software-development-practices/agents.md) — pan-org agent rules (dependency approval, CI/CD approval, small diffs, PR standards).
- [ROOST `CONTRIBUTING.md`](https://github.com/roostorg/.github/blob/main/CONTRIBUTING.md) — contribution standards (explainable, reviewable, digestible).

## Architecture

Four packages in a **pnpm workspace** — each has its own `package.json`; dependencies are locked in a single root `pnpm-lock.yaml`:

- `/` — root scripts, graphql-codegen, docker compose orchestration
- `/server` — Express + Apollo GraphQL API (ESM, `"type": "module"`)
- `/client` — React + Vite + Apollo Client frontend (Ant Design, TailwindCSS)
- `/db` — migration runner for Postgres, ClickHouse, Scylla
- `/migrator` — package and CLI tool for database migrations

Node **24** (`.nvmrc`). Running on Node 20 produces `EBADENGINE` warnings and can fail native builds.

Reference files: `README.md` (getting started), `server/bin/README.md` (utility scripts), `docs/` (architecture, ADRs).

## Design

- **API:** REST + GraphQL (Apollo Server); client uses Apollo Client with InMemoryCache; server resolvers live in `server/graphql/resolvers/`.
- **GraphQL authoring:** Inline in resolver files with `/* GraphQL */` comment markers — codegen discovers queries this way. Searching for `gql` or `graphql` alone misses most of it.
- **GraphQL codegen:** `pnpm run generate` (from root) regenerates `client/src/graphql/generated.ts` and `server/graphql/generated.ts`. **Never hand-edit** either `generated.ts`. **Never hand-merge** either `generated.ts` during a rebase/merge — pick one side with `git checkout --ours|--theirs <file>`, then run `pnpm run generate`. Hand-merging produces output that parses but drifts from the schema.
- **Adding a new built-in `SignalType`:** the type list is hand-mirrored in four files; missing any one ships a signal that's invisible to the dashboard. Update all of:
  1. `server/services/signalsService/types/SignalType.ts` — the canonical TS enum-like object (`BuiltInExternalSignalType` or `BuiltInThirdPartySignalType`) and the `integrationForSignalType` switch.
  2. `server/services/signalsService/types/SignalArgsByType.ts` — both `SignalArgsByType` and `RuntimeSignalArgsByType` (the `Satisfies<>` will fail compile until you do).
  3. `server/graphql/modules/signal.ts` — the `enum SignalType { ... }` block inside the SDL string. The `signal.test.ts` coverage test fails if you miss this.
  4. `client/src/models/signal.ts` — the `integrationForSignalType` switch (the server's switch is the source of truth for which `Integration` a type belongs to).

  After step 3, run `pnpm run generate` from the repo root to refresh the codegen output.

- **Data model:** Use Knex query builder for Postgres; ClickHouse via raw SQL in `server/clickhouse/`; Scylla via Cassandra driver.
- **Dependency injection:** Server uses BottleJS DI (wired in `server/iocContainer/`). Register services in `iocContainer`, don't export singletons from service files. Consumers receive dependencies via DI rather than importing directly. Bypassing `iocContainer` will work at runtime but breaks test mocking patterns.

## Build and run

Prerequisites: Node 24 (`.nvmrc`), Docker + Docker Compose v2, 8 GiB RAM recommended (running an instance requires 4 GiB, the rest will be used by development tools).

```bash
# Start backing services (Postgres, ClickHouse, Scylla, Redis, HMA, otel-collector)
pnpm run up

# Install all workspace packages from the root (single command — no per-package cd needed)
pnpm install

# Populate .env files for /server and /db, then run migrations
pnpm run db:update -- --env staging --db api-server-pg
pnpm run db:update -- --env staging --db scylla
pnpm run db:update -- --env staging --db clickhouse

# Create organization and admin user (all flags required)
pnpm run create-org -- \
  --name "Test Org" \
  --email "admin@example.com" \
  --website "example.com" \
  --firstName "Admin" \
  --lastName "User" \
  --password "your-password"

# Start dev servers (separate terminals recommended)
pnpm run client:start        # React dev server
pnpm run server:start        # Express + GraphQL API
pnpm run generate:watch      # (optional) watch GraphQL changes
```

Client: http://localhost:3001 · Server: http://localhost:3000

## Testing

Integration tests spin up services via docker compose. Unit tests run in-process.

```bash
# Run all tests (via docker compose)
docker compose run --rm test

# Server unit tests (no Docker)
pnpm --filter server test

# Client unit tests (no Docker)
pnpm --filter client test
```

Lint / format / type-check (no Docker needed):

```bash
pnpm run lint           # lint all packages
pnpm run format         # format all packages
pnpm --filter server run lint
pnpm --filter client run lint
```

If tests fail with database errors, check migration logs via `docker compose logs migrations`.

## CI

CI runs entirely via GitHub Actions (`.github/workflows/apply_pr_checks.yaml`). All PR checks are defined as `docker compose` services so you can reproduce any CI job locally. Run them in your shell (paste-as-is — each command's exit code matches the corresponding CI step's exit code):

```bash
docker compose run --rm codegen-check
docker compose run --rm backend pnpm run lint
docker compose run --rm backend pnpm run build
docker compose run --rm client pnpm run lint
docker compose run --rm client pnpm run build
docker compose run --rm test
```

Individual checks:

| CI job                                   | Local command                                    |
| ---------------------------------------- | ------------------------------------------------ |
| `check_generated_graphql`                | `docker compose run --rm codegen-check`          |
| `check_api_server` (lint)                | `docker compose run --rm backend pnpm run lint`  |
| `check_api_server` (build)               | `docker compose run --rm backend pnpm run build` |
| `run_frontend_checks_if_changed` (lint)  | `docker compose run --rm client pnpm run lint`   |
| `run_frontend_checks_if_changed` (build) | `docker compose run --rm client pnpm run build`  |
| `check_api_server` (test)                | `docker compose run --rm test`                   |

Tear down:

```bash
docker compose down        # stop containers, keep DB volumes
docker compose down -v     # also drop DB volumes (fresh DBs next run)
```

Note: `check_migration_order` runs only in GitHub Actions — it's GitHub-specific and not needed locally. When adding a migration, use `date -u +"%Y.%m.%dT%H.%M.%S"` for the filename prefix.

## Things to know about pnpm

This repo uses **pnpm workspaces** with a single root `pnpm-lock.yaml` (replaces per-package `package-lock.json` files).

**Day-to-day commands:**

```bash
pnpm install                          # install all workspaces from root
pnpm --filter server add <dep>        # add dep to server/package.json
pnpm --filter client add -D <dep>     # add devDep to client/package.json
pnpm --filter server run test         # run a script in one workspace
pnpm -r run build                     # run a script across all workspaces
```

**Supply-chain guards (configured in `pnpm-workspace.yaml`):**
- `minimumReleaseAge: 10080` — pnpm refuses packages published less than 7 days ago. If an install fails with `ERR_PNPM_INVALID_PACKAGE_RELEASE_AGE`, wait or pin an older version.
- `blockExoticSubdeps: true` — transitive deps resolved via git URLs or tarballs are blocked. If a transitive dep uses this, it must be overridden at the root.
- `ignoredBuiltDependencies` / `onlyBuiltDependencies` — postinstall scripts are blocked for unlisted packages. Add new native deps to the appropriate list in `pnpm-workspace.yaml`.

**Lockfile conflicts:**

Never hand-merge `pnpm-lock.yaml`. Take one side and regenerate:

```bash
jj restore --from <rev> pnpm-lock.yaml
pnpm install
```

**Adding a new dependency** still requires human approval (see Human-approval-required actions below). After approval: `pnpm --filter <pkg> add <dep>`, then commit both `<pkg>/package.json` and `pnpm-lock.yaml`.

## Security

- No secrets in code or committed files. Use environment variables via `.env` (gitignored).
- Do not disable lint or type rules to silence errors. Fix the underlying issue, or use a narrowly-scoped `// eslint-disable-next-line <rule>` / `// @ts-expect-error` with a comment explaining why.
- Before adding a new dependency, check it for known CVEs and confirm the license is compatible with `LICENSE` (Apache 2.0).
- Default Docker bindings are `127.0.0.1`; do not change bind addresses without explicit instruction.

## Code review

- Keep diffs small and focused; split unrelated changes into separate PRs.
- PR titles are descriptive and imperative ("Add X", "Fix Y").
- New behavior requires a test. Bug fixes require a regression test.
- All CI checks (above) must pass before requesting review.

## Code style

- **TypeScript:** ESLint + Prettier (configs in `.eslintrc.cjs` and `.prettierrc` per package). Run `pnpm run lint` and `pnpm run format` from root.
- **Naming:** Use camelCase for variables/functions; PascalCase for components/classes; SCREAMING_SNAKE_CASE for constants.
- **GraphQL:** Type-safe resolvers and queries via codegen; never hand-edit `generated.ts`.
- **Imports:** Absolute imports configured via `tsconfig.json` paths; prefer `@/` prefix over relative paths where configured.

## Dependencies

- Dependencies are declared in each package's `package.json` and locked in the root `pnpm-lock.yaml`. Add a dep with `pnpm --filter <pkg> add <dep>` and commit the updated lockfile.
- Every new or upgraded package including transitive dependencies requires human approval. Confirm the license is compatible with `LICENSE` (Apache 2.0) and that there are no known CVEs.
- Lockfile conflict on `pnpm-lock.yaml`: take one side with `jj restore --from <rev> pnpm-lock.yaml`, then run `pnpm install` from root to reconcile.

**Install gotchas:**

CI runs `pnpm install --frozen-lockfile` from root. If it fails with resolution errors, the lockfile has drifted — regenerate against a known-good base:

```bash
jj restore --from main pnpm-lock.yaml
pnpm install
```

**Do not reach for `--legacy-peer-deps`** as a fix — it papers over real peer violations and CI's frozen-lockfile install will fail on the next machine.

## Codespaces

Two things differ from a local dev setup:

1. **Use the production client build**, not the vite dev server: `(cd client && pnpm run build)`, then `pnpm run server:start` serves the built assets. Vite's HMR websocket does not reliably traverse the Codespace port proxy.
2. **Apollo's GraphQL URI must be relative** (`/api/v1/graphql`). Hard-coded `http://localhost:3000/...` breaks because the Codespace proxies to a different host. Source of truth is the `HttpLink` in `client/src/index.tsx`.

## ROOST guiding principles

- **Commands over prose.** Prefer `docker compose run --rm test` over descriptive paragraphs.
- **Same review bar.** PRs authored with agent assistance are held to the same standards as any other PR.
- **Boundaries with alternatives.** When stating a restriction, provide the alternative path (e.g. don't edit `generated.ts` — regenerate via `pnpm run generate`).
- **Iterate over time.** Start minimal. When you give an agent the same instruction twice, add it to this file.
- **Contributors update `AGENTS.md`.** When you find a gap, update this file as part of your PR.

## Human-approval-required actions

Stop and get explicit human approval before:

- Changing license headers, copyright notices, or any legal text (including `LICENSE`).
- Modifying release, signing, or deploy workflows: `.github/workflows/publish-*.yaml`, production Dockerfiles (`Dockerfile`, `client/Dockerfile`), `docker-compose.yaml`, or `package.json` `"scripts"` that affect deployment.
- Database migrations — anything added under `db/src/scripts/<service>/` runs against real data. Confirm schema design and rollback story with a maintainer ensure to use CURRENT_USER to support any user on postgres.
- Deleting or renaming an existing GraphQL type or field — this breaks cached Apollo client state and any downstream consumer. Additive changes are usually safe; removals need a migration plan.
- Rewiring `server/iocContainer` in a way that changes service lifecycles or startup order — cascading effects on tests and boot.
- Auth, session, or request middleware (under `server/api.ts`) — security-sensitive; prefer a small, reviewable PR with explicit callouts.
- Adding, removing, or upgrading any library or package (including transitive dependencies in `pnpm-lock.yaml`) — confirm licenses are compatible with Apache 2.0 and that there are no known CVEs.
- Multi-thousand-line diffs — ROOST policy is that reviewers can digest the change. Split into reviewable PRs; regenerated codegen and lockfile bumps are the only exceptions.

## Commit attribution

Agent-authored commits should include a `Co-Authored-By` trailer naming the agent, e.g.:

```text
Co-Authored-By: <agent-name>
```

Coop is open source and contributions flow upstream; attribution matters for maintainer trust.

## Don't

- Hand-merge `generated.ts` or `pnpm-lock.yaml`.
- Install with `--legacy-peer-deps` as a workaround.
- Use `npm install` / `npm ci` — always use `pnpm`.
- Commit `.env`, credentials, or API keys.
- Bypass `iocContainer` by importing server singletons directly.
- Silently modify a migration file that has already been applied to a shared environment — add a new forward migration instead.
