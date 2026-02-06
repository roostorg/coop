import { validateUrl } from './url.js';

describe('URL Tests', () => {
  describe('Deny Prod URLs', () => {
    beforeEach(() => {
      // This absolutely is unsafe mutation of a global that'll be visible
      // across test suites. However, this env var should only be relied upon
      // by this module, so it should be ok.
      // eslint-disable-next-line better-mutation/no-mutation
      process.env.ALLOW_USER_INPUT_LOCALHOST_URIS = 'false';
    });

    afterEach(() => {
      delete process.env.ALLOW_USER_INPUT_LOCALHOST_URIS;
    });

    test('Deny Coop domains', () => {
      expect(() => validateUrl('https://www.coopapi.com')).toThrow();
      expect(() => validateUrl('https://www.trycoop.co')).toThrow();
      expect(() => validateUrl('https://www.getcoop.com')).toThrow();
    });

    test('Deny localhost domains', () => {
      // This absolutely is unsafe mutation of a global that'll be visible
      // across test suites. However, this env var should only be relied upon
      // by this module, so it should be ok.
      // eslint-disable-next-line better-mutation/no-mutation
      process.env.ALLOW_USER_INPUT_LOCALHOST_URIS = 'false';

      expect(() => validateUrl('https://localhost:3000')).toThrow();
      expect(() => validateUrl('https://127.0.0.1')).toThrow();
    });
  });

  describe('Allow development URLs', () => {
    beforeEach(() => {
      // This absolutely is unsafe mutation of a global that'll be visible
      // across test suites. However, this env var should only be relied upon
      // by this module, so it should be ok.
      // eslint-disable-next-line better-mutation/no-mutation
      process.env.ALLOW_USER_INPUT_LOCALHOST_URIS = 'true';
    });

    afterEach(() => {
      delete process.env.ALLOW_USER_INPUT_LOCALHOST_URIS;
    });

    test('Deny Coop domains', () => {
      expect(() => validateUrl('https://www.coopapi.com')).toThrow();
      expect(() => validateUrl('https://www.trycoop.co')).toThrow();
      expect(() => validateUrl('https://www.getcoop.com')).toThrow();
    });

    test('Allow localhost domains', () => {
      expect(() => validateUrl('https://localhost:3000')).not.toThrow();
      expect(() => validateUrl('https://127.0.0.1')).not.toThrow();
    });
  });
});
