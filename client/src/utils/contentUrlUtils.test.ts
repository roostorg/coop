import { afterEach, describe, expect, it, vi } from 'vitest';

import { shouldDisplayInIframe } from './contentUrlUtils';

function setPattern(value: string) {
  vi.stubEnv('VITE_CONTENT_URL_PATTERN', value);
}

describe('shouldDisplayInIframe', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false for non-URL strings', () => {
    setPattern('example.com');
    expect(shouldDisplayInIframe('not a url')).toBe(false);
    expect(shouldDisplayInIframe('')).toBe(false);
  });

  it('does not match patterns smuggled via path or query', () => {
    setPattern('example.com');
    expect(shouldDisplayInIframe('https://evil.test/?ref=example.com')).toBe(
      false,
    );
    expect(shouldDisplayInIframe('https://evil.test/example.com')).toBe(false);
  });

  describe('domain-like patterns (containing a dot)', () => {
    it('matches the exact host', () => {
      setPattern('example.com');
      expect(shouldDisplayInIframe('https://example.com/profile/foo')).toBe(
        true,
      );
    });

    it('matches subdomains of the pattern', () => {
      setPattern('example.com');
      expect(shouldDisplayInIframe('https://www.example.com/foo')).toBe(true);
    });

    it('does not match lookalike hosts', () => {
      setPattern('example.com');
      expect(shouldDisplayInIframe('https://notexample.com/foo')).toBe(false);
    });

    it('does not match hosts that merely contain the pattern as a subdomain prefix', () => {
      setPattern('example.com');
      expect(shouldDisplayInIframe('https://example.com.evil.test/foo')).toBe(
        false,
      );
    });
  });

  describe('legacy patterns (no dot)', () => {
    it('keeps substring matching for backward compatibility', () => {
      setPattern('wiki');
      expect(shouldDisplayInIframe('https://wiki.example.com/page')).toBe(true);
      expect(shouldDisplayInIframe('https://team.wiki.example.org/x')).toBe(
        true,
      );
    });
  });

  describe('URL-like patterns (scheme / port / path)', () => {
    it('normalizes a pattern with a scheme to its hostname', () => {
      setPattern('https://example.com');
      expect(shouldDisplayInIframe('https://example.com/foo')).toBe(true);
      expect(shouldDisplayInIframe('https://notexample.com/foo')).toBe(false);
    });

    it('normalizes a pattern with a path to its hostname', () => {
      setPattern('example.org/page');
      expect(shouldDisplayInIframe('https://example.org/anything')).toBe(true);
      expect(shouldDisplayInIframe('https://www.example.org/x')).toBe(true);
    });

    it('normalizes a pattern with a port to its hostname', () => {
      setPattern('localhost:3000');
      expect(shouldDisplayInIframe('http://localhost/foo')).toBe(true);
    });
  });

  it('supports comma-separated patterns', () => {
    setPattern('wiki, example.com');
    expect(shouldDisplayInIframe('https://wiki.example.org/page')).toBe(true);
    expect(shouldDisplayInIframe('https://example.com/foo')).toBe(true);
    expect(shouldDisplayInIframe('https://notexample.com/foo')).toBe(false);
  });
});
