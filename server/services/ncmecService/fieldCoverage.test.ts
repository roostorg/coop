/**
 * Field-coverage regression net for the NCMEC CyberTip report builder.
 *
 * The builder emits different XML fields depending on how much data the
 * adopter has about the reported user. We lock that behaviour by rendering
 * the report under three configurations and asserting, per field, which ones
 * populate it:
 *
 * - `min`         — bare minimum: no user data, no webhook, no reviewer
 *                   escalation. Only the org-setting-backed fields NCMEC
 *                   strictly requires appear.
 * - `field-roles`  — the adopter maps their user data to coop's schema field
 *                   roles (email, IP, display name, profile icon). Fields
 *                   read off the user via roles now populate; webhook and
 *                   reviewer-decision fields stay absent.
 * - `max`         — everything wired: field roles + the additional-info
 *                   webhook + a reviewer escalation + top-level notes.
 */
import { js2xml } from 'xml-js';

import {
  buildSubmitReportObject,
  NCMECEvent,
  type BuildSubmitReportObjectInput,
} from './ncmecReporting.js';

const INCIDENT_DATE_TIME = '2026-06-30T18:00:00.000Z';

/** Minimal valid inputs for `buildSubmitReportObject`. Tests override only
 * the field(s) under test, so each case is self-explanatory. */
