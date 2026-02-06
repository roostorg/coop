import { type UrlString } from '@roostorg/types';

import { instantiateOpaqueType } from './typescript-types.js';

type UrlValidationOptions = {
  allowedSchemes: string[];
  blockedHostnames: string[];
};

function defaultBlockedHostnames(): string[] {
  const { ALLOW_USER_INPUT_LOCALHOST_URIS } = process.env;

  return [
    'coopapi.com',
    'www.coopapi.com',
    'trycoop.co',
    'www.trycoop.co',
    'getcoop.com',
    'www.getcoop.com',
    ...(ALLOW_USER_INPUT_LOCALHOST_URIS === 'true'
      ? []
      : ['localhost', '127.0.0.1']),
  ];
}

export function validateUrl(
  value: string,
  // If you update these opts make sure to update validateUrlOrNull's opts as
  // well
  opts: UrlValidationOptions = {
    allowedSchemes: ['http', 'https'],
    blockedHostnames: defaultBlockedHostnames(),
  },
) {
  try {
    const { allowedSchemes, blockedHostnames } = opts;
    const { hostname, protocol } = new URL(value); // might throw.
    const containsValidScheme = allowedSchemes.includes(protocol.slice(0, -1));
    if (!containsValidScheme) {
      throw new Error('URL contains invalid scheme');
    }

    const containsBlockedHostname = blockedHostnames.includes(hostname);

    if (containsBlockedHostname) {
      throw new Error('URL contains blocked hostname');
    }
  } catch (_) {
    throw new Error('Invalid URL');
  }
}

export function isValidUrl(url: string, opts?: UrlValidationOptions) {
  try {
    validateUrl(url, opts);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Returns a {@link UrlString} if the input string is a valid URL; else
 * undefined. Does not accept urls that are invalid according to the default
 * {@link UrlValidationOptions} used by {@link validateUrl}.
 */
export function makeUrlString(it: string) {
  return isValidUrl(it) ? instantiateOpaqueType<UrlString>(it) : undefined;
}

export function validateUrlOrNull(
  value?: string,
  // Ideally this wouldn't set its own default so that it would always use
  // validateUrl's opts, but for some reason that breaks sequelize so if you
  // update these opts update validateUrl's as well
  opts: UrlValidationOptions = {
    allowedSchemes: ['http', 'https'],
    blockedHostnames: defaultBlockedHostnames(),
  },
) {
  if (value == null) {
    return;
  }
  validateUrl(value, opts);
}
