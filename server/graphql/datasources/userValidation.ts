import { createRequire } from 'node:module';
import type { IsEmailOptions } from 'validator/lib/isEmail.js';

import { UserRole } from '../../models/types/permissioning.js';
import { type LoginMethod } from '../../services/coreAppTables.js';

// `validator` is CJS with UMD-style types whose `default` doesn't resolve to
// a callable under `module: NodeNext`; `createRequire` gives us `module.exports`
// directly, typed against the per-function defs that ship with `@types/validator`.
type ValidatorLib = {
  isEmail: (str: string, options?: IsEmailOptions) => boolean;
};
const validator = createRequire(import.meta.url)('validator') as ValidatorLib;

/**
 * Server-side validation for `User` inputs, replacing the `isEmail`,
 * `notEmpty`, and `isIn` checks that lived on the Sequelize model, plus the
 * DB `password_null_when_not_present` CHECK constraint (which we still rely
 * on; this layer surfaces a useful error before the INSERT hits Postgres).
 *
 * Returned rather than thrown so each caller picks the right error surface:
 * the data source wraps failures in `makeBadRequestError`, while persistence
 * treats them as invariants.
 */

export type UserValidationFailure = {
  /** Kept stable for GraphQL JSON pointers. */
  field:
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'role'
    | 'loginMethods'
    | 'password';
  message: string;
};

export type UserValidationResult =
  | { ok: true }
  | { ok: false; failure: UserValidationFailure };

function isEmailShape(value: string): boolean {
  return validator.isEmail(value);
}

function isNonEmptyTrimmed(value: string): boolean {
  return value.trim().length > 0;
}

function fail(
  field: UserValidationFailure['field'],
  message: string,
): UserValidationResult {
  return { ok: false, failure: { field, message } };
}

const ALLOWED_LOGIN_METHODS: readonly LoginMethod[] = ['password', 'saml'];

function validateLoginMethodsShape(
  loginMethods: readonly string[],
): UserValidationResult {
  if (loginMethods.length === 0) {
    return fail('loginMethods', 'loginMethods must not be empty');
  }
  for (const method of loginMethods) {
    if (!ALLOWED_LOGIN_METHODS.includes(method as LoginMethod)) {
      return fail(
        'loginMethods',
        `loginMethods contains invalid entry '${method}'`,
      );
    }
  }
  return { ok: true };
}

/**
 * Mirrors the DB `password_null_when_not_present` CHECK:
 *   password IS NOT NULL  ⇔  'password' ∈ login_methods
 */
function validatePasswordLoginMethodsInvariant(input: {
  password: string | null;
  loginMethods: readonly LoginMethod[];
}): UserValidationResult {
  const hasPassword = input.password != null && input.password !== '';
  const usesPasswordLogin = input.loginMethods.includes('password');
  if (hasPassword && !usesPasswordLogin) {
    return fail(
      'password',
      "password must not be set when 'password' is not in loginMethods",
    );
  }
  if (!hasPassword && usesPasswordLogin) {
    return fail(
      'password',
      "password is required when 'password' is in loginMethods",
    );
  }
  return { ok: true };
}

export function validateUserCreateInput(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  loginMethods: readonly string[];
  password: string | null;
}): UserValidationResult {
  if (!isNonEmptyTrimmed(input.email) || !isEmailShape(input.email)) {
    return fail('email', 'email must be a valid email address');
  }
  if (!isNonEmptyTrimmed(input.firstName)) {
    return fail('firstName', 'firstName must not be empty');
  }
  if (!isNonEmptyTrimmed(input.lastName)) {
    return fail('lastName', 'lastName must not be empty');
  }
  const roleValues: readonly string[] = Object.values(UserRole);
  if (!roleValues.includes(input.role)) {
    return fail('role', `role must be one of: ${roleValues.join(', ')}`);
  }
  const loginResult = validateLoginMethodsShape(input.loginMethods);
  if (!loginResult.ok) {
    return loginResult;
  }
  const invariantResult = validatePasswordLoginMethodsInvariant({
    password: input.password,
    loginMethods: input.loginMethods as readonly LoginMethod[],
  });
  if (!invariantResult.ok) {
    return invariantResult;
  }
  return { ok: true };
}

/**
 * Partial-update semantics match the Sequelize model:
 * - `undefined` fields are skipped
 * - `password: null` is a meaningful value (removes password login)
 * - `password: ''` is rejected as a shape error
 */
export function validateUserUpdatePatch(patch: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  password?: string | null;
}): UserValidationResult {
  if (
    patch.email != null &&
    (!isNonEmptyTrimmed(patch.email) || !isEmailShape(patch.email))
  ) {
    return fail('email', 'email must be a valid email address');
  }
  if (patch.firstName != null && !isNonEmptyTrimmed(patch.firstName)) {
    return fail('firstName', 'firstName must not be empty');
  }
  if (patch.lastName != null && !isNonEmptyTrimmed(patch.lastName)) {
    return fail('lastName', 'lastName must not be empty');
  }
  const roleValues: readonly string[] = Object.values(UserRole);
  if (patch.role != null && !roleValues.includes(patch.role)) {
    return fail('role', `role must be one of: ${roleValues.join(', ')}`);
  }
  if (patch.password === '') {
    return fail('password', 'password must not be an empty string');
  }
  return { ok: true };
}
