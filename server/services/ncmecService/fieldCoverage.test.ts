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

// The Report type from buildSubmitReportObject is deeply nested with union
// members that make ReturnType<typeof buildSubmitReportObject> prohibitively
// expensive for ts-node to check in array-of-function signatures. Using
// eslint-disabled any here keeps the path functions simple and the test
// fast to compile; the paths are just property accessors.
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
  // strictly required by XSD — must be present even in min
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
  // field-role gated — the #840/#842 class: absent in min, present with roles
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
  // webhook / decision gated — absent without webhook+decision input
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

describe('NCMEC field coverage (Layer 1)', () => {
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

  it('renders all three scenarios to non-empty XML', () => {
    for (const key of ['min', 'field-roles', 'max'] as ScenarioKey[]) {
      expect(renderXml(scenarios[key]).length).toBeGreaterThan(0);
    }
  });

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

    it('ipCaptureEvent children follow XSD sequence (the #869 order)', () => {
      // Assert on the builder's OWN synthesised event (the role-IP event
      // constructed by mergeFieldRoleIpIntoEvents), not the webhook-sourced
      // event[0]: the builder does not canonicalise webhook key order, so
      // event[0] reflects the test fixture's key order rather than builder
      // behaviour. event[1] is the builder's constructed output and is the
      // meaningful #869 regression lock. (See task-2-report for the
      // webhook-pass-through ordering gap this surfaced.)
      const max = scenarios.max as AnyReport;
      const evs = max.report.personOrUserReported.ipCaptureEvent;
      const synthesised = evs[evs.length - 1];
      const emitted = Object.keys(synthesised);
      expect(orderOf(emitted, XSD.ipCaptureEvent)).toEqual(emitted);
    });
  });
});
