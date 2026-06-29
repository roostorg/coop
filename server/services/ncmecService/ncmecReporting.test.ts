import {
  buildInternetDetailsFromOrgSetting,
  clampIncidentDateTimeToPast,
  mergeFieldRoleIpIntoEvents,
  NCMECEvent,
  resolveReportedPersonEmail,
  summarizeCyberTipFailure,
} from './ncmecReporting.js';

describe('NCMEC reporting', () => {
  describe('buildInternetDetailsFromOrgSetting', () => {
    it('returns undefined when type is null or undefined', () => {
      expect(
        buildInternetDetailsFromOrgSetting(null, undefined),
      ).toBeUndefined();
      expect(
        buildInternetDetailsFromOrgSetting(undefined, 'https://example.com'),
      ).toBeUndefined();
    });

    it('returns undefined when type is blank string', () => {
      expect(buildInternetDetailsFromOrgSetting('', undefined)).toBeUndefined();
      expect(
        buildInternetDetailsFromOrgSetting('   ', undefined),
      ).toBeUndefined();
    });

    it('returns undefined for unknown type', () => {
      expect(
        buildInternetDetailsFromOrgSetting('UNKNOWN', undefined),
      ).toBeUndefined();
      expect(
        buildInternetDetailsFromOrgSetting('web_page', undefined),
      ).toBeUndefined();
    });

    it('returns WEB_PAGE incident with moreInfoUrl when provided', () => {
      const result = buildInternetDetailsFromOrgSetting(
        'WEB_PAGE',
        'https://example.com/info',
      );
      expect(result).toEqual([
        { webPageIncident: { url: 'https://example.com/info' } },
      ]);
    });

    it('omits url when moreInfoUrl is empty', () => {
      const result = buildInternetDetailsFromOrgSetting('WEB_PAGE', undefined);
      expect(result).toEqual([{ webPageIncident: {} }]);
    });

    it('omits url when moreInfoUrl is blank', () => {
      const result = buildInternetDetailsFromOrgSetting('WEB_PAGE', '   ');
      expect(result).toEqual([{ webPageIncident: {} }]);
    });

    it('omits url when moreInfoUrl contains whitespace (NCMEC rejects it)', () => {
      const result = buildInternetDetailsFromOrgSetting(
        'WEB_PAGE',
        'Not specified',
      );
      expect(result).toEqual([{ webPageIncident: {} }]);
    });

    it('omits url when moreInfoUrl contains ASCII control characters', () => {
      const result = buildInternetDetailsFromOrgSetting(
        'WEB_PAGE',
        'https://example.com/\x01bad',
      );
      expect(result).toEqual([{ webPageIncident: {} }]);
    });

    it('returns correct structure for each valid type (no extra fields)', () => {
      expect(buildInternetDetailsFromOrgSetting('EMAIL', undefined)).toEqual([
        { emailIncident: {} },
      ]);
      expect(
        buildInternetDetailsFromOrgSetting('NEWSGROUP', undefined),
      ).toEqual([{ newsgroupIncident: {} }]);
      expect(buildInternetDetailsFromOrgSetting('CHAT_IM', undefined)).toEqual([
        { chatImIncident: {} },
      ]);
      expect(
        buildInternetDetailsFromOrgSetting('ONLINE_GAMING', undefined),
      ).toEqual([{ onlineGamingIncident: {} }]);
      expect(
        buildInternetDetailsFromOrgSetting('CELL_PHONE', undefined),
      ).toEqual([{ cellPhoneIncident: {} }]);
      expect(
        buildInternetDetailsFromOrgSetting('NON_INTERNET', undefined),
      ).toEqual([{ nonInternetIncident: {} }]);
      expect(
        buildInternetDetailsFromOrgSetting('PEER_TO_PEER', undefined),
      ).toEqual([{ peer2peerIncident: {} }]);
    });

    it('trims type before matching', () => {
      expect(
        buildInternetDetailsFromOrgSetting('  CHAT_IM  ', undefined),
      ).toEqual([{ chatImIncident: {} }]);
    });
  });

  describe('clampIncidentDateTimeToPast', () => {
    const NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0);

    it('clamps future timestamps to now - 1s and reports wasClamped=true', () => {
      const future = new Date(NOW_MS + 60_000).toISOString();
      expect(clampIncidentDateTimeToPast(future, NOW_MS)).toEqual({
        value: new Date(NOW_MS - 1000).toISOString(),
        wasClamped: true,
      });
    });

    it('leaves canonical UTC past timestamps untouched and reports wasClamped=false', () => {
      const pastMs = NOW_MS - 60_000;
      const past = new Date(pastMs).toISOString();
      expect(clampIncidentDateTimeToPast(past, NOW_MS)).toEqual({
        value: past,
        wasClamped: false,
      });
    });

    it('handles non-UTC ISO offsets via numeric (not lexicographic) compare', () => {
      // 11:30:00-01:00 === 12:30:00Z (30 min after NOW); lex compare would
      // classify it as past since the string sorts earlier than 11:59:59Z.
      const futureWithOffset = '2026-01-15T11:30:00-01:00';
      expect(clampIncidentDateTimeToPast(futureWithOffset, NOW_MS)).toEqual({
        value: new Date(NOW_MS - 1000).toISOString(),
        wasClamped: true,
      });
    });

    it('does not flag wasClamped when a non-UTC past timestamp is merely normalized to Z', () => {
      // 11:30:00+02:00 === 09:30:00Z (in the past, but round-trips to a
      // different string). String inequality would have false-flagged it.
      const pastWithOffset = '2026-01-15T11:30:00+02:00';
      expect(clampIncidentDateTimeToPast(pastWithOffset, NOW_MS)).toEqual({
        value: '2026-01-15T09:30:00.000Z',
        wasClamped: false,
      });
    });

    it('throws on invalid timestamps', () => {
      expect(() => clampIncidentDateTimeToPast('not-a-date', NOW_MS)).toThrow(
        /Invalid media createdAt timestamp/,
      );
    });
  });

  describe('mergeFieldRoleIpIntoEvents', () => {
    const synth = {
      eventName: NCMECEvent.Upload,
      dateTime: '2026-05-27T12:00:00.000Z',
    };

    const webhookEvent = {
      ipAddress: '192.0.2.1',
      eventName: NCMECEvent.Login,
      dateTime: '2026-01-01T00:00:00.000Z',
      port: 443,
    };
    const paramEvent = {
      ipAddress: '198.51.100.5',
      eventName: NCMECEvent.Registration,
      dateTime: '2026-02-02T00:00:00.000Z',
    };
    const otherParamEvent = {
      ipAddress: '198.51.100.6',
      eventName: NCMECEvent.Other,
      dateTime: '2026-02-03T00:00:00.000Z',
    };

    it('passes webhook events through when nothing else is set', () => {
      expect(
        mergeFieldRoleIpIntoEvents([webhookEvent], undefined, undefined, synth),
      ).toEqual([webhookEvent]);
    });

    it('accepts a single param event (not wrapped in an array)', () => {
      // Partial-items-derived data may produce a single event or many; we
      // accept either shape so callers don't need to wrap.
      expect(
        mergeFieldRoleIpIntoEvents(undefined, paramEvent, undefined, synth),
      ).toEqual([paramEvent]);
    });

    it('accepts an array of param events', () => {
      expect(
        mergeFieldRoleIpIntoEvents(
          undefined,
          [paramEvent, otherParamEvent],
          undefined,
          synth,
        ),
      ).toEqual([paramEvent, otherParamEvent]);
    });

    it('concatenates webhook + param + role-synth events in that order', () => {
      expect(
        mergeFieldRoleIpIntoEvents(
          [webhookEvent],
          [paramEvent, otherParamEvent],
          '203.0.113.5',
          synth,
        ),
      ).toEqual([
        webhookEvent,
        paramEvent,
        otherParamEvent,
        {
          ipAddress: '203.0.113.5',
          eventName: NCMECEvent.Upload,
          dateTime: '2026-05-27T12:00:00.000Z',
        },
      ]);
    });

    it('appends the role IP as a synthesised event after webhook events', () => {
      // The role IP is always included alongside webhook events — adopters
      // who tag the item with the IP get coverage even when the webhook
      // already returns a richer event from a different system of record.
      expect(
        mergeFieldRoleIpIntoEvents(
          [webhookEvent],
          undefined,
          '203.0.113.5',
          synth,
        ),
      ).toEqual([
        webhookEvent,
        {
          ipAddress: '203.0.113.5',
          eventName: NCMECEvent.Upload,
          dateTime: '2026-05-27T12:00:00.000Z',
        },
      ]);
    });

    it('returns a single synthesised event when only the role IP is available', () => {
      expect(
        mergeFieldRoleIpIntoEvents([], undefined, '192.0.2.10', synth),
      ).toEqual([
        {
          ipAddress: '192.0.2.10',
          eventName: NCMECEvent.Upload,
          dateTime: '2026-05-27T12:00:00.000Z',
        },
      ]);
    });

    it('returns undefined when no source has data', () => {
      expect(
        mergeFieldRoleIpIntoEvents(undefined, undefined, undefined, synth),
      ).toBeUndefined();
      expect(
        mergeFieldRoleIpIntoEvents(undefined, undefined, null, synth),
      ).toBeUndefined();
      expect(
        mergeFieldRoleIpIntoEvents([], [], undefined, synth),
      ).toBeUndefined();
    });

    it('treats blank/whitespace role IP as absent', () => {
      // Don't synthesise from blank/whitespace; ingestion validates real IPs
      // upstream, but we trim defensively here.
      expect(
        mergeFieldRoleIpIntoEvents(undefined, undefined, '', synth),
      ).toBeUndefined();
      expect(
        mergeFieldRoleIpIntoEvents(undefined, undefined, '   ', synth),
      ).toBeUndefined();
      // With a webhook event, the blank role IP is dropped silently.
      expect(
        mergeFieldRoleIpIntoEvents([webhookEvent], undefined, '   ', synth),
      ).toEqual([webhookEvent]);
    });

    it('trims surrounding whitespace from the role IP before emitting', () => {
      const result = mergeFieldRoleIpIntoEvents(
        undefined,
        undefined,
        '  198.51.100.7  ',
        synth,
      );
      expect(result).toEqual([
        {
          ipAddress: '198.51.100.7',
          eventName: NCMECEvent.Upload,
          dateTime: '2026-05-27T12:00:00.000Z',
        },
      ]);
    });

    it('does not mutate the input webhook or param event arrays', () => {
      const webhook = [webhookEvent];
      const params = [paramEvent];
      const result = mergeFieldRoleIpIntoEvents(
        webhook,
        params,
        '203.0.113.5',
        synth,
      );
      expect(result).not.toBe(webhook);
      expect(result).not.toBe(params);
      expect(webhook).toHaveLength(1);
      expect(params).toHaveLength(1);
    });
  });

  describe('resolveReportedPersonEmail', () => {
    it('returns the webhook emails when present', () => {
      const webhook = [
        { _text: 'verified@example.com', _attributes: { verified: true } },
      ];
      expect(resolveReportedPersonEmail(webhook, 'role@example.com')).toEqual(
        webhook,
      );
    });

    it('falls back to the field-role email when the webhook returned an empty array', () => {
      expect(resolveReportedPersonEmail([], 'role@example.com')).toEqual([
        { _text: 'role@example.com' },
      ]);
    });

    it('falls back to the field-role email when the webhook returned undefined', () => {
      expect(resolveReportedPersonEmail(undefined, 'role@example.com')).toEqual(
        [{ _text: 'role@example.com' }],
      );
    });

    it('returns undefined when neither source has data', () => {
      expect(resolveReportedPersonEmail(undefined, undefined)).toBeUndefined();
      expect(resolveReportedPersonEmail([], undefined)).toBeUndefined();
    });

    it('treats whitespace-only field-role email as absent', () => {
      // NCMEC validates the email shape on receipt; a `{ _text: "  " }`
      // submission would fail the same way the original incomplete-report
      // bug did. Trim and drop rather than ship whitespace.
      expect(resolveReportedPersonEmail(undefined, '   ')).toBeUndefined();
      expect(resolveReportedPersonEmail([], '\t\n')).toBeUndefined();
    });

    it('trims surrounding whitespace from a valid field-role email', () => {
      expect(
        resolveReportedPersonEmail(undefined, '  role@example.com  '),
      ).toEqual([{ _text: 'role@example.com' }]);
    });
  });

  // toOriginalFileHashes tests moved to ./toOriginalFileHashes.test.ts
  // (this file was over the 500-line max-lines limit after expansion).

  describe('summarizeCyberTipFailure', () => {
    const previousDebug = process.env.NCMEC_DEBUG;
    const previousNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NCMEC_DEBUG = previousDebug;
      process.env.NODE_ENV = previousNodeEnv;
    });

    it('includes NCMEC responseCode and description in production', () => {
      process.env.NCMEC_DEBUG = undefined;
      process.env.NODE_ENV = 'production';
      const body = {
        reportResponse: {
          responseCode: { _text: '4100' },
          responseDescription: { _text: 'incidentSummary out of order' },
        },
      };
      const message = summarizeCyberTipFailure('/submit', 400, body);
      expect(message).toContain('status=400');
      expect(message).toContain('responseCode=4100');
      expect(message).toContain('incidentSummary out of order');
      expect(message).not.toContain('body=');
    });

    it('does not leak unknown body fields in production', () => {
      process.env.NCMEC_DEBUG = undefined;
      process.env.NODE_ENV = 'production';
      const body = {
        secret: 'reportable-content-or-pii',
        unrelated: { nested: 'data' },
      };
      const message = summarizeCyberTipFailure('/submit', 500, body);
      expect(message).toContain('status=500');
      expect(message).not.toContain('reportable-content-or-pii');
      expect(message).not.toContain('unrelated');
    });

    it('appends the truncated body when NCMEC_DEBUG is enabled in dev', () => {
      process.env.NCMEC_DEBUG = '1';
      process.env.NODE_ENV = 'test';
      const body = {
        reportResponse: {
          responseCode: { _text: '4000' },
          responseDescription: { _text: 'Invalid request' },
        },
      };
      const message = summarizeCyberTipFailure('/finish', 400, body);
      expect(message).toContain('responseCode=4000');
      expect(message).toContain('Invalid request');
      expect(message).toContain('body=');
      expect(message).toContain('reportResponse');
    });

    it('still keeps body off in production even with NCMEC_DEBUG=1', () => {
      process.env.NCMEC_DEBUG = '1';
      process.env.NODE_ENV = 'production';
      const body = { reportResponse: { responseCode: { _text: '0' } } };
      const message = summarizeCyberTipFailure('/submit', 502, body);
      expect(message).not.toContain('body=');
    });
  });
});
