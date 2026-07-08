/**
 * Utility functions for detecting and handling content URLs that should be displayed in iframes
 */

import type { MediaKind } from '@roostorg/coop-types';

const MEDIA_EXTENSION_TO_KIND: Readonly<Record<string, MediaKind>> = {
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  png: 'IMAGE',
  gif: 'IMAGE',
  webp: 'IMAGE',
  bmp: 'IMAGE',
  svg: 'IMAGE',
  avif: 'IMAGE',
  heic: 'IMAGE',
  heif: 'IMAGE',
  tif: 'IMAGE',
  tiff: 'IMAGE',
  mp4: 'VIDEO',
  m4v: 'VIDEO',
  mov: 'VIDEO',
  webm: 'VIDEO',
  mkv: 'VIDEO',
  avi: 'VIDEO',
  flv: 'VIDEO',
  mp3: 'AUDIO',
  m4a: 'AUDIO',
  wav: 'AUDIO',
  aac: 'AUDIO',
  flac: 'AUDIO',
  opus: 'AUDIO',
  wma: 'AUDIO',
};

// Best-effort fallback for resolving a media kind from a URL extension, used
// when a MEDIA value's `mediaType` is absent. Mirrors the server's
// `detectMediaKindFromUrl`. Returns `null` when it can't be resolved.
export function inferMediaKindFromUrl(url: string): MediaKind | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const dot = pathname.lastIndexOf('.');
  if (dot < 0 || dot === pathname.length - 1) return null;
  const ext = pathname.slice(dot + 1).toLowerCase();
  return MEDIA_EXTENSION_TO_KIND[ext] ?? null;
}

/**
 * Get the content URL patterns from environment variables
 * Defaults to 'notion' for backward compatibility
 * Supports comma-separated patterns
 */
export function getContentUrlPatterns(): string[] {
  const pattern: string = import.meta.env.VITE_CONTENT_URL_PATTERN ?? 'notion';
  return pattern
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Normalize a configured pattern to a bare host fragment, stripping any scheme,
 * port, or path so legacy full-URL configs keep working. Dotless fragments are
 * returned as-is for substring matching.
 */
function normalizePatternHost(pattern: string): string {
  const trimmed = pattern.trim().toLowerCase();
  if (trimmed.length === 0) return '';
  let host = trimmed;
  if (/[:/]/.test(trimmed)) {
    try {
      host = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`)
        .hostname;
    } catch {
      // Not parseable as a URL; fall back to the raw fragment.
    }
  }
  return host.replace(/^\.+|\.+$/g, '');
}

/**
 * Check whether a single pattern matches a hostname.
 *
 * Domain-like patterns (those containing a dot, e.g. `example.com`) are matched
 * on host boundaries so a pattern can't be smuggled via a lookalike or subdomain
 * (`notexample.com` and `example.com.evil.test` do NOT match `example.com`).
 * Legacy patterns without a dot keep substring matching for backward
 * compatibility with existing `VITE_CONTENT_URL_PATTERN` configs.
 */
function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
  const normalized = normalizePatternHost(pattern);
  if (normalized.length === 0) return false;
  if (normalized.includes('.')) {
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  }
  return hostname.includes(normalized);
}

/**
 * Check if a URL should be displayed in an iframe
 *
 * Patterns are matched against the URL's hostname only (not the full URL), so a
 * pattern can't be smuggled in via the path or query string (e.g.
 * `https://evil.test/?ref=example.com` does not match the `example.com` pattern).
 * Domain-like patterns are further matched on host boundaries; see
 * {@link hostnameMatchesPattern}.
 * @param url The URL to check
 * @returns True if the URL should be displayed in an iframe
 */
export function shouldDisplayInIframe(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const patterns = getContentUrlPatterns();
  return patterns.some((pattern) => hostnameMatchesPattern(hostname, pattern));
}

/**
 * Check if a URL field value should be displayed in an iframe
 * @param urlField The URL field value to check
 * @returns True if the URL field should be displayed in an iframe
 */
export function shouldDisplayUrlFieldInIframe(urlField: any): boolean {
  if (!urlField || typeof urlField !== 'object' || !('type' in urlField)) {
    return false;
  }

  if (urlField.type !== 'URL' || typeof urlField.value !== 'string') {
    return false;
  }

  return shouldDisplayInIframe(urlField.value);
}

/**
 * Find the first URL that should be displayed in an iframe from a list of URL fields
 * @param urlFields Array of URL field values
 * @returns The first URL field that should be displayed in an iframe, or undefined
 */
export function findFirstIframeUrl(urlFields: any[]): any | undefined {
  return urlFields.find(shouldDisplayUrlFieldInIframe);
}
