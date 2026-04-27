# AGENTS.md

For setup, architecture, and concept docs, see [`README.md`](./README.md) and [`/docs`](./docs/).

## Precedence

1. Explicit user prompts override everything.
2. Nearest `AGENTS.md` wins (none nested today, but add one per subproject rather than bloating this file).
3. This file inherits from the ROOST community policy — read it once:
   - [ROOST community `AGENTS.md`](https://github.com/roostorg/community/blob/main/software-development-practices/agents.md) — pan-org agent rules (dependency approval, CI/CD approval, small diffs, PR standards).
   - [ROOST `CONTRIBUTING.md`](https://github.com/roostorg/.github/blob/main/CONTRIBUTING.md) — contribution standards (explainable, reviewable, digestible).

## Orientation

Four independent packages, **not an npm workspace** — each has its own `package.json` and lockfile and must be installed on its own:

- `/` — graphql-codegen, docker compose, root scripts
- `/server` — Express + Apollo GraphQL API (ESM, `"type": "module"`)
- `/client` — React + Vite + Apollo Client frontend
- `/db` — migration runner for Postgres, ClickHouse, Scylla
- `/migrator` -  Package, CLI tool for db migrations.
Node **24** (`.nvmrc`). Running on Node 20 produces `EBADENGINE` warnings and can fail native builds.

## GraphQL codegen — the rule to internalize

`npm run generate` (from root) regenerates:
- `client/src/graphql/generated.ts`
- `server/graphql/generated.ts`

1. **Never hand-edit** either `generated.ts`. Change the schema or operations and regenerate.
2. **Never hand-merge** either `generated.ts` during a rebase/merge. Pick one side with `git checkout --ours|--theirs <file>`, then run `npm run generate` — hand-merging produces output that parses but drifts from the schema.
3. Backend GraphQL is authored inline and tagged with `/* GraphQL */` comments — that's how codegen discovers it. Searching for `gql` or `graphql` alone misses most of it.
4. Same conflict-resolution rule applies to any `package-lock.json`: take one side, then run `npm install` in that package to reconcile.

## Install gotchas

CI runs `npm ci` from root (`.github/workflows/apply_pr_checks.yaml`). If `npm ci` hits `ERESOLVE` in any package, the lockfile has drifted from `package.json` — regenerate it against a known-good base (e.g., `git checkout main -- <pkg>/package-lock.json && (cd <pkg> && npm install)`).

**Do not reach for `--legacy-peer-deps`** as a fix — it papers over real peer violations and CI's `npm ci` will fail on the next agent's machine.

## Codespaces

Two things differ from a local dev setup:

1. **Use the production client build**, not the vite dev server: `(cd client && npm run build)`, then `npm run server:start` serves the built assets. Vite's HMR websocket does not reliably traverse the Codespace port proxy.
2. **Apollo's GraphQL URI must be relative** (`/api/v1/graphql`). Hard-coded `http://localhost:3000/...` breaks because the Codespace proxies to a different host. Source of truth is the `HttpLink` in `client/src/index.tsx`.

## Pre-PR gate

Before pushing, run the repo-wide pre-push check:
```
npm run check:prepush
```
This runs server typecheck + server unit tests + client build + client unit tests. Slower than per-package tests but catches what CI catches. `npm run lint` and `npm run format` are also available from root.

## Server architecture quirk

The server uses [BottleJS](https://github.com/ethanresnick/bottlejs) for dependency injection, wired in `/server/iocContainer`. When adding a service:
- Register it in `iocContainer`, don't export a singleton from the service file.
- Consumers receive dependencies via DI rather than importing directly.

Creating a parallel service that bypasses `iocContainer` will work at runtime but breaks test mocking patterns.

## Stop and ask before

On top of the community-wide list (dependencies, CI/CD, legal text), pause for explicit human approval before:

- **Database migrations** — anything added under `db/src/scripts/<service>/` runs against real data. Confirm schema design and rollback story with a maintainer.
- **Deleting or renaming an existing GraphQL type or field** — this breaks cached Apollo client state and any downstream consumer. Additive changes are usually safe; removals need a migration plan.
- **Rewiring `server/iocContainer`** in a way that changes service lifecycles or startup order — cascading effects on tests and boot.
- **Auth, session, or request middleware** (under `server/api.ts`) — security-sensitive; prefer a small, reviewable PR with explicit callouts.
- **Multi-thousand-line diffs** — ROOST policy is that reviewers can digest the change. Split into reviewable PRs; regenerated codegen and lockfile bumps are the only exceptions.

## Commit attribution

Agent-authored commits should include a `Co-Authored-By` trailer naming the agent, e.g.:
```
Co-Authored-By: <agent-name>
```
Coop is open source and contributions flow upstream; attribution matters for maintainer trust.

## Don't

- Hand-merge `generated.ts` or lockfiles.
- Install with `--legacy-peer-deps` as a workaround.
- Commit `.env`, credentials or API Keys.
- Bypass `iocContainer` by importing server singletons directly.
- Silently modify a migration file that has already been applied to a shared environment — add a new forward migration instead.
