import { type UrlString } from '@roostorg/coop-types';
import debugConfig from '#config/debug';

import { instantiateOpaqueType } from './typescript-types.js';
import {
  isValidUrl as isValidUrlAgainst,
  LOOPBACK_HOSTNAMES,
  validateUrl as validateUrlAgainst,
  type UrlValidationOptions,
} from './url.js';

/**
 * The rules this deployment applies to user-supplied URLs.
 *
 * Read on each call rather than captured, so `env.set` in a test is respected —
 * see the note in `config/app.ts`.
 */
function deploymentOptions(): UrlValidationOptions {
  return {
    allowedSchemes: ['http', 'https'],
    blockedHostnames: debugConfig.allowUserInputLocalhostUris
      ? []
      : [...LOOPBACK_HOSTNAMES],
  };
}

/** Throws `Invalid URL` unless `value` passes this deployment's rules. */
export function validateUrl(
  value: string,
  opts: UrlValidationOptions = deploymentOptions(),
) {
  validateUrlAgainst(value, opts);
}

export function isValidUrl(
  value: string,
  opts: UrlValidationOptions = deploymentOptions(),
) {
  return isValidUrlAgainst(value, opts);
}

/**
 * Returns a {@link UrlString} if the input passes this deployment's rules, else
 * undefined.
 */
export function makeUrlString(it: string) {
  return isValidUrl(it) ? instantiateOpaqueType<UrlString>(it) : undefined;
}
