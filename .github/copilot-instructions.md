# Code review instructions

These instructions apply to AI tools when they review pull requests in this repository, and when they answer questions about this codebase. They are guidance, not a checklist use judgment, prefer fewer high-signal comments over many low-signal ones, and skip points that don't apply to the diff in front of you. For human contributor guidance see [`README.md`](../README.md); for general agent rules see [`AGENTS.md`](../AGENTS.md).

## Repository at a glance

- Node (`.nvmrc`), TypeScript throughout.
- Four independent packages, **not an npm workspace**: `/` (root), `/server` (Express + Apollo GraphQL, ESM), `/client` (React + Vite + Apollo Client, Ant Design + Tailwind), `/db` (Postgres/ClickHouse/Scylla migration runner), `/migrator` (CLI).
- Server uses BottleJS dependency injection wired in `server/iocContainer/`.
- GraphQL is authored inline in resolvers with `/* GraphQL */` markers and compiled by `npm run generate` into `client/src/graphql/generated.ts` and `server/graphql/generated.ts`. Both `generated.ts` files are codegen output.

## Scope of review — focus on quality and security

Lint and formatting are enforced by ESLint and Prettier in CI (`docker compose run --rm backend npm run lint`, `docker compose run --rm client npm run lint`), so please skip:

- formatting, whitespace, indentation, quote style, or import ordering
- ESLint or Prettier rule violations
- typos in comments or doc grammar nits
- missing JSDoc on internal helpers
- subjective style preferences not codified in a project rule

If a finding would be caught by `npm run lint` or `npm run format`, it's redundant.

## Security

Security findings are the highest-value comments you can leave. When you spot one, name the risk concretely and suggest a fix. Areas worth paying attention to:

- **Hard-coded secrets.** API keys, tokens, passwords, OAuth secrets, JWT signing keys, DB connection strings, or webhook secrets in source or committed config. Prefer environment variables or a secret manager, fetched close to use.
- **Injection.** String-built SQL, shell commands, file paths, HTML, or LLM prompts are usually a smell. Look for parameterized queries (Knex bindings, prepared statements), argv arrays for `child_process` (avoid `shell: true`), context-aware HTML encoding, and a clear separation between trusted system prompts and untrusted user content. Raw SQL in `server/clickhouse/` and Cassandra calls in Scylla code should still use bound parameters.
- **Unvalidated input.** GraphQL resolver arguments, REST handler bodies, query params, file uploads, and headers benefit from server-side validation beyond schema-shape checks — lengths, ranges, allowlists, canonicalization. Be wary of null bytes and un-normalized Unicode in comparisons.
- **Authorization gaps / IDOR.** When a resolver, mutation, or route touches user- or tenant-scoped data, check that the caller is allowed to access _that specific resource_, not just that they're logged in. Accepting an ID from the client without an ownership/permission check is worth calling out.
- **Auth, session, CSRF, CORS, or rate-limit changes** in `server/api.ts` or request middleware are security-sensitive (`AGENTS.md` requires a maintainer for these). Worth flagging even when the diff is small.
- **Sensitive logging.** Secrets, JWTs, full `Authorization` headers, full request/response bodies, or PII in logs, traces, metrics labels, or error responses are risky. Error responses shouldn't leak stack traces.
- **Weak crypto.** MD5 or SHA-1 used for security, ECB mode, reused IVs, `Math.random()` for tokens or IDs (prefer `crypto.randomBytes` or `crypto.randomUUID`), or hand-rolled crypto are all worth questioning. JWTs should reject the `none` algorithm, use strong secrets, and have short access-token expirations.
- **Token storage.** Auth tokens generally belong in HttpOnly, Secure, SameSite cookies rather than `localStorage` or `sessionStorage`.
- **Open redirects.** Redirecting to a user-supplied URL without an allowlist is a common pitfall.
- **XSS in the client.** `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, unsanitized `href`/`src` derived from user input, and `javascript:` URLs are worth a look. Prefer `textContent`; sanitize with DOMPurify when raw HTML is unavoidable.
- **Unsafe deserialization or evaluation.** `eval`, `new Function`, `setTimeout`/`setInterval` with string arguments, and `yaml.load` without a safe schema are risky.
- **Removing security controls.** If a diff disables CSRF, CORS, rate limits, authentication, or authorization, ask whether it's intentional and justified.
- **Dependency changes.** Additions, removals, or upgrades in a `package.json` or `package-lock.json` (including transitive bumps) need human approval for license (Apache 2.0 compatibility) and CVE review per `AGENTS.md` > "Human-approval-required actions". Worth surfacing so reviewers don't miss them.

## Code quality

Use judgment here — these are patterns that tend to cause bugs or maintenance pain in this codebase:

- **Dependency injection.** Server code generally consumes services through `server/iocContainer/` rather than importing singletons directly, since direct imports break test mocking.
- **Generated files.** `generated.ts` (client and server) is produced by `npm run generate`; hand-edits drift from the GraphQL schema.
- **GraphQL N+1.** Resolvers that query inside a loop are usually better as a batched DataLoader call or a single query.
- **Error handling.** Silently swallowed errors (`catch {}` with no log or rethrow), unhandled promise rejections, and missing `await` on a promise whose result matters tend to cause production surprises.
- **Async correctness.** `forEach` with an `async` callback doesn't await; `for...of` with `await` or `Promise.all` is usually what's intended. Worth a look when shared state is involved.
- **Type safety.** New `any`, `as unknown as`, non-null assertions (`!`) introduced to silence a real type error, or `@ts-ignore` are worth questioning. `@ts-expect-error` with a justifying comment is preferred when an escape hatch is genuinely needed.
- **Public API stability.** Removing or renaming a GraphQL type or field breaks Apollo cache and downstream consumers. Additive changes are usually safe; removals deserve a migration plan.
- **Database migrations.** Files under `db/src/scripts/<service>/` are typically forward-only, idempotent where possible, and use `CURRENT_USER` for Postgres role grants. Editing a migration that has already shipped is a red flag — a new forward migration is usually the right path. New migration filenames use the `date -u +"%Y.%m.%dT%H.%M.%S"` prefix.
- **Tests.** New behavior generally warrants a test; bug fixes generally warrant a regression test (`AGENTS.md` > "Code review").
- **Duplicated logic.** If a helper already exists in the same package, prefer it over a parallel implementation.
- **Dead code.** Commented-out blocks and TODOs without an issue link are worth a nudge.

## Tone

Be specific and concise. When you flag something, name the concrete risk ("possible SQL injection via string concatenation", "missing authorization check — possible IDOR", "secret logged at info level") and, where helpful, show the fix in code. Skip nits, and stay quiet when nothing in this list applies.
