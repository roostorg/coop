import {
  buildSubmitReportObject,
  NCMECEvent,
  type BuildSubmitReportObjectInput,
} from './ncmecReporting.js';

const INCIDENT_DATE_TIME = '2026-05-27T18:00:00.000Z';

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
  };
}

describe('buildSubmitReportObject', () => {
  it('builds the minimum valid envelope (no webhook, no field-roles, no contact person)', () => {
    const result = buildSubmitReportObject(makeBuildReportInput());
    expect(result).toEqual({
      report: {
        incidentSummary: {
          incidentType:
            'Child Pornography (possession, manufacture, and distribution)',
          incidentDateTime: INCIDENT_DATE_TIME,
        },
        reporter: {
          reportingPerson: { email: [{ _text: 'reporter@acme.example' }] },
          companyTemplate: 'AcmeESP',
          legalURL: 'https://acme.example/legal',
        },
        personOrUserReported: {
          espIdentifier: 'user-1',
          espService: 'AcmeESP',
          screenName: undefined,
        },
      },
    });
  });

  it('preserves XSD insertion order under a kitchen-sink scenario', () => {
    // NCMEC rejects out-of-order children with responseCode=4100 (the
    // exact bug #477 fixed). Anchoring key order here lets a unit test
    // catch the regression instead of waiting for exttest to reject it.
    const result = buildSubmitReportObject(
      makeBuildReportInput({
        reportParams: {
          escalateToHighPriority: 'reason',
          additionalInfo: 'top-level note',
          reportedUser: {
            id: 'user-1',
            typeId: 'user-type-1',
            displayName: 'alice',
            ipAddress: '203.0.113.7',
            email: 'alice@example.com',
          },
        },
        orgSettings: {
          defaultInternetDetailType: 'WEB_PAGE',
          moreInfoUrl: 'https://acme.example/profile/user-1',
          termsOfService: 'Acme ToS',
          contactPersonEmail: 'contact@acme.example',
          contactPersonFirstName: 'Casey',
          contactPersonLastName: 'Adopter',
          contactPersonPhone: '+15551112222',
        },
        userAdditionalInfo: {
          screenName: 'alice123',
          ipCaptureEvent: [
            {
              ipAddress: '198.51.100.4',
              eventName: NCMECEvent.Login,
              dateTime: INCIDENT_DATE_TIME,
            },
          ],
        },
      }),
    );
    expect(Object.keys(result.report)).toEqual([
      'incidentSummary',
      'internetDetails',
      'reporter',
      'personOrUserReported',
      'additionalInfo',
    ]);
    expect(Object.keys(result.report.incidentSummary)).toEqual([
      'incidentType',
      'escalateToHighPriority',
      'incidentDateTime',
    ]);
    expect(Object.keys(result.report.reporter)).toEqual([
      'reportingPerson',
      'contactPerson',
      'companyTemplate',
      'termsOfService',
      'legalURL',
    ]);
    const personOrUserReported = result.report.personOrUserReported;
    expect(personOrUserReported).toBeDefined();
    expect(Object.keys(personOrUserReported ?? {})).toEqual([
      'personOrUserReportedPerson',
      'espIdentifier',
      'espService',
      'screenName',
      'displayName',
      'ipCaptureEvent',
    ]);
  });

  describe('input validation', () => {
    it('throws when escalateToHighPriority is empty after trim', () => {
      expect(() =>
        buildSubmitReportObject(
          makeBuildReportInput({
            reportParams: { escalateToHighPriority: '   ' },
          }),
        ),
      ).toThrow(/escalateToHighPriority must be non-blank/);
    });

    it('throws when escalateToHighPriority exceeds 3000 characters', () => {
      expect(() =>
        buildSubmitReportObject(
          makeBuildReportInput({
            reportParams: { escalateToHighPriority: 'x'.repeat(3001) },
          }),
        ),
      ).toThrow(/at most 3000 characters/);
    });

    it('throws when additionalInfo is empty after trim', () => {
      expect(() =>
        buildSubmitReportObject(
          makeBuildReportInput({
            reportParams: { additionalInfo: '   ' },
          }),
        ),
      ).toThrow(/additionalInfo must be non-blank/);
    });

    it('throws when additionalInfo exceeds 3000 characters', () => {
      expect(() =>
        buildSubmitReportObject(
          makeBuildReportInput({
            reportParams: { additionalInfo: 'x'.repeat(3001) },
          }),
        ),
      ).toThrow(/at most 3000 characters/);
    });
  });

  describe('reportedPersonEmail resolution', () => {
    it('uses field-role email when webhook returned none', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          reportParams: {
            reportedUser: {
              id: 'user-1',
              typeId: 'user-type-1',
              email: 'role@example.com',
            },
          },
        }),
      );
      expect(
        result.report.personOrUserReported?.personOrUserReportedPerson?.email,
      ).toEqual([{ _text: 'role@example.com' }]);
    });

    it('prefers webhook email (carries NCMEC attributes) over field-role email', () => {
      // The webhook payload may attach `verified` / `type` attributes that
      // the field-role bare string cannot carry. Always prefer webhook
      // when both are present.
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          reportParams: {
            reportedUser: {
              id: 'user-1',
              typeId: 'user-type-1',
              email: 'role@example.com',
            },
          },
          userAdditionalInfo: {
            email: [
              {
                _text: 'webhook@example.com',
                _attributes: { verified: true, type: 'Home' },
              },
            ],
          },
        }),
      );
      expect(
        result.report.personOrUserReported?.personOrUserReportedPerson?.email,
      ).toEqual([
        {
          _text: 'webhook@example.com',
          _attributes: { verified: true, type: 'Home' },
        },
      ]);
    });

    it('omits personOrUserReportedPerson when neither source has an email', () => {
      const result = buildSubmitReportObject(makeBuildReportInput());
      expect(result.report.personOrUserReported).not.toHaveProperty(
        'personOrUserReportedPerson',
      );
    });
  });

  describe('ipCaptureEvent merging', () => {
    it('synthesises an Unknown event from the field-role IP when no webhook events exist', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          reportParams: {
            reportedUser: {
              id: 'user-1',
              typeId: 'user-type-1',
              ipAddress: '203.0.113.7',
            },
          },
        }),
      );
      expect(result.report.personOrUserReported?.ipCaptureEvent).toEqual([
        {
          ipAddress: '203.0.113.7',
          eventName: 'Unknown',
          dateTime: INCIDENT_DATE_TIME,
        },
      ]);
    });

    it('keeps webhook events and only appends the field-role IP when distinct', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          reportParams: {
            reportedUser: {
              id: 'user-1',
              typeId: 'user-type-1',
              ipAddress: '203.0.113.7',
            },
          },
          userAdditionalInfo: {
            ipCaptureEvent: [
              {
                ipAddress: '198.51.100.4',
                eventName: NCMECEvent.Login,
                dateTime: INCIDENT_DATE_TIME,
              },
            ],
          },
        }),
      );
      const events = result.report.personOrUserReported?.ipCaptureEvent ?? [];
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ ipAddress: '198.51.100.4' });
      expect(events[1]).toMatchObject({
        ipAddress: '203.0.113.7',
        eventName: 'Unknown',
      });
    });
  });

  describe('contactPerson assembly', () => {
    it('omits contactPerson entirely when no contact fields are set', () => {
      const result = buildSubmitReportObject(makeBuildReportInput());
      expect(result.report.reporter).not.toHaveProperty('contactPerson');
    });

    it('includes only the subset of contact fields the org has filled in', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          orgSettings: { contactPersonEmail: 'contact@acme.example' },
        }),
      );
      expect(result.report.reporter.contactPerson).toEqual({
        email: [{ _text: 'contact@acme.example' }],
      });
    });

    it('trims whitespace from each contact field', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          orgSettings: {
            contactPersonFirstName: '  Casey  ',
            contactPersonLastName: ' Adopter ',
            contactPersonPhone: ' +1555 ',
            contactPersonEmail: ' contact@acme.example ',
          },
        }),
      );
      expect(result.report.reporter.contactPerson).toEqual({
        firstName: 'Casey',
        lastName: 'Adopter',
        phone: { _text: '+1555' },
        email: [{ _text: 'contact@acme.example' }],
      });
    });
  });

  describe('termsOfService', () => {
    it('omits when blank', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({ orgSettings: { termsOfService: '   ' } }),
      );
      expect(result.report.reporter).not.toHaveProperty('termsOfService');
    });

    it('omits when over 3000 characters (NCMEC ceiling)', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          orgSettings: { termsOfService: 'x'.repeat(3001) },
        }),
      );
      expect(result.report.reporter).not.toHaveProperty('termsOfService');
    });

    it('passes through and trims an in-bounds value', () => {
      const result = buildSubmitReportObject(
        makeBuildReportInput({
          orgSettings: { termsOfService: '  Acme ToS  ' },
        }),
      );
      expect(result.report.reporter.termsOfService).toBe('Acme ToS');
    });
  });
});
