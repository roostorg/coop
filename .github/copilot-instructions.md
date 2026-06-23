# Code review instructions

These instructions apply to AI tools when they review pull requests in this repository, and when they answer questions about this codebase. They are guidance, not a checklist. Use judgment, prefer fewer high-signal comments over many low-signal ones, and skip points that don't apply to the diff in front of you. For human contributor guidance see [`README.md`](../README.md); for general agent rules see [`AGENTS.md`](../AGENTS.md).

## Repository at a glance

- Node (`.nvmrc`), TypeScript throughout.
- Independent packages, **not an npm workspace** — each has its own `package.json` and lockfile. Main ones: `/` (root), `/server` (Express + Apollo GraphQL, ESM), `/client` (React + Vite + Apollo Client, Ant Design + Tailwind), `/db` (Postgres/ClickHouse/Scylla migration runner), `/migrator` (CLI).
- Server uses BottleJS dependency injection wired in `server/iocContainer/`.
- GraphQL is authored inline in resolvers with `/* GraphQL */` markers and compiled by `npm run generate` into `client/src/graphql/generated.ts` and `server/graphql/generated.ts`. Both `generated.ts` files are codegen output.

## Scope of review — focus on quality and security

Lint and formatting are enforced by ESLint and Prettier in CI (`docker compose run --rm backend npm run lint`, `docker compose run --rm client npm run lint`), so please skip:

- formatting, whitespace, indentation, quote style, or import ordering
- ESLint or Prettier rule violations
- typos in comments or doc grammar nits
- missing JSDoc on internal helpers
- subjective style preferences not codified in a project rule

If a finding would be caught by `npm run lint` or `npm run prettier` (check) / `npm run prettier:fix` (alias `npm run format`), it's redundant.

## Security (cross-cutting)

Security findings are the highest-value comments you can leave. When you spot one, name the risk concretely and suggest a fix. Areas to watch across the whole codebase:

- **Hard-coded secrets.** API keys, tokens, passwords, OAuth secrets, JWT signing keys, DB connection strings, or webhook secrets in source or committed config. Prefer environment variables or a secret manager, fetched close to use.
- **Injection.** String-built SQL, shell commands, file paths, HTML, or LLM prompts are usually a smell. Look for parameterized queries (Knex bindings, prepared statements), argv arrays for `child_process` (avoid `shell: true`), context-aware HTML encoding, and a clear separation between trusted system prompts and untrusted user content.
- **Sensitive logging.** Secrets, JWTs, full `Authorization` headers, full request/response bodies, or PII in logs, traces, metrics labels, or error responses are risky. Error responses shouldn't leak stack traces.
- **Weak crypto.** MD5 or SHA-1 used for security, ECB mode, reused IVs, `Math.random()` for tokens or IDs (prefer `crypto.randomBytes` or `crypto.randomUUID`), or hand-rolled crypto are all worth questioning. JWTs should reject the `none` algorithm, use strong secrets, and have short access-token expirations.
- **Unsafe deserialization or evaluation.** `eval`, `new Function`, `setTimeout`/`setInterval` with string arguments, and `yaml.load` without a safe schema are risky.
- **Removing security controls.** If a diff disables CSRF, CORS, rate limits, authentication, or authorization, ask whether it's intentional and justified.

Path-specific concerns (resolvers, `server/api.ts`, client, raw SQL in ClickHouse/Scylla, migrations, dependency manifests) are scoped in [`.coderabbit.yaml`](../.coderabbit.yaml) under `reviews.path_instructions`. When reviewing those areas, apply the same general principles — ownership checks on resolver-supplied IDs, parameterized queries, XSS care on the client, license/CVE attention on dependency bumps.

## Code quality (cross-cutting)

Use judgment — these patterns tend to cause bugs or maintenance pain regardless of where they appear:

- **Generated files.** `generated.ts` (client and server) is produced by `npm run generate`; hand-edits drift from the GraphQL schema.
- **Error handling.** Silently swallowed errors (`catch {}` with no log or rethrow), unhandled promise rejections, and missing `await` on a promise whose result matters tend to cause production surprises.
- **Async correctness.** `forEach` with an `async` callback doesn't await; `for...of` with `await` or `Promise.all` is usually what's intended. Worth a look when shared state is involved.
- **Type safety.** New `any`, `as unknown as`, non-null assertions (`!`) introduced to silence a real type error, or `@ts-ignore` are worth questioning. `@ts-expect-error` with a justifying comment is preferred when an escape hatch is genuinely needed.
- **Tests.** New behavior generally warrants a test; bug fixes generally warrant a regression test (`AGENTS.md` > "Code review").
- **Duplicated logic.** If a helper already exists in the same package, prefer it over a parallel implementation.
- **Dead code.** Commented-out blocks and TODOs without an issue link are worth a nudge.

## What not to flag

These categories of comments tend to add noise without surfacing real risk — please skip them:

- "Consider adding a null check" on a value already typed as non-null by TypeScript.
- "Consider adding error handling" on a wrapper that already propagates errors via `async`/`await`.
- "This could be a constant" on a string literal used in a single place.
- "Add a JSDoc comment" on an internal helper.
- Rhetorical questions like "have you considered…" without a concrete risk attached.
- Defensive-coding suggestions on values whose types already prevent the failure mode.
- "Add a test" on a config-only, doc-only, or comment-only change.
- Suggestions to rename a symbol "for clarity" without a concrete ambiguity.

## Tone

Be specific and concise. When you flag something, name the concrete risk ("possible SQL injection via string concatenation", "missing authorization check — possible IDOR", "secret logged at info level") and, where helpful, show the fix in code. Skip nits, and stay quiet when nothing in this list applies.
