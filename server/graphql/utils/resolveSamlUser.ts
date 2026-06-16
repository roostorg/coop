import { type Profile, type VerifiedCallback } from '@node-saml/passport-saml';
import { type Request } from 'express';

import {
  makeInternalServerError,
  makeNotFoundError,
} from '../../utils/errors.js';
import { type default as SafeTracer } from '../../utils/SafeTracer.js';
import { makeLoginUserDoesNotExistError } from '../datasources/userApiErrors.js';
import {
  kyselyUserFindByEmailAndOrg,
  type GraphQLUserParent,
  type UsersDb,
} from '../datasources/userKyselyPersistence.js';
import { getOrgIdFromPath } from './orgIdFromPath.js';

/**
 * Resolves the authenticated user for a SAML assertion, binding the lookup to
 * the org named in the callback path (`/saml/login/:orgId/callback`).
 */
export async function resolveSamlUser(
  db: UsersDb,
  tracer: SafeTracer,
  req: Pick<Request, 'params'>,
  profile: Pick<Profile, 'email'> | null,
  done: VerifiedCallback,
): Promise<void> {
  const orgId = getOrgIdFromPath(req);
  if (!orgId) {
    return done(
      makeNotFoundError('orgId not found in path.', { shouldErrorSpan: true }),
    );
  }

  // Reject a missing/blank/non-string email claim instead of coercing it
  // (e.g. String(undefined) === "undefined") into a lookup key.
  const email = profile?.email;
  if (typeof email !== 'string' || email.length === 0) {
    return done(makeLoginUserDoesNotExistError({ shouldErrorSpan: true }));
  }

  // Scope the catch to the DB lookup so a genuine outage is logged and surfaced
  // as an internal error, while the `done` dispatch below isn't swallowed.
  let user: GraphQLUserParent | undefined;
  try {
    user = await kyselyUserFindByEmailAndOrg(db, { email, orgId });
  } catch (e) {
    tracer.logActiveSpanFailedIfAny(e);
    return done(
      makeInternalServerError('Unknown error during login attempt', {
        shouldErrorSpan: true,
      }),
    );
  }

  // we should have already checked for this, but couldn't hurt to check again
  if (user == null) {
    return done(makeLoginUserDoesNotExistError({ shouldErrorSpan: true }));
  }

  return done(null, user);
}
