# Configuration Write Stack Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement each layer, then inspect its diff and run focused verification before proceeding.

**Goal:** Add globally enforced item-type safeguards before REST create/update operations, stacked above read API PR #1144.

**Architecture:** ModerationConfigService owns validation and atomic persistence. GraphQL and REST call that service; the item-type editor prevents unsupported edits. Keep ownership refactoring separate from behavior changes.

**Tech Stack:** TypeScript, Kysely/PostgreSQL, GraphQL, Express, React, Jest, Vitest.

## Constraints

- Work only in the isolated `coop-read-api-rebase` worktree. Do not touch other worktrees or shared test databases/services.
- Preserve the current read APIs, including omission of organization IDs and action credentials.
- Do not add deletion endpoints, dependencies, migrations, or change authentication middleware.
- Use opaque IDs and existing static identifiers. No name filtering, reconciliation, or optimistic concurrency.
- Regenerate GraphQL output; never hand-edit it. Keep docs concise.
- Review the earlier local implementation as reference, not as the source of current files.

## 1. Hidden-field ownership refactor

- [x] Move hidden-field persistence from ManualReviewToolService to ModerationConfigService, retaining existing semantics.
- [x] Route GraphQL reads/writes through the new owner; preserve nonempty-only mutation writes in this layer.
- [x] Recover resolver and persistence regression coverage. Run in-process resolver tests and server typecheck.
- [x] Commit on `refactor/configuration-hidden-fields` above `add-configuration-read-api`.

## 2. Item-type service safeguards

Files: `server/services/moderationConfigService/{errors.ts,index.ts,moderationConfigService.ts,moderationConfigService.test.ts}` and `modules/{ItemTypeOperations.ts,itemTypeSchemaValidation.ts,itemTypeSchemaValidation.test.ts}`.

- [x] Add regression tests for removed/renamed fields, scalar/container changes, required tightening, optional additions, and required relaxation. Use the earlier validator tests as reference.
- [x] Enforce validation on the persisted schema under a transaction/row lock; scope lookup by organization and kind.
- [x] Validate the complete resulting field-role mapping and hidden-field list. Preserve omitted settings and clear explicit empty hidden-field arrays.
- [x] Persist schema, roles, and hidden fields atomically. Ensure standalone visibility updates cannot bypass validation; preserve deletion cleanup.
- [x] Run pure validator tests and typecheck. Add DB regressions without running against shared databases.
- [x] Commit this service layer separately if combining it with GraphQL/UI would make the PR too large.

## 3. GraphQL and editor integration

Files: `server/graphql/modules/itemType{.ts,.resolver.test.ts}`, generated GraphQL outputs, and `client/src/webpages/dashboard/item_types/ItemTypeForm*.tsx` with focused tests.

- [x] Pass hidden fields in the same service mutation instead of a second write; expose useful domain errors through existing GraphQL error patterns.
- [x] Lock persisted field names/types/containers and deletion; prevent optional-to-required changes and new required fields on existing types. Keep roles and visibility editable without changing persisted types.
- [x] Regenerate GraphQL and run resolver/component checks. Inspect rendered affected controls and error handling where practical.
- [x] Add a concise changelog entry and commit above the service layer.

## 4. REST creates and updates

Files: existing route owners under `server/routes/{policies,item_types,action}`, their tests, moderation service policy/action operations, and `docs/api/`.

- [x] Resolve route placement against the current API: `POST /actions` already executes actions and must remain unchanged. Create custom actions at `POST /actions/custom`.
- [x] Add strict create/PATCH validation and service calls. Omitted properties remain unchanged; explicit null clears nullable properties; arrays replace. Reject client-supplied IDs, unknown fields, and built-in action mutations.
- [x] Preserve user authorization for GraphQL policy mutations while representing authenticated API-key actors explicitly. Validate same-organization policy/action references.
- [x] Test output/status/error contracts, organization isolation, partial updates, and immutable fields. Return public resource objects without organization IDs or credentials.
- [x] Update concise API docs and changelog; run focused tests, lint, typecheck and generated-output checks.
- [x] Commit above the safety layers.
- [ ] Publish and link the resulting PRs after resolving the cross-fork limitation.

## Publishing and verification limits

The read API branch and PR #1144 remain untouched. The new local chain is
`refactor/configuration-hidden-fields` → `safety/item-type-configuration` →
`safety/item-type-editor` → `safety/configuration-relations` →
`feat/configuration-write-api`. Separate safety layers keep individual diffs reviewable.

GitHub stacks do not support cross-fork PRs. Publishing needs a repository
decision; do not move or recreate PR #1144. Add changelog PR links once the new
PRs exist. Database-backed tests remain unexecuted to avoid shared services;
the HTTP tests use actual middleware and handlers with stubbed services.

Final checks: 155 focused server tests, 11 client tests, server typecheck,
client typechecks/build, and both package linters passed (existing warnings).
GraphQL regeneration produces no diff. The isolated field-component preview
was rendered and inspected. Full authenticated UI and database concurrency
tests have not been run.
