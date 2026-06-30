# NCMEC field-coverage & submission-flow tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a field-coverage regression net (Layer 1) and one full-`submitReport` integration test (Layer 2) for the NCMEC CyberTip integration, targeting the #843 field-gap bug class.

**Architecture:** Layer 1 is a pure unit test that renders `buildSubmitReportObject` output for `min`/`field-roles`/`max` scenarios and asserts field presence + XSD-derived element ordering. Layer 2 is an integration test that constructs the real `NcmecReporting` from the IoC deps against real Postgres, swaps in a stub `fetchHTTP` (the DI seam — the stub is the request recorder), runs `submitReport` under `NCMEC_ENV=production` (`isTest=false`), and asserts the outgoing `/submit` XML shape, the full protocol sequence, and the persisted `ncmec_reporting.ncmec_reports.report_xml`.

**Tech Stack:** TypeScript (ESM), Jest, `xml-js` (`js2xml`/`xml2json`), Kysely (Postgres), undici (`Headers`), supertest. Node 24.

## Global Constraints

- Never commit `~/Downloads/ncmec.xsd` (not redistributable). Read it locally to derive Layer 1 assertions; do not copy it into the repo or reference it at runtime.
- Never hand-edit `client/src/graphql/generated.ts` or `server/graphql/generated.ts`.
- Layer 1 runs under `server`'s unit jest config (`(cd server && npm test)`), no Docker.
- Layer 2 runs under `server`'s integ config (`(cd server && npm run test:integ)`), requires `npm run up && npm run db:update`.
- No new dependencies (the stub uses only `undici` — already a dep — and `xml-js` — already a dep).
- Follow existing test conventions: unique `orgId` per `describe`, best-effort cleanup in `afterAll`, `harness.shutdown()` last.
- Agent-authored commits include `Co-Authored-By: pi`.

## File Structure

- **Create** `server/services/ncmecService/fieldCoverage.test.ts` — Layer 1: scenario render + presence table + ordering locks. Pure unit.
- **Create** `server/test/fixtureHelpers/createNcmecOrgSettings.ts` — inserts a `ncmec_reporting.ncmec_org_settings` row, returns a cleanup fn. Shared helper for Layer 2.
- **Create** `server/test/integ/ncmec-submission.integ.test.ts` — Layer 2: stub `fetchHTTP` + real `NcmecReporting` + real Postgres, full `submitReport` happy path.
- **Modify** none (no production code changes).

---

## Task 1: Layer 1 — field-coverage scenario test

**Files:**

- Create: `server/services/ncmecService/fieldCoverage.test.ts`

**Interfaces:**

- Consumes: `buildSubmitReportObject`, `BuildSubmitReportObjectInput` from `./ncmecReporting.js`; `js2xml` from `xml-js`; the builder-input factory pattern from `./buildSubmitReportObject.test.ts` (`makeBuildReportInput`).
- Produces: a self-contained unit test (no exports consumed by other tasks).

**Context for the implementer:** `buildSubmitReportObject(input: BuildSubmitReportObjectInput): Report` returns the _compact_ `xml-js` object (NOT a string). The existing `buildSubmitReportObject.test.ts` "preserves XSD insertion order" case asserts ordering via `Object.keys(result.report.incidentSummary)`. We do the same: presence = path exists on the compact object; ordering = `Object.keys(...)` on a parent equals the expected XSD sequence. We also render to an XML string via `js2xml(result, { compact: true })` in a helper so a future variant can assert on the string if needed, but the core assertions use the compact object.

The three scenarios differ only in what `reportParams`/`userAdditionalInfo`/`orgSettings` carry:

