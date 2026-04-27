import { createRequire } from 'node:module';
import type { IsEmailOptions } from 'validator/lib/isEmail.js';

import { validateUrl } from '../../utils/url.js';

// `validator` is CJS with UMD-style types whose `default` doesn't resolve to
// a callable under `module: NodeNext`; `createRequire` gives us `module.exports`
// directly, typed against the per-function defs that ship with `@types/validator`.
type ValidatorLib = {
  isEmail: (str: string, options?: IsEmailOptions) => boolean;
};
const validator = createRequire(import.meta.url)('validator') as ValidatorLib;

/**
 * Server-side validation for `Org` inputs, replacing the `isEmail`, `notEmpty`,
 * and `validateUrl` checks that lived on the Sequelize model.
 *
 * Returned rather than thrown so each caller picks the right error surface:
 * the data source wraps failures in `makeBadRequestError` (with a JSON pointer
 * to the offending field), while persistence treats them as invariants.
 *
 * A follow-up move of these checks to GraphQL schema-level scalars
 * (`EmailAddress`, `URL` from `graphql-scalars`) is tracked in the Sequelize
 * → Kysely migration plan.
 */

export type OrgValidationFailure = {
  /** Kept stable for GraphQL JSON pointers. */
  field: 'name' | 'email' | 'websiteUrl' | 'onCallAlertEmail';
  message: string;
};

export type OrgValidationResult =
  | { ok: true }
  | { ok: false; failure: OrgValidationFailure };

function isEmailShape(value: string): boolean {
  return validator.isEmail(value);
}

function isNonEmptyTrimmed(value: string): boolean {
  return value.trim().length > 0;
}

function fail(
  field: OrgValidationFailure['field'],
  message: string,
): OrgValidationResult {
  return { ok: false, failure: { field, message } };
}

function validateWebsiteUrlShape(value: string): OrgValidationResult {
  try {
    validateUrl(value);
    return { ok: true };
  } catch {
    return fail('websiteUrl', 'websiteUrl must be a valid http(s) URL');
  }
}

export function validateOrgCreateInput(input: {
  name: string;
  email: string;
  websiteUrl: string;
  onCallAlertEmail?: string | null;
}): OrgValidationResult {
  if (!isNonEmptyTrimmed(input.name)) {
    return fail('name', 'name must not be empty');
  }
  if (!isNonEmptyTrimmed(input.email) || !isEmailShape(input.email)) {
    return fail('email', 'email must be a valid email address');
  }
  if (!isNonEmptyTrimmed(input.websiteUrl)) {
    return fail('websiteUrl', 'websiteUrl must not be empty');
  }
  const websiteResult = validateWebsiteUrlShape(input.websiteUrl);
  if (!websiteResult.ok) {
    return websiteResult;
  }
  if (
    input.onCallAlertEmail != null &&
    input.onCallAlertEmail !== '' &&
    !isEmailShape(input.onCallAlertEmail)
  ) {
    return fail(
      'onCallAlertEmail',
      'onCallAlertEmail must be a valid email address',
    );
  }
  return { ok: true };
}

/**
 * Partial-update semantics match the Sequelize model:
 * - `undefined` fields are skipped
 * - `websiteUrl: ''` is treated as "no change" (legacy behavior)
 * - `onCallAlertEmail: null` is a meaningful value (clears the column)
 */
export function validateOrgUpdatePatch(patch: {
  name?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  onCallAlertEmail?: string | null;
}): OrgValidationResult {
  if (patch.name != null && !isNonEmptyTrimmed(patch.name)) {
    return fail('name', 'name must not be empty');
  }
  if (
    patch.email != null &&
    (!isNonEmptyTrimmed(patch.email) || !isEmailShape(patch.email))
  ) {
    return fail('email', 'email must be a valid email address');
  }
  if (patch.websiteUrl != null && patch.websiteUrl !== '') {
    const websiteResult = validateWebsiteUrlShape(patch.websiteUrl);
    if (!websiteResult.ok) {
      return websiteResult;
    }
  }
  if (patch.onCallAlertEmail != null && !isEmailShape(patch.onCallAlertEmail)) {
    return fail(
      'onCallAlertEmail',
      'onCallAlertEmail must be a valid email address',
    );
  }
  return { ok: true };
}
