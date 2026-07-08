## Context & Requests for Reviewers

<!-- Briefly describe the changes introduced in this pull request. Link GitHub Issue if available for context on your change. -->

## Tests

<!-- Describe how you tested your changes, including any manual steps or automated tests performed. -->
<!-- Provide screenshots if available -->

## (Optional) Rollout Plan

<!--
Are there any special things that have to be done before this can be deployed
to prod (e.g., other blocking PRs; manual load testing/validation that needs to
be done on staging; etc.)? If so, please note them here.
 -->

## Checklist

_Only check items that apply to this PR; leave the rest unchecked._

- [ ] **If you changed anything user-facing** (i.e. user interface or APIs):
  Did you update the CHANGELOG.md and related docs?

- [ ] **If you changed `server/models/**/{ContentTypeModel,ActionModel,RuleModel,PolicyModel}.ts`:**
  Did you update the corresponding history tables and their triggers?

- [ ] **If you changed `db/src/scripts/**` and used `CREATE TABLE`, `ADD COLUMN`, or `ALTER COLUMN`:**
  Are as many columns marked `NOT NULL` as possible? If some columns can sometimes be null depending on other columns, are there `CHECK` constraints capturing those relationships, and are these also reflected using unions in the associated Kysely types?

- [ ] **If you added a new signal in `server/services/signalsService/signals/**`:**
  Did you classify every error case as a permanent error (`SignalPermanentError`, no retry) or a normal error (retryable)? Any case where the signal can't determine a score should be a `SignalPermanentError`.
