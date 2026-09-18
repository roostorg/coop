import { LOOPBACK_HOSTNAMES, validateUrl } from './url.js';

const blockingLoopback = {
  allowedSchemes: ['http', 'https'],
  blockedHostnames: [...LOOPBACK_HOSTNAMES],
};

const allowingLoopback = {
  allowedSchemes: ['http', 'https'],
  blockedHostnames: [],
};

describe('URL Tests', () => {
  describe('Loopback blocked', () => {
    test('Deny localhost domains', () => {
      expect(() =>
        validateUrl('https://localhost:3000', blockingLoopback),
      ).toThrow();
      expect(() =>
        validateUrl('https://127.0.0.1', blockingLoopback),
      ).toThrow();
    });

    test('Allow arbitrary external URLs', () => {
      expect(() =>
        validateUrl('https://example.com', blockingLoopback),
      ).not.toThrow();
      expect(() =>
        validateUrl('https://api.example.org/webhook', blockingLoopback),
      ).not.toThrow();
    });
  });

  describe('Loopback allowed', () => {
    test('Allow localhost domains', () => {
      expect(() =>
        validateUrl('https://localhost:3000', allowingLoopback),
      ).not.toThrow();
      expect(() =>
        validateUrl('https://127.0.0.1', allowingLoopback),
      ).not.toThrow();
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
