import {
  buildInternetDetailsFromOrgSetting,
  clampIncidentDateTimeToPast,
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