function makeBuildReportInput(
  overrides: {
    reportParams?: Partial<BuildSubmitReportObjectInput['reportParams']> & {
      reportedUser?: Partial<
        BuildSubmitReportObjectInput['reportParams']['reportedUser']
      >;
    };
    userAdditionalInfo?: BuildSubmitReportObjectInput['userAdditionalInfo'];
    orgSettings?: Partial<BuildSubmitReportObjectInput['orgSettings']>;
    clampedIncidentDateTime?: string;
    priorCTReports?: readonly number[];
  } = {},
): BuildSubmitReportObjectInput {
  const { reportParams: paramOverrides, ...rest } = overrides;
  const { reportedUser: userOverrides, ...reportParamOverrides } =
    paramOverrides ?? {};
  return {
    reportParams: {
      orgId: 'org-1',
      reviewerId: 'reviewer-1',
      reportedUser: {
        id: 'user-1',
        typeId: 'user-type-1',
        ...userOverrides,
      },
      media: [],
      threads: [],
      incidentType:
        'Child Pornography (possession, manufacture, and distribution)',
      ...reportParamOverrides,
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

// Use `any` here to avoid a ts-node crash when many path functions are typed
// against the deeply-nested Report union.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyReport = any;

function renderXml(report: ReturnType<typeof buildSubmitReportObject>): string {
  return js2xml(report, { compact: true });
}

type ScenarioExpectations = {
  min: boolean;
  'field-roles': boolean;
  max: boolean;
};

const presenceTable: Array<{
  field: string;
  path: (r: AnyReport) => unknown;
  expected: ScenarioExpectations;
}> = [
  // Required by the XSD — present in every configuration (backed by org
  // settings, not user data).
  {
    field: 'incidentSummary.incidentType',
    path: (r) => r.report.incidentSummary.incidentType,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'incidentSummary.incidentDateTime',
    path: (r) => r.report.incidentSummary.incidentDateTime,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.reportingPerson.email',
    path: (r) => r.report.reporter.reportingPerson.email,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.companyTemplate',
    path: (r) => r.report.reporter.companyTemplate,
    expected: { min: true, 'field-roles': true, max: true },
  },
  {
    field: 'reporter.legalURL',
    path: (r) => r.report.reporter.legalURL,
    expected: { min: true, 'field-roles': true, max: true },
  },
  // These fields are read off the reported user's data via schema field roles.
  // In `min` no user data is provided, so they're absent; with roles mapped
  // they populate.
  {
    field: 'personOrUserReportedPerson.email',
    path: (r) =>
      r.report.personOrUserReported?.personOrUserReportedPerson?.email,
    expected: { min: false, 'field-roles': true, max: true },
  },
  {
    field: 'personOrUserReported.displayName',
    path: (r) => r.report.personOrUserReported?.displayName,
    expected: { min: false, 'field-roles': true, max: true },
  },
  {
    field: 'personOrUserReported.ipCaptureEvent',
    path: (r) => r.report.personOrUserReported?.ipCaptureEvent,
    expected: { min: false, 'field-roles': true, max: true },
  },
  // These fields come from reviewer decisions or the additional-info webhook,
  // neither of which the `min` or `field-roles` scenarios provide.
  {
    field: 'incidentSummary.escalateToHighPriority',
    path: (r) => r.report.incidentSummary.escalateToHighPriority,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'report.additionalInfo',
    path: (r) => r.report.additionalInfo,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'personOrUserReported.priorCTReports',
    path: (r) => r.report.personOrUserReported?.priorCTReports,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'reporter.contactPerson',
    path: (r) => r.report.reporter.contactPerson,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'reporter.termsOfService',
    path: (r) => r.report.reporter.termsOfService,
    expected: { min: false, 'field-roles': false, max: true },
  },
  {
    field: 'internetDetails.webPageIncident',
    path: (r) => r.report.internetDetails?.[0]?.webPageIncident,
    expected: { min: false, 'field-roles': false, max: true },
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('NCMEC field coverage', () => {
  // One rendered report per configuration (see the file header for what each
  // represents). The presence table below asserts which fields each one emits.
  const scenarios = {
    min: buildSubmitReportObject(makeBuildReportInput()),
    'field-roles': buildSubmitReportObject(
      makeBuildReportInput({
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
      }),
    ),
    max: buildSubmitReportObject(
      makeBuildReportInput({
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
              _attributes: { type: 'Home', verified: true },
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
      }),
    ),
  };

  type ScenarioKey = keyof typeof scenarios;

  const has = (path: (r: AnyReport) => unknown, key: ScenarioKey): boolean =>
    path(scenarios[key]) !== undefined;

  describe('presence table', () => {
    for (const row of presenceTable) {
      it(`emits ${row.field} per scenario expectations`, () => {
        for (const key of ['min', 'field-roles', 'max'] as ScenarioKey[]) {
          expect(has(row.path, key)).toBe(row.expected[key]);
        }
      });
    }
  });

  it('renders all three scenarios to well-formed XML with scenario-specific markers', () => {
    // The presence table checks the object tree; this is the only test that
    // exercises the js2xml serialization path, so assert meaningful structural
    // and field markers per scenario rather than just non-empty output.
    const markers: Record<
      ScenarioKey,
      { present: string[]; absent: string[] }
    > = {
      // min: only org-setting-backed required fields — no user data, no
      // escalation, no top-level additionalInfo. personOrUserReported is
      // always emitted (espIdentifier/espService) but carries no IP event,
      // display name, or prior reports.
      min: {
        present: [
          '<report>',
          '<incidentSummary>',
          '<incidentType>',
          '<incidentDateTime>',
          '<reporter>',
          '<personOrUserReported>',
          '<espIdentifier>',
        ],
        absent: [
          '<ipCaptureEvent>',
          '<displayName>',
          '<additionalInfo>',
          '<escalateToHighPriority>',
        ],
      },
      // field-roles: user data via roles populates personOrUserReported + IP
      // event, but still no escalation or top-level additionalInfo.
      'field-roles': {
        present: [
          '<personOrUserReported>',
          '<espIdentifier>',
          '<ipCaptureEvent>',
          'jane@example.com',
        ],
        absent: ['<additionalInfo>', '<escalateToHighPriority>'],
      },
      // max: everything wired — escalation, additionalInfo, priorCTReports,
      // and contactPerson all present.
      max: {
        present: [
          '<escalateToHighPriority>',
          '<additionalInfo>',
          '<priorCTReports>',
          '<contactPerson>',
        ],
        absent: [],
      },
    };
    for (const key of ['min', 'field-roles', 'max'] as ScenarioKey[]) {
      const xml = renderXml(scenarios[key]);
      expect(xml.length).toBeGreaterThan(0);
      for (const marker of markers[key].present) {
        expect(xml).toContain(marker);
      }
      for (const marker of markers[key].absent) {
        expect(xml).not.toContain(marker);
      }
    }
  });

  // xml-js emits child elements in object-key insertion order, and NCMEC's
  // XSD requires a specific sequence — out-of-order children are rejected.
  // These locks fail if the builder ever emits keys in the wrong order.
  describe('XSD ordering locks', () => {
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
      ipCaptureEvent: [
        'ipAddress',
        'eventName',
        'dateTime',
        'possibleProxy',
        'port',
      ],
    };

    it('incidentSummary children follow XSD sequence', () => {
      const max = scenarios.max as AnyReport;
      const emitted = Object.keys(max.report.incidentSummary);
      expect(orderOf(emitted, XSD.incidentSummary)).toEqual(
        emitted.filter((k) => XSD.incidentSummary.includes(k)),
      );
    });

    it('personOrUserReported children follow XSD sequence', () => {
      const max = scenarios.max as AnyReport;
      const emitted = Object.keys(max.report.personOrUserReported);
      expect(orderOf(emitted, XSD.personOrUserReported)).toEqual(
        emitted.filter((k) => XSD.personOrUserReported.includes(k)),
      );
    });

    it('ipCaptureEvent children follow XSD sequence', () => {
      const max = scenarios.max as AnyReport;
      const evs = max.report.personOrUserReported.ipCaptureEvent;
      for (const ev of evs) {
        const emitted = Object.keys(ev);
        expect(orderOf(emitted, XSD.ipCaptureEvent)).toEqual(emitted);
      }
    });
  });
});