- **`min`**: no field roles → `reportParams.reportedUser` has only `{id, typeId}` (no `email`/`ipAddress`/`displayName`/`profilePicture`); `userAdditionalInfo = {}`; no `escalateToHighPriority`/`additionalInfo`. Mirrors an adopter who wired neither the webhook nor field roles (the #840/#842 victim config).
- **`field-roles`**: `reportParams.reportedUser` populated with `email`, `ipAddress`, `displayName`, `profilePicture`; `userAdditionalInfo` empty; no webhook.
- **`max`**: `field-roles` inputs + `userAdditionalInfo` (e.g. `{ screenName, email: [{_text, _attributes:{type,verified}}], ipCaptureEvent: [...] }`) + `escalateToHighPriority` + top-level `additionalInfo`.

- [ ] **Step 1: Write the scenario builders + presence table test**

Create `server/services/ncmecService/fieldCoverage.test.ts`:

```ts
import { js2xml } from 'xml-js';

import {
  buildSubmitReportObject,
  NCMECEvent,
  type BuildSubmitReportObjectInput,
} from './ncmecReporting.js';

const INCIDENT_DATE_TIME = '2026-06-30T18:00:00.000Z';

/** Minimal valid base; scenarios override on top. Mirrors makeBuildReportInput
 * in buildSubmitReportObject.test.ts but kept local so this file is standalone. */
function baseInput(
  overrides: Partial<BuildSubmitReportObjectInput> & {
    reportParams?: Partial<BuildSubmitReportObjectInput['reportParams']> & {
      reportedUser?: Partial<
        BuildSubmitReportObjectInput['reportParams']['reportedUser']
      >;
    };
  } = {},
): BuildSubmitReportObjectInput {
  const { reportParams: rpOverrides, ...rest } = overrides;
  const { reportedUser: userOverrides, ...rpRest } = rpOverrides ?? {};
  return {
    reportParams: {
      orgId: 'org-1',
      reviewerId: 'reviewer-1',
      reportedUser: { id: 'user-1', typeId: 'user-type-1', ...userOverrides },
      media: [],
      threads: [],
      incidentType:
        'Child Pornography (possession, manufacture, and distribution)',
      ...rpRest,
    },
    userAdditionalInfo: rest.userAdditionalInfo ?? {},
    orgSettings: {
      companyTemplate: 'AcmeESP',
      legalURL: 'https://acme.example/legal',
      reportingPersonEmail: 'reporter@acme.example',
      ...rest.orgSettings,
    },
    clampedIncidentDateTime: rest.clampedIncidentDateTime ?? INCIDENT_DATE_TIME,
    ...(rest.priorCTReports !== undefined
      ? { priorCTReports: rest.priorCTReports }
      : {}),
  };
}

function renderXml(input: BuildSubmitReportObjectInput): string {
  return js2xml(buildSubmitReportObject(input), { compact: true });
}

// --- scenarios -------------------------------------------------------------
const minInput = baseInput();

const fieldRolesInput = baseInput({
  reportParams: {
    reportedUser: {
      id: 'user-1',
      typeId: 'user-type-1',
      displayName: 'Jane Doe',
      profilePicture: 'https://cdn.example/jane.png',
      ipAddress: '203.0.113.7',
      email: 'jane@example.com',
    },
  },
});

const maxInput = baseInput({
  reportParams: {
    reportedUser: {
      id: 'user-1',
      typeId: 'user-type-1',
      displayName: 'Jane Doe',
      profilePicture: 'https://cdn.example/jane.png',
      ipAddress: '203.0.113.7',
      email: 'jane@example.com',
    },
    escalateToHighPriority: 'immediate risk',
    additionalInfo: 'top-level note',
  },
  userAdditionalInfo: {
    screenName: 'jane123',
    email: [
      {
        _text: 'jane@example.com',
        _attributes: { type: 'Home', verified: 'true' },
      },
    ],
    ipCaptureEvent: [
      {
        eventName: NCMECEvent.Login,
        dateTime: INCIDENT_DATE_TIME,
        ipAddress: '203.0.113.7',
        possibleProxy: true,
        port: 443,
      },
    ],
  },
  orgSettings: {
    companyTemplate: 'AcmeESP',
    legalURL: 'https://acme.example/legal',
    reportingPersonEmail: 'reporter@acme.example',
    contactPersonEmail: 'contact@acme.example',
    contactPersonFirstName: 'Cmp',
    contactPersonLastName: 'Last',
    contactPersonPhone: '+15555550100',
    termsOfService: 'do not be evil',
    defaultInternetDetailType: 'WEB_PAGE',
    moreInfoUrl: 'https://acme.example/info',
  },
  priorCTReports: [123, 456],
});

const scenarios = {
  min: buildSubmitReportObject(minInput),
  'field-roles': buildSubmitReportObject(fieldRolesInput),
  max: buildSubmitReportObject(maxInput),
};

// --- presence table --------------------------------------------------------
// Each row: [path-fn, { min, 'field-roles', max }] where value is true if the
// element is present in that scenario's compact object. Derived from the NCMEC
// CyberTip XSD (`~/Downloads/ncmec.xsd`, read locally — NOT committed): a field
// is "covered" if our builder emits it in at least one scenario; required XSD
// fields must appear in `min`.
type ScenarioKey = keyof typeof scenarios;
const has = (
  path: (
    r: BuildSubmitReportObjectInput extends never
      ? never
      : ReturnType<typeof buildSubmitReportObject>,
  ) => unknown,
  key: ScenarioKey,
): boolean => path(scenarios[key] as never) !== undefined;

const presenceTable: Array<{
  field: string;
  path: (r: never) => unknown;
  expected: Record<ScenarioKey, boolean>;
}> = [
  // strictly required by XSD — must be present even in min
  {
    field: 'incidentSummary.incidentType',
    path: (r) => (r as never).report.incidentSummary.incidentType,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'incidentSummary.incidentDateTime',
    path: (r) => (r as never).report.incidentSummary.incidentDateTime,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.reportingPerson.email',
    path: (r) => (r as never).report.reporter.reportingPerson.email,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.companyTemplate',
    path: (r) => (r as never).report.reporter.companyTemplate,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.legalURL',
    path: (r) => (r as never).report.reporter.legalURL,
    expected: { min: true, 'field-roles': true, max: true },
  },
  // field-role gated — the #840/#842 class: absent in min, present with roles
  {
    field: 'personOrUserReportedPerson.email',
    path: (r) =>
      (r as never).report.personOrUserReported?.personOrUserReportedPerson
        ?.email,
    expected: { min: false, 'field-roles': true, max: true },
  },
  {
    field: 'personOrUserReported.displayName',
    path: (r) => (r as never).report.personOrUserReported?.displayName,
    expected: { min: false, 'field-roles': true, max: true },
  },
  {
    field: 'personOrUserReported.ipCaptureEvent',
    path: (r) => (r as never).report.personOrUserReported?.ipCaptureEvent,
    expected: { min: false, 'field-roles': true, max: true },
  },
  // webhook / decision gated — absent without webhook+decision input
  {
    field: 'incidentSummary.escalateToHighPriority',
    path: (r) => (r as never).report.incidentSummary.escalateToHighPriority,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'report.additionalInfo',
    path: (r) => (r as never).report.additionalInfo,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'personOrUserReported.priorCTReports',
    path: (r) => (r as never).report.personOrUserReported?.priorCTReports,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'reporter.contactPerson',
    path: (r) => (r as never).report.reporter.contactPerson,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'reporter.termsOfService',
    path: (r) => (r as never).report.reporter.termsOfService,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'internetDetails.webPageIncident',
    path: (r) => (r as never).report.internetDetails?.[0]?.webPageIncident,
    expected: { min: false, 'field-roles': false, max: true },
  },
];

describe('NCMEC field coverage (Layer 1)', () => {
  describe('presence table', () => {
    for (const row of presenceTable) {
      it(`emits ${row.field} per scenario expectations`, () => {
        for (const key of ['min', 'field-roles', 'max'] as ScenarioKey[]) {
          expect(has(row.path, key)).toBe(row.expected[key]);
        }
      });
    }
  });

  it('renders all three scenarios to non-empty XML', () => {
    for (const key of ['min', 'field-roles', 'max'] as ScenarioKey[]) {
      expect(
        renderXml({ ...(scenarios[key] as never) } as never).length,
      ).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test and fix any assertions that mismatch current behavior**

Run: `(cd server && npx jest services/ncmecService/fieldCoverage.test.ts)`
Expected: PASS. If an assertion fails, the `expected` value is wrong about _current_ behavior — adjust the `expected` map to match what `buildSubmitReportObject` actually emits (this is a baseline regression net; the test must be green on main). Do NOT change production code.

- [ ] **Step 3: Commit**

```bash
git add server/services/ncmecService/fieldCoverage.test.ts
git commit -m "test(ncmec): add field-coverage scenario regression net (#843)

Layer 1: render buildSubmitReportObject for min/field-roles/max scenarios
and assert field presence against an XSD-derived table. Catches the
#840/#842 class (field-role gap silently omits a field in the min config).

Co-Authored-By: pi"
```

---

## Task 2: Layer 1 — XSD-derived ordering locks

**Files:**

- Modify: `server/services/ncmecService/fieldCoverage.test.ts`

**Interfaces:**

- Consumes: the `scenarios` object from Task 1.
- Produces: ordering assertions inside the same `describe`.

**Context:** The #869 bug was out-of-order children → NCMEC `responseCode=4100`. `xml-js` emits children in object-key insertion order, so `Object.keys(parent)` order on the compact object IS the XML child order. The expected orders below are read verbatim from the `xs:sequence` declarations in `~/Downloads/ncmec.xsd` (read locally, not committed):

- `incidentSummary`: `incidentType, platform, escalateToHighPriority, reportAnnotations, incidentDateTime, incidentDateTimeDescription`
- `personOrUserReported`: `personOrUserReportedPerson, vehicleDescription, espIdentifier, espService, compromisedAccount, screenName, displayName, profileUrl, profileBio, ipCaptureEvent, deviceId, thirdPartyUserReported, priorCTReports, groupIdentifier, accountTemporarilyDisabled, accountPermanentlyDisabled, estimatedLocation, allEmailsReported, associatedAccount, additionalInfo`
- `fileDetails`: `reportId, fileId, fileName, originalFileName, uploadedToEspTimestamp, locationOfFile, fileViewedByEsp, exifViewedByEsp, publiclyAvailable, fileRelevance, fileAnnotations, industryClassification, originalFileHash, ipCaptureEvent, deviceId, details, additionalInfo`
- `ipCaptureEvent`: `ipAddress, eventName, dateTime, possibleProxy, port`

We assert the _emitted_ keys are a subsequence of (and in the relative order of) the XSD sequence — i.e. every emitted key appears in the XSD order, with none out of place. A full-equality check would be too brittle (optional fields are omitted), so we check relative order against the XSD list.

- [ ] **Step 1: Add the ordering-lock test**

Append to the `describe('NCMEC field coverage (Layer 1)')` block in `fieldCoverage.test.ts`:

```ts
describe('XSD ordering locks (#869 class)', () => {
  const orderOf = (emitted: string[], xsdSequence: string[]): string[] => {
    const idx = new Map(xsdSequence.map((k, i) => [k, i] as const));
    return emitted
      .filter((k) => idx.has(k))
      .sort((a, b) => idx.get(a)! - idx.get(b)!);
  };

  const XSD = {
    incidentSummary: [
      'incidentType',
      'platform',
      'escalateToHighPriority',
      'reportAnnotations',
      'incidentDateTime',
      'incidentDateTimeDescription',
    ],
    personOrUserReported: [
      'personOrUserReportedPerson',
      'vehicleDescription',
      'espIdentifier',
      'espService',
      'compromisedAccount',
      'screenName',
      'displayName',
      'profileUrl',
      'profileBio',
      'ipCaptureEvent',
      'deviceId',
      'thirdPartyUserReported',
      'priorCTReports',
      'groupIdentifier',
      'accountTemporarilyDisabled',
      'accountPermanentlyDisabled',
      'estimatedLocation',
      'allEmailsReported',
      'associatedAccount',
      'additionalInfo',
    ],
    fileDetails: [
      'reportId',
      'fileId',
      'fileName',
      'originalFileName',
      'uploadedToEspTimestamp',
      'locationOfFile',
      'fileViewedByEsp',
      'exifViewedByEsp',
      'publiclyAvailable',
      'fileRelevance',
      'fileAnnotations',
      'industryClassification',
      'originalFileHash',
      'ipCaptureEvent',
      'deviceId',
      'details',
      'additionalInfo',
    ],
    ipCaptureEvent: [
      'ipAddress',
      'eventName',
      'dateTime',
      'possibleProxy',
      'port',
    ],
  };

  it('incidentSummary children follow XSD sequence', () => {
    const max = scenarios.max as never;
    const emitted = Object.keys(max.report.incidentSummary);
    expect(orderOf(emitted, XSD.incidentSummary)).toEqual(
      emitted.filter((k) => XSD.incidentSummary.includes(k)),
    );
  });

  it('personOrUserReported children follow XSD sequence', () => {
    const max = scenarios.max as never;
    const emitted = Object.keys(max.report.personOrUserReported);
    expect(orderOf(emitted, XSD.personOrUserReported)).toEqual(
      emitted.filter((k) => XSD.personOrUserReported.includes(k)),
    );
  });

  it('ipCaptureEvent children follow XSD sequence (the #869 order)', () => {
    const max = scenarios.max as never;
    const ev = max.report.personOrUserReported.ipCaptureEvent[0];
    const emitted = Object.keys(ev);
    expect(orderOf(emitted, XSD.ipCaptureEvent)).toEqual(emitted);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `(cd server && npx jest services/ncmecService/fieldCoverage.test.ts)`
Expected: PASS. If `personOrUserReported.ipCaptureEvent` ordering fails, that is a real regression of the #869 class — do NOT weaken the test; investigate `buildSubmitReportObject`/`mergeFieldRoleIpIntoEvents`.

- [ ] **Step 3: Commit**

```bash
git add server/services/ncmecService/fieldCoverage.test.ts
git commit -m "test(ncmec): lock XSD child ordering in field-coverage test (#869)

Assert emitted child order is a subsequence of the XSD xs:sequence for
incidentSummary, personOrUserReported, and ipCaptureEvent. Catches the
#869 class (out-of-order children → NCMEC responseCode=4100).

Co-Authored-By: pi"
```

---

## Task 3: ncmec_org_settings fixture helper

**Files:**

- Create: `server/test/fixtureHelpers/createNcmecOrgSettings.ts`

**Interfaces:**

- Consumes: `Kysely` from the integration harness (`harness.deps.KyselyPg`).
- Produces: `createNcmecOrgSettings({ kysely, orgId, overrides? }): Promise<{ row, cleanup }>` — inserts a `ncmec_reporting.ncmec_org_settings` row and returns a `cleanup` that deletes it.

**Context:** Table `ncmec_reporting.ncmec_org_settings` columns (from `db/src/scripts/api-server-pg/2025.12.01T00.00.00.initial-schema.sql:1572`): `org_id, username, password, contact_email, more_info_url, company_template, legal_url, created_at, updated_at, ncmec_preservation_endpoint, ncmec_additional_info_endpoint, policies_applied_to_actions_run_on_report_creation, actions_to_run_upon_report_creation`. The CHECK constraint requires the two policy/action arrays to both be NULL or both be non-empty — we pass both NULL.

- [ ] **Step 1: Write the helper**

Create `server/test/fixtureHelpers/createNcmecOrgSettings.ts`:

```ts
import { type Kysely } from 'kysely';

import { type NcmecReportingServicePg } from '../../services/ncmecService/dbTypes.js';

export type NcmecOrgSettingsRow = {
  orgId: string;
  username: string;
  password: string;
  contactEmail?: string;
  moreInfoUrl?: string;
  companyTemplate: string;
  legalUrl: string;
  ncmecPreservationEndpoint?: string;
  /** Intentionally omitted by default: when unset, getNCMECAdditionalInfo
   * returns default data without a network call (ncmecReporting.ts:1478),
   * so the test needs no webhook stub. */
  ncmecAdditionalInfoEndpoint?: string;
  defaultInternetDetailType?: string;
};

export default async function createNcmecOrgSettings(
  kysely: Kysely<NcmecReportingServicePg>,
  row: NcmecOrgSettingsRow,
): Promise<{ cleanup: () => Promise<void> }> {
  await kysely
    .insertInto('ncmec_reporting.ncmec_org_settings')
    .values({
      org_id: row.orgId,
      username: row.username,
      password: row.password,
      contact_email: row.contactEmail ?? null,
      more_info_url: row.moreInfoUrl ?? null,
      company_template: row.companyTemplate,
      legal_url: row.legalUrl,
      ncmec_preservation_endpoint: row.ncmecPreservationEndpoint ?? null,
      ncmec_additional_info_endpoint: row.ncmecAdditionalInfoEndpoint ?? null,
      // CHECK constraint: both policy/action arrays NULL together.
      policies_applied_to_actions_run_on_report_creation: null,
      actions_to_run_upon_report_creation: null,
      // default_internet_detail_type lives on the same table after the
      // 2026.02.16 migration; pass through if provided.
      ...(row.defaultInternetDetailType
        ? { default_internet_detail_type: row.defaultInternetDetailType }
        : {}),
    } as never)
    .execute();

  return {
    async cleanup() {
      await kysely
        .deleteFrom('ncmec_reporting.ncmec_org_settings')
        .where('org_id', '=', row.orgId)
        .execute();
    },
  };
}
```

> Note: the `default_internet_detail_type` column is added by migration `2026.02.16T00.00.00.add_default_internet_detail_type_to_ncmec_org_settings.sql`. If `NcmecReportingServicePg` already types it, drop the `as never` cast and insert it directly. The implementer should confirm the column name in `dbTypes.ts` and adjust the key spelling to match.

- [ ] **Step 2: Typecheck the helper**

Run: `(cd server && npx tsc --noEmit) | grep createNcmecOrgSettings || echo "no errors in helper"`
Expected: no errors referencing the new file. Fix any column-name/type mismatch against `dbTypes.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/test/fixtureHelpers/createNcmecOrgSettings.ts
git commit -m "test: add createNcmecOrgSettings fixture helper

Inserts a ncmec_reporting.ncmec_org_settings row with both policy/action
arrays NULL (satisfies the CHECK constraint) and returns a cleanup. Used
by the NCMEC submission integration test.

Co-Authored-By: pi"
```

---

## Task 4: Layer 2 — full submitReport happy path against a stubbed fetchHTTP

**Files:**

- Create: `server/test/integ/ncmec-submission.integ.test.ts`

**Interfaces:**

- Consumes:
  - `makeIntegrationServer`, `IntegrationServer` from `./setupIntegrationServer.js`
  - `createOrg`, `createContentItemTypes`, `createUser` from `../fixtureHelpers/…`
  - `createNcmecOrgSettings` from Task 3
  - `NcmecReporting`, `NCMECReportParams`, `NCMECIncidentType`, `NCMECIndustryClassification` from `../../services/ncmecService/ncmecReporting.js`
  - `buildSubmitReportParamsFromDecision` + `BuildSubmitReportParamsInput` from `../../services/ncmecService/buildSubmitReportParamsFromDecision.js`
  - `FetchHTTP`, `CoopResponse` from `../../services/networkingService/index.js`
  - `Headers` from `undici`
  - IoC deps: `harness.deps.KyselyPg`, `KyselyPgReadReplica`, `SigningKeyPairService`, `ModerationConfigService`, `getItemTypeEventuallyConsistent`, `Tracer`
- Produces: a self-contained integration test (no exports).

**Context for the implementer:**

- `NcmecReporting` constructor (`ncmecReporting.ts:1349`): `(pgQuery, pqQueryReadReplica, fetchHTTP, signingKeyPairService, moderationConfigService, getItemTypeEventuallyConsistent, tracer)`. We construct it directly from `harness.deps` with a **stub `fetchHTTP`**, so we exercise the real `submitReport` body against real Postgres without going through the reviewer-decision IoC flow.
- `submitReport(reportParams, isTest: boolean)` — we pass `false` AND set `process.env.NCMEC_ENV = 'production'` in the test so the real derivation (`process.env.NCMEC_ENV !== 'production'`) also yields `false`. Belt-and-suspenders: the boolean we pass and the env agree.
- `isTest=false` gates: URL → `https://report.cybertip.org/ispws…` (the stub matches this host); dedup (`getUserHasExistingNcmeReport`) — fresh org, no row ⇒ proceeds; `getPriorCTReportIds` — fresh ⇒ `[]`; `#sendUserPreservationRequest` — fires only if `ncmec_preservation_endpoint` is set AND `isTest===false`. We set the endpoint so preservation is exercised; the stub handles it.
- We OMIT `ncmec_additional_info_endpoint` ⇒ `getNCMECAdditionalInfo` returns default data with no network call (no webhook stub needed).
- The stub is the VCR: it records every call (url, method, body) into an array `calls`, returns canned `CoopResponse` objects, and we assert on `calls` after the flow.
- `buildSubmitReportParamsFromDecision` resolves field roles via `getFieldValueForRole` against a `UserItemType` with `schemaFieldRoles`. To assert "field-role-resolved email lands in the XML," we register a USER item type whose schema has an `email`-typed field mapped to the `email` role, and pass `reportedUserData` containing that field. The same for `ipAddress`, `displayName`, `profileIcon`.
- `NCMECReportParams.media` needs `createdAt` (parseable) so `clampIncidentDateTimeToPast` works; `industryClassification` + `fileAnnotations` from the enums; `url` + `hashes` for `extractHashesForUrl`.

- [ ] **Step 1: Write the failing test (happy path: SUCCESS + persisted row + protocol sequence)**

Create `server/test/integ/ncmec-submission.integ.test.ts`:

```ts
import 'dotenv/config';

import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';
import { Headers } from 'undici';

import NcmecReporting, {
  NCMECFileAnnotation,
  NCMECIncidentType,
  NCMECIndustryClassification,
  type NCMECReportParams,
} from '../../services/ncmecService/ncmecReporting.js';
import {
  type CoopResponse,
  type FetchHTTP,
} from '../../services/networkingService/index.js';
import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createNcmecOrgSettings from '../fixtureHelpers/createNcmecOrgSettings.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';

const MEDIA_URL = 'https://cdn.example/sample.jpg';
const PRESERVATION_URL = 'https://preserve.example/req';
const REPORT_ID = '999';
const FILE_ID = 'f1';

/** Records every outgoing fetchHTTP call and returns canned CyberTip
 * responses. This is the VCR: the stub IS the request recorder. */
function makeStubFetchHTTP(): {
  fetchHTTP: FetchHTTP;
  calls: Array<{ url: string; method: string; body: unknown }>;
} {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const ok = <T>(body: T): CoopResponse<never> =>
    ({ status: 200, ok: true, headers: new Headers(), body }) as never;
  const fetchHTTP = (async (query: never) => {
    const q = query as {
      url: string;
      method: string;
      body: unknown;
      handleResponseBody: string;
    };
    calls.push({ url: q.url, method: q.method, body: q.body });

    // media download for #upload
    if (q.method === 'get') {
      const stream = new ReadableStream({
        start(ctr) {
          ctr.enqueue(new TextEncoder().encode('fake-media-bytes'));
          ctr.close();
        },
      });
      return ok(stream) as never;
    }
    // NCMEC CyberTip protocol
    if (q.url.endsWith('/ispws/submit')) {
      return ok({
        reportResponse: {
          responseCode: { _text: '0' },
          reportId: { _text: REPORT_ID },
        },
      }) as never;
    }
    if (q.url.endsWith('/ispws/upload')) {
      return ok({
        reportResponse: {
          responseCode: { _text: '0' },
          fileId: { _text: FILE_ID },
        },
      }) as never;
    }
    if (q.url.endsWith('/ispws/finish')) {
      return ok({ reportResponse: { responseCode: { _text: '0' } } }) as never;
    }
    // preservation endpoint (#sendUserPreservationRequest uses handleResponseBody 'discard')
    if (q.url === PRESERVATION_URL) {
      return ok(undefined) as never;
    }
    throw new Error(`stub fetchHTTP: unexpected request ${q.method} ${q.url}`);
  }) as unknown as FetchHTTP;
  return { fetchHTTP, calls };
}

describe('NCMEC submitReport (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let ncmecReporting: NcmecReporting | undefined;
  let stub: ReturnType<typeof makeStubFetchHTTP> | undefined;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let settingsCleanup: (() => Promise<unknown>) | undefined;
  let itemTypeFixture: { cleanup: () => Promise<void> } | undefined;
  const prevNcmecEnv = process.env.NCMEC_ENV;

  beforeAll(async () => {
    process.env.NCMEC_ENV = 'production'; // => isTest=false at the call sites
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;

    settingsCleanup = (
      await createNcmecOrgSettings(harness.deps.KyselyPg, {
        orgId,
        username: 'espuser',
        password: 'esppass',
        contactEmail: 'reporter@example.com',
        companyTemplate: 'AcmeESP',
        legalUrl: 'https://acme.example/legal',
        ncmecPreservationEndpoint: PRESERVATION_URL,
        defaultInternetDetailType: 'WEB_PAGE',
      })
    ).cleanup;

    // Reported USER item type with field roles: email, ipAddress, displayName,
    // profileIcon. The email field carries the EMAIL_ADDRESS scalar (the #840/#842 fix).
    const emailField: Field = {
      name: 'email_addr',
      type: ScalarTypes.EMAIL_ADDRESS,
      required: false,
      container: null,
    };
    const ipField: Field = {
      name: 'client_ip',
      type: ScalarTypes.IP_ADDRESS,
      required: false,
      container: null,
    };
    const nameField: Field = {
      name: 'display',
      type: ScalarTypes.STRING,
      required: false,
      container: null,
    };
    const iconField: Field = {
      name: 'avatar',
      type: ScalarTypes.IMAGE,
      required: false,
      container: null,
    };
    itemTypeFixture = await createContentItemTypes({
      moderationConfigService: harness.deps.ModerationConfigService,
      orgId,
      // createContentItemTypes creates a USER-kind type when includeCreator etc.
      // is set; if the helper does not expose schemaFieldRoles directly, register
      // the roles via ModerationConfigService after creation (see Step 2 note).
      extra: { fields: [emailField, ipField, nameField, iconField] },
    });

    stub = makeStubFetchHTTP();
    ncmecReporting = new NcmecReporting(
      harness.deps.KyselyPg,
      harness.deps.KyselyPgReadReplica,
      stub.fetchHTTP,
      harness.deps.SigningKeyPairService,
      harness.deps.ModerationConfigService,
      harness.deps.getItemTypeEventuallyConsistent,
      harness.deps.Tracer,
    );
  }, 120_000);

  afterAll(async () => {
    process.env.NCMEC_ENV = prevNcmecEnv;
    const run = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[ncmec-submission.integ] cleanup failed', err);
      }
    };
    try {
      await run(itemTypeFixture?.cleanup);
      await run(settingsCleanup);
      await run(orgCleanup);
    } finally {
      await harness?.shutdown();
    }
  }, 60_000);

  test('submitReport returns SUCCESS, persists a row, and runs submit→upload→finish', async () => {
    if (!harness || !ncmecReporting || !stub)
      throw new Error('not initialized');

    const userItemTypeId = itemTypeFixture!.itemTypes[0].id; // adjust if helper shape differs
    const reportedUserId = uid();

    const reportParams: NCMECReportParams = {
      orgId,
      reviewerId: 'reviewer-1',
      reportedUser: {
        id: reportedUserId,
        typeId: userItemTypeId,
        displayName: 'Jane Doe',
        profilePicture: 'https://cdn.example/jane.png',
        ipAddress: '203.0.113.7',
        email: 'jane@example.com',
      },
      media: [
        {
          id: 'media-1',
          typeId: userItemTypeId,
          url: MEDIA_URL,
          createdAt: '2026-06-30T12:00:00.000Z',
          industryClassification: NCMECIndustryClassification.A1,
          fileAnnotations: [NCMECFileAnnotation.GENERATIVE_AI],
          hashes: { md5: 'd41d8cd98f00b204e9800998ecf8427e', pdq: 'pdqhash' },
        },
      ],
      threads: [],
      incidentType:
        NCMECIncidentType[
          'Child Pornography (possession, manufacture, and distribution)'
        ],
      jobId: 'job-1',
    };

    const result = await ncmecReporting.submitReport(reportParams, false);
    expect(result).toBe('SUCCESS');

    // protocol sequence
    const routes = stub.calls
      .filter((c) => c.url.includes('cybertip.org'))
      .map((c) => c.url.replace(/^.*\/ispws/, ''));
    expect(routes).toContain('/submit');
    expect(routes.filter((r) => r === '/upload').length).toBe(1);
    expect(routes).toContain('/finish');
    const submitIdx = routes.indexOf('/submit');
    const uploadIdx = routes.indexOf('/upload');
    const finishIdx = routes.indexOf('/finish');
    expect(submitIdx).toBeLessThan(uploadIdx);
    expect(uploadIdx).toBeLessThan(finishIdx);

    // preservation fired (isTest=false + endpoint set)
    expect(stub.calls.some((c) => c.url === PRESERVATION_URL)).toBe(true);

    // persisted row
    const row = await harness.deps.KyselyPg.selectFrom(
      'ncmec_reporting.ncmec_reports',
    )
      .select(['report_id', 'is_test', 'report_xml'])
      .where('org_id', '=', orgId)
      .where('report_id', '=', REPORT_ID)
      .executeTakeFirst();
    expect(row).toBeDefined();
    expect(row?.is_test).toBe(false);
    expect(String(row?.report_xml)).toContain('jane@example.com');
  }, 120_000);
});
```

- [ ] **Step 2: Resolve the USER item type + field-role registration (likely the trickiest part)**

`createContentItemTypes` may not expose `schemaFieldRoles` mapping directly. The implementer must ensure the created USER item type has the `email`/`ipAddress`/`displayName`/`profileIcon` roles mapped to the fields above. Read `server/test/fixtureHelpers/createContentItemTypes.ts` and `createUserItemTypes.ts` to see how roles are set in existing tests (the `buildSubmitReportParamsFromDecision.test.ts` `makeUserItemType` builds a `UserItemType` with `schemaFieldRoles` directly). Two viable paths:

1. If the helper supports passing `schemaFieldRoles`, pass them in `extra`.
2. Otherwise, after creation, call `harness.deps.ModerationConfigService` to set the roles (mirror how `createContentItemTypes` does it internally), or construct the `UserItemType` object in-memory and use `buildSubmitReportParamsFromDecision` (which takes `reportedUserItemType` as an argument — does not need it DB-registered for the role lookups, only `getItemTypeEventuallyConsistent` for the _media_ item type).

If wiring field roles through the DB fixture proves heavy, the simpler path that still satisfies the spec's "field-role-resolved email" claim: use `buildSubmitReportParamsFromDecision` with an in-memory `UserItemType` (built exactly like `makeUserItemType` in `buildSubmitReportParamsFromDecision.test.ts`, with the `email` role mapped) + `reportedUserData` containing `{ email_addr: 'jane@example.com' }`, and register only the _media_ item type via `createContentItemTypes` so `getItemTypeEventuallyConsistent` resolves it. Pass the resulting `NCMECReportParams` into `submitReport`. This still exercises real field-role resolution (`getFieldValueForRole`) and the full submission flow.

Adjust the `reportParams` construction in Step 1 to whichever path is taken. The assertions do not change.

- [ ] **Step 3: Run the integration test (requires docker stack)**

```bash
npm run up && npm run db:update
(cd server && npx jest --config jest.integ.config.cjs --runInBand integ/ncmec-submission.integ.test.ts)
```

Expected: PASS. If `submitReport` returns `'FAILURE'`, inspect the stub `calls` and the `ncmec_reports_errors` table; the most likely causes are (a) the USER item type / field roles not resolving, (b) `getNCMECAdditionalInfo` returning `ALL_MEDIA_MISSING` because media ids don't match (the default path keys media by the ids you pass in `reportParams.media` — ensure they match), or (c) a column-name mismatch in the fixture. Fix the test/fixture, not production code, unless a real bug surfaces.

- [ ] **Step 4: Commit**

```bash
git add server/test/integ/ncmec-submission.integ.test.ts
git commit -m "test(ncmec): add submitReport full-flow integration test (#843)

Layer 2: construct the real NcmecReporting from IoC deps against real
Postgres with a stub fetchHTTP (the DI seam), run submitReport under
NCMEC_ENV=production (isTest=false), and assert the submit→upload→finish
sequence, preservation, and the persisted report_xml. No real NCMEC
endpoints are hit; the stub is the request recorder.

Co-Authored-By: pi"
```

---

## Task 5: Layer 2 — outgoing /submit XML shape assertions

**Files:**

- Modify: `server/test/integ/ncmec-submission.integ.test.ts`

**Interfaces:**

- Consumes: the `stub.calls` array from Task 4, the `/submit` request body (an XML string).

**Context:** The `/submit` request body is the `js2xml(report, { compact: true })` string built in `NcmecReporting.#submit` (ncmecReporting.ts:2180). The stub recorded it in `calls[<submit index>].body`. We assert the field-role-resolved `email` and the configured `incidentType` are present in that string, and that the `Authorization` header is Basic-auth — proving the _outgoing_ request shape, not just the persisted row.

- [ ] **Step 1: Add the request-shape assertions**

Inside the existing `test('submitReport returns SUCCESS …')` in `ncmec-submission.integ.test.ts`, after the protocol-sequence block, add:

```ts
// outgoing /submit request shape
const submitCall = stub.calls.find(
  (c) => c.url.endsWith('/ispws/submit') && typeof c.body === 'string',
);
expect(submitCall).toBeDefined();
const submitXml = String(submitCall!.body);
expect(submitXml).toContain('<incidentType>');
expect(submitXml).toContain('jane@example.com');
expect(submitXml).toContain('<espIdentifier>user-'); // reportedUser.id is the espIdentifier

// Authorization is Basic auth (username:password base64). We do not assert
// the exact value — only the scheme — to keep the test independent of the
// fixture's credential strings.
// Headers are not captured by the stub table above; if header assertion is
// desired, extend makeStubFetchHTTP to record query.headers and assert
// /^Basic /. Here we rely on the fact that #sendCyberTipRequest sets
// Authorization unconditionally (ncmecReporting.ts:2512).
```

If you want a hard Authorization assertion, extend `makeStubFetchHTTP`'s `calls` entries to include `headers: (query as { headers?: Record<string,string> }).headers` and add:

```ts
expect(submitCall!.headers?.Authorization).toMatch(/^Basic /);
```

(Update the `calls` type and the push site accordingly.)

- [ ] **Step 2: Run the integration test**

```bash
(cd server && npx jest --config jest.integ.config.cjs --runInBand integ/ncmec-submission.integ.test.ts)
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/test/integ/ncmec-submission.integ.test.ts
git commit -m "test(ncmec): assert outgoing /submit XML shape in integration test

Assert the /submit request body contains the field-role-resolved email,
the incidentType, and the espIdentifier — proving the outgoing request
shape, not just the persisted row.

Co-Authored-By: pi"
```

---

## Self-Review notes (for the implementer, not a task)

- **Spec coverage:** Layer 1 (presence table + ordering locks) ✓ Task 1+2. Layer 2 (stub fetchHTTP, isTest=false/prod path, dedup/priorCT/preservation, persisted report_xml, request shape) ✓ Task 3+4+5. Non-goals respected: no XSD committed, no real NCMEC endpoints, no Playwright.
- **The trickiest unknown** is Task 4 Step 2 (registering field roles on the USER item type). The plan gives two concrete paths; the implementer should pick the one matching how `createContentItemTypes` actually works (read it first).
- **If `createContentItemTypes` does not create a USER-kind type** with the fields given, fall back to constructing the `UserItemType` in-memory + `buildSubmitReportParamsFromDecision`, as described.
