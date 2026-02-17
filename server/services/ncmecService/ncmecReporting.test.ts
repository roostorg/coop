import {
  buildInternetDetailsFromOrgSetting,
} from './ncmecReporting.js';

describe('NCMEC reporting', () => {
  describe('buildInternetDetailsFromOrgSetting', () => {
    it('returns undefined when type is null or undefined', () => {
      expect(buildInternetDetailsFromOrgSetting(null, undefined)).toBeUndefined();
      expect(buildInternetDetailsFromOrgSetting(undefined, 'https://example.com')).toBeUndefined();
    });

    it('returns undefined when type is blank string', () => {
      expect(buildInternetDetailsFromOrgSetting('', undefined)).toBeUndefined();
      expect(buildInternetDetailsFromOrgSetting('   ', undefined)).toBeUndefined();
    });

    it('returns undefined for unknown type', () => {
      expect(buildInternetDetailsFromOrgSetting('UNKNOWN', undefined)).toBeUndefined();
      expect(buildInternetDetailsFromOrgSetting('web_page', undefined)).toBeUndefined();
    });

    it('returns WEB_PAGE incident with moreInfoUrl when provided', () => {
      const result = buildInternetDetailsFromOrgSetting('WEB_PAGE', 'https://example.com/info');
      expect(result).toEqual([{ webPageIncident: { url: 'https://example.com/info' } }]);
    });

    it('returns WEB_PAGE incident with "Not specified" when moreInfoUrl is empty', () => {
      const result = buildInternetDetailsFromOrgSetting('WEB_PAGE', undefined);
      expect(result).toEqual([{ webPageIncident: { url: 'Not specified' } }]);
    });

    it('returns WEB_PAGE incident with "Not specified" when moreInfoUrl is blank', () => {
      const result = buildInternetDetailsFromOrgSetting('WEB_PAGE', '   ');
      expect(result).toEqual([{ webPageIncident: { url: 'Not specified' } }]);
    });

    it('returns correct structure for each valid type (no extra fields)', () => {
      expect(buildInternetDetailsFromOrgSetting('EMAIL', undefined)).toEqual([
        { emailIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('NEWSGROUP', undefined)).toEqual([
        { newsgroupIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('CHAT_IM', undefined)).toEqual([
        { chatImIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('ONLINE_GAMING', undefined)).toEqual([
        { onlineGamingIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('CELL_PHONE', undefined)).toEqual([
        { cellPhoneIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('NON_INTERNET', undefined)).toEqual([
        { nonInternetIncident: {} },
      ]);
      expect(buildInternetDetailsFromOrgSetting('PEER_TO_PEER', undefined)).toEqual([
        { peer2peerIncident: {} },
      ]);
    });

    it('trims type before matching', () => {
      expect(buildInternetDetailsFromOrgSetting('  CHAT_IM  ', undefined)).toEqual([
        { chatImIncident: {} },
      ]);
    });
  });
});
