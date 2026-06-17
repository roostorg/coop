import { afterEach, describe, expect, it, vi } from 'vitest';

import { shouldDisplayInIframe } from './contentUrlUtils';

function setPattern(value: string | undefined) {
  vi.stubEnv('VITE_CONTENT_URL_PATTERN', value as string);
}

describe('shouldDisplayInIframe', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false for non-URL strings', () => {
    setPattern('notion');
    expect(shouldDisplayInIframe('not a url')).toBe(false);
    expect(shouldDisplayInIframe('')).toBe(false);
  });

  it('does not match patterns smuggled via path or query', () => {
    setPattern('bsky.app');
    expect(shouldDisplayInIframe('https://evil.example/?ref=bsky.app')).toBe(
      false,
    );
    expect(shouldDisplayInIframe('https://evil.example/bsky.app')).toBe(false);
  });

  describe('domain-like patterns (containing a dot)', () => {
    it('matches the exact host', () => {
      setPattern('bsky.app');
      expect(shouldDisplayInIframe('https://bsky.app/profile/foo')).toBe(true);
    });

    it('matches subdomains of the pattern', () => {
      setPattern('bsky.app');
      expect(shouldDisplayInIframe('https://www.bsky.app/foo')).toBe(true);
    });

    it('does not match lookalike hosts', () => {
      setPattern('bsky.app');
      expect(shouldDisplayInIframe('https://evilbsky.app/foo')).toBe(false);
    });

    it('does not match hosts that merely contain the pattern as a subdomain prefix', () => {
      setPattern('bsky.app');
      expect(shouldDisplayInIframe('https://bsky.app.evil.example/foo')).toBe(
        false,
      );
    });
  });

  describe('legacy patterns (no dot)', () => {
    it('keeps substring matching for backward compatibility', () => {
      setPattern('notion');
      expect(shouldDisplayInIframe('https://www.notion.so/page')).toBe(true);
      expect(shouldDisplayInIframe('https://mycompany.notion.site/x')).toBe(
        true,
      );
    });
  });

  it('supports comma-separated patterns', () => {
    setPattern('notion, bsky.app');
    expect(shouldDisplayInIframe('https://www.notion.so/page')).toBe(true);
    expect(shouldDisplayInIframe('https://bsky.app/foo')).toBe(true);
    expect(shouldDisplayInIframe('https://evilbsky.app/foo')).toBe(false);
  });
});
