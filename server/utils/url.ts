/**
 * URL checks with no notion of how this deployment is configured — callers
 * supply the rules. `./urlValidation.js` is the configured entry point that
 * applies Coop's own rules; use that unless you specifically want to say what
 * counts as valid.
 */

export type UrlValidationOptions = {
  allowedSchemes: string[];
  blockedHostnames: string[];
};

/**
 * Loopback addresses, blocked by default to reduce SSRF risk from user-supplied
 * URLs (e.g. webhook callbacks). Deployments wanting stricter blocking against
 * their own public hostname pass `blockedHostnames` themselves.
 */
export const LOOPBACK_HOSTNAMES: readonly string[] = Object.freeze([
  'localhost',
  '127.0.0.1',
]);

export function validateUrl(value: string, opts: UrlValidationOptions) {
  if (!URL.canParse(value)) {
    throw new Error('Invalid URL');
  }

  const { allowedSchemes, blockedHostnames } = opts;
  const { hostname, protocol } = new URL(value);
  const containsValidScheme = allowedSchemes.includes(protocol.slice(0, -1));
  if (!containsValidScheme) {
    throw new Error('URL contains invalid scheme');
  }

  const containsBlockedHostname = blockedHostnames.includes(hostname);

  if (containsBlockedHostname) {
    throw new Error('URL contains blocked hostname');
  }
}

export function isValidUrl(url: string, opts: UrlValidationOptions) {
  try {
    validateUrl(url, opts);
    return true;
  } catch (e) {
    return false;
  }
}
