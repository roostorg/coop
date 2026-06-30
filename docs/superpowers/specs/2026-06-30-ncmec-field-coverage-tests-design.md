# NCMEC field-coverage & submission-flow tests

**Date:** 2026-06-30
**Issue:** [#843 — Audit NCMEC fields](https://github.com/roostorg/coop/issues/843)

## Problem

#843 is an audit of NCMEC CyberTip fields. The audit found a recurring bug
class: a field is modeled in our TS `Report`/`FileDetails` types but its
**schema-field-role path is missing**, so for adopters who don't run the
`ncmec_additional_info_endpoint` webhook the field is silently omitted from
the submitted XML. NCMEC then rejects the report as "incomplete" (the
#840/#842 `email` incident) or silently drops it.

The same class produced #869 (out-of-order `fileDetails.ipCaptureEvent`
children → NCMEC `responseCode=4100`).

**Existing coverage:**

| Layer                                                                                                                     | What it covers                                                                   | What it misses                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Unit: `buildSubmitReportObject.test.ts`, `buildSubmitReportParamsFromDecision.test.ts`, `ncmecReporting.builders.test.ts` | Pure builder correctness for specific inputs                                     | Cross-field _coverage_ (which fields appear across configurations); XML _structural_ drift; the full submission flow |
| Integration: `report-flow.integ.test.ts` (CSAM case)                                                                      | The NCMEC **enqueue** path (reported user → review queue)                        | Explicitly excludes the actual `submitReport` HTTP submission                                                        |
| `audit-ncmec-fields.ts` (referenced in #843 comment)                                                                      | Renders XML for `min`/`field-roles`/`max` scenarios into a hand-maintained table | Not in the tree (was on a branch); no assertions; not run in CI                                                      |

**The gap:** nothing mechanically catches (a) a field that disappears from the
`min` configuration, or (b) structural/ordering drift in the rendered XML, or
(c) that field-role-resolved values actually survive the full
`submitReport` flow into the persisted `ncmec_reports.report_xml`.

## Goal

A regression net for the #843 field-gap class plus one integration test that
proves the submission flow produces the XML we think it does.

## Non-goals

- **Not** validating against NCMEC's real CyberTip XSD. NCMEC's XSD is not
  redistributable (it sits behind the ISPWS documentation access wall), so it
  cannot be committed to an Apache-2.0 OSS repo and CI cannot fetch it. We
  lock our _own_ rendered structure instead — drift detection, not schema
  conformance.
- **Not** hitting real `exttest.cybertip.org` in CI. Network-dependent,
  rate-limited, and its "incomplete" quality heuristics are not a stable
  contract to assert against.
- **Not** a Playwright E2E through the reviewer UI. The UI→resolver→service
  hop is already covered by `ncmec.resolver.test.ts`; the cost/benefit for the
  #843 field-gap class is poor.

## Design

Two independent layers.

### Layer 1 — field-coverage scenario tests (unit)

**What:** resurrect the `audit-ncmec-fields` concept as a committed jest test.

Render XML via `buildSubmitReportObject` for three scenarios that mirror the
#843 audit's columns, parse the result with `xml-js` (already a dependency),
and assert per-field presence/absence as a table:

- **`min`** — no schema field roles, no additional-info webhook. This is the
  default for adopters who wire neither, and the configuration that actually
  bit #840/#842.
- **`field-roles`** — every supported schema field role mapped on the item
  types; no webhook.
- **`max`** — field roles + additional-info webhook + escalation +
  top-level `additionalInfo`.

Each row asserts: does element `X` appear in the rendered XML for scenario
`S`? The table encodes the _current intended_ coverage. When someone adds a
field role (e.g. the P1 `phone` from #843), the `min` column flips from
omitted→present and the test fails until the coverage assertion is updated —
making the gap a deliberate, reviewed change rather than a silent omission.

Additionally assert **element ordering** for the sections where NCMEC enforces
sequence (the `#869` class): `fileDetails.ipCaptureEvent` children,
`incidentSummary` children, `personOrUserReported` children. We lock the order
our builder emits, keyed off the NCMEC docs we already used to fix #869.

**Location:** `server/services/ncmecService/fieldCoverage.test.ts` (unit test,
runs under the existing `npm test` jest config, no Docker).

**Fixtures:** reuse the builder-input factories already in
`buildSubmitReportObject.test.ts` (`makeBuildReportInput`) and
`buildSubmitReportParamsFromDecision.test.ts` (user/media item-type
factories). Extract shared factories to a `testHelpers.ts` if duplication
appears; otherwise inline.

**Parsing:** `xml2js`/`xml-js` (already a dep) to convert the compact object
back to a traversable tree for assertions, mirroring what
`buildSubmitReportObject.test.ts`'s "preserves XSD insertion order" case
already does.

### Layer 2 — full `submitReport` flow against a stubbed `fetchHTTP` (integration)

**What:** drive the real `NcmecReporting.submitReport` end-to-end and assert
both the outgoing request shape and the persisted result.

**The interception seam.** `fetchHTTP` is injected into `NcmecReporting`'s
constructor (`ncmecReporting.ts:1352`, `private fetchHTTP:
Dependencies['fetchHTTP']`). A URL-matching library (msw, nock, undici
`MockAgent`) is unnecessary — and `MockAgent` specifically won't work here
because `fetchHTTP` pins its own `dispatcher: agentMapping[query.maxResponseSize]`
on every call (`networkingService/index.ts:308`), bypassing the global
dispatcher. **The stub function is the VCR.**

The stub inspects each outgoing `query` (url, method, headers, body) and
returns a canned `CoopResponse`:

| Intercepted call                                                       | Stub behavior                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST https://exttest.cybertip.org/ispws/submit`                       | Assert body is valid XML; assert Authorization is `Basic …`; assert the field-role-resolved fields (e.g. `email`) are present. Return `reportResponse.responseCode._text='0'`, `reportId._text='999'`. |
| `POST .../ispws/upload`                                                | Return `responseCode._text='0'`, `fileId._text='f1'`.                                                                                                                                                  |
| `POST .../ispws/finish`                                                | Return `responseCode._text='0'`.                                                                                                                                                                       |
| `POST https://tas-infra-ml.net/...` (`getNCMECAdditionalInfo` webhook) | Return canned additional-info (empty IP events, no additional files) so the flow proceeds.                                                                                                             |
| `GET <media url>` (media download for `#upload`)                       | Return a `Readable` stream of fake media bytes.                                                                                                                                                        |

`isTest=true` is passed so the service targets `exttest.cybertip.org` (the URL
the stub matches) and skips the real-report dedup/prior-CT-reports branches
that would otherwise need more fixtures.

**Real everything else.** Uses `makeIntegrationServer()`-style real IoC +
real Postgres (the repo's integration bar — see `report-flow.integ.test.ts` +
`setupIntegrationServer.ts`). Real `ncmec_org_settings` read, real
`ncmec_reporting.ncmec_reports` write, real `getCybertipAuthenticationCredentials`,
real `getNCMECAdditionalInfo` resolution against the stubbed webhook.

**Setup required (per test org):**

- `ncmec_reporting.ncmec_org_settings` row with `username`/`password`,
  `company_template`, `legal_url`, `contact_email`, `default_internet_detail_type`.
  (Reuse/extend existing fixture helpers under `server/test/fixtureHelpers/`.)
- A reported USER item type with schema field roles mapped (email, ipAddress,
  displayName, profileIcon) so Layer 2 can assert those fields land in the XML.
- A media content item type with `createdAt` + `ipAddress` roles and an image
  field carrying `{ url, hashes }` (so `extractHashesForUrl` resolves).

**Assertions:**

1. The `/submit` request body (captured by the stub) contains the
   field-role-resolved `personOrUserReportedPerson.email` (the #840/#842 field)
   and the configured `incidentType`.
2. After the flow completes, a row exists in
   `ncmec_reporting.ncmec_reports` with `report_id='999'`,
   `is_test=true`, and `report_xml` containing the same resolved email.
3. The full NCMEC protocol sequence was observed: `/submit` → `/upload`(s) →
   `/finish`, in order (tracked in the stub).
4. `submitReport` returns `'SUCCESS'`.

**Location:** `server/test/integ/ncmec-submission.integ.test.ts` (runs under
`jest.integ.config.cjs` via `npm run test:integ`, requires
`npm run up && npm run db:update`).

**Cleanup:** follow the `report-flow.integ.test.ts` convention — unique
`orgId` per `describe`, `afterAll` runs each cleanup step best-effort,
`harness.shutdown()` last. Delete the `ncmec_org_settings` row and reported
items/types created for the scenario.

## What this catches

- A field-role path that silently stops populating a field (#840/#842 class).
- Structural/ordering drift in the rendered XML (#869 class).
- The full submission protocol breaking (auth, dedup, upload sequence,
  persistence) — a class the builder unit tests structurally cannot cover.
- Field-role-resolved values failing to survive into the persisted
  `report_xml`.

## What this does not catch

- True XSD conformance (we can't commit NCMEC's schema). Drift detection only.
- The reviewer UI → resolver hop (already covered).
- Production `report.cybertip.org` routing (the `isTest=false` branch); the
  test exercises `isTest=true`. The only `isTest`-gated logic is dedup and
  prior-CT-reports, both intentionally out of scope.

## Open questions for review

1. **Layer 1 fixture sharing.** Extract shared builder-input factories to a
   `ncmecService/testHelpers.ts`, or inline per test file? I lean extract only
   if duplication actually appears.
2. **Layer 2 org-settings fixture.** Is there an existing fixture helper for
   `ncmec_org_settings`, or does one need creating? (I saw none in
   `server/test/fixtureHelpers/`.) If none, this design includes creating one.
3. **Scenario table maintenance.** Layer 1's table is a hand-maintained
   assertion list. Acceptable as the regression net, or should it be generated
   from the TS `Report`/`FileDetails` types? I lean hand-maintained —
   generated-from-types would assert "the type has a field," not "the field is
   populated," which is the actual #843 concern.
