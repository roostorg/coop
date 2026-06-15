import { type Profile, type VerifiedCallback } from '@node-saml/passport-saml';
import { type Request } from 'express';

import {
  makeInternalServerError,
  makeNotFoundError,
} from '../../utils/errors.js';
import { makeLoginUserDoesNotExistError } from '../datasources/userApiErrors.js';
import { type GraphQLUserParent } from '../datasources/userKyselyPersistence.js';

type FindUserByEmailAndOrg = (opts: {
  email: string;
  orgId: string;
}) => Promise<GraphQLUserParent | undefined>;

/**
 * Resolves the authenticated user for a SAML assertion, binding the lookup to
 * the org named in the callback path (`/saml/login/:orgId/callback`).
 *
 * Security (GHSA-2v93-383c-9fw2): the assertion's signature is verified against
 * the path org's IdP cert, but the user must also belong to that same org.
 * Looking up by email alone would let an assertion signed by org A's IdP
 * resolve a user who lives in org B (same email across tenants), creating a
 * session as that cross-tenant user. Scoping the lookup to the path org closes
 * the bypass: a user from another org simply isn't found, and login fails.
 */
export async function resolveSamlUser(
  findUser: FindUserByEmailAndOrg,
  req: Pick<Request, 'params'>,
  profile: Pick<Profile, 'email'> | null,
  done: VerifiedCallback,
): Promise<void> {
  const rawOrgId = req.params['orgId'];
  const orgId = typeof rawOrgId === 'string' ? rawOrgId : undefined;
  if (!orgId) {
    return done(
      makeNotFoundError('orgId not found in path.', { shouldErrorSpan: true }),
    );
  }

  try {
    const user = await findUser({ email: String(profile?.email), orgId });
    // we should have already checked for this, but couldn't hurt to check again
    if (user == null) {
      return done(makeLoginUserDoesNotExistError({ shouldErrorSpan: true }));
    }

    return done(null, user);
  } catch {
    return done(
      makeInternalServerError('Unknown error during login attempt', {
        shouldErrorSpan: true,
      }),
    );
  }
}
