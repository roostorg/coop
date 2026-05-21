import { validateUrl } from './url.js';

describe('URL Tests', () => {
  describe('Loopback gating (default)', () => {
    beforeEach(() => {
      // This absolutely is unsafe mutation of a global that'll be visible
      // across test suites. However, this env var should only be relied upon
      // by this module, so it should be ok.
      process.env.ALLOW_USER_INPUT_LOCALHOST_URIS = 'false';
    });

    afterEach(() => {
      delete process.env.ALLOW_USER_INPUT_LOCALHOST_URIS;
    });

    test('Deny localhost domains', () => {
      expect(() => validateUrl('https://localhost:3000')).toThrow();
      expect(() => validateUrl('https://127.0.0.1')).toThrow();
    });

    test('Allow arbitrary external URLs', () => {
      expect(() => validateUrl('https://example.com')).not.toThrow();
      expect(() => validateUrl('https://api.example.org/webhook')).not.toThrow();
    });
  });

  describe('Loopback gating (development override)', () => {
    beforeEach(() => {
      // This absolutely is unsafe mutation of a global that'll be visible
      // across test suites. However, this env var should only be relied upon
      // by this module, so it should be ok.
      process.env.ALLOW_USER_INPUT_LOCALHOST_URIS = 'true';
    });

    afterEach(() => {
      delete process.env.ALLOW_USER_INPUT_LOCALHOST_URIS;
    });

    test('Allow localhost domains', () => {
      expect(() => validateUrl('https://localhost:3000')).not.toThrow();
      expect(() => validateUrl('https://127.0.0.1')).not.toThrow();
    });
  });

  describe('Caller-provided blockedHostnames', () => {
    test('Honor custom blocklist passed via opts', () => {
      expect(() =>
        validateUrl('https://blocked.example.com', {
          allowedSchemes: ['http', 'https'],
          blockedHostnames: ['blocked.example.com'],
        }),
      ).toThrow();
    });
  });
});
