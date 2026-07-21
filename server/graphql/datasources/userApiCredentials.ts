import { type Dependencies } from '../../iocContainer/index.js';
import {
  hashPassword,
  passwordMatchesHash,
  passwordNeedsRehash,
} from '../../services/userManagementService/index.js';
import { CoopError, makeInternalServerError } from '../../utils/errors.js';
import {
  makeLoginIncorrectPasswordError,
  makeLoginSsoRequiredError,
  makeLoginUserDoesNotExistError,
} from './userApiErrors.js';
import {
  kyselyUserFindByEmail,
  type GraphQLUserParent,
} from './userKyselyPersistence.js';

/**
 * Best-effort upgrade of a stale password hash to a fresh Argon2id hash at
 * today's parameters. Runs only after the password has already been verified
 * correct, because re-hashing requires the plaintext: it cannot be done as a
 * migration, only opportunistically at the one moment we hold the password.
 *
 * Must never fail the login it's piggybacking on: any error here is logged and
 * swallowed, and the row is picked up again on the user's next login.
 *
 * The write is a compare-and-swap on `verifiedHash` (the exact stored hash
 * the plaintext was just checked against) rather than an unconditional
 * update by id: if a concurrent password change lands between verification
 * and this write, zero rows match and the stale rehash is dropped instead
 * of clobbering the newer hash.
 */
async function rehashPasswordOnLogin(
  deps: {
    kyselyPg: Dependencies['KyselyPg'];
    tracer: Dependencies['Tracer'];
  },
  userId: string,
  verifiedHash: string,
  plaintextPassword: string,
): Promise<void> {
  try {
    const rehashed = await hashPassword(plaintextPassword);
    await deps.kyselyPg
      .updateTable('public.users')
      .set({ password: rehashed, updated_at: new Date() })
      .where('id', '=', userId)
      .where('password', '=', verifiedHash)
      .execute();
  } catch (e) {
    // Expected failures here are transient and infra-level: the UPDATE
    // hitting a connection-pool limit, a timeout, or a deadlock, or
    // `hashPassword` failing under memory pressure. None of those are a
    // reason to fail a login that already verified correctly — this rehash
    // is an opportunistic upgrade, not a security requirement of this login
    // — so it's logged for visibility and the row is retried next login.
    deps.tracer.logActiveSpanFailedIfAny(e);
  }
}

/**
 * Look up a user by email and verify their password, applying the same
 * SAML-required and password-login-enabled gates the previous
 * `GraphQLLocalStrategy` callback enforced. Throws a typed `CoopError` on
 * failure so the resolver can classify the error type and return the
 * appropriate GraphQL union member.
 *
 * Pulled out of the previous `passport.authenticate('graphql-local', ...)`
 * flow when the unmaintained `graphql-passport` dependency was dropped (it
 * also pulled in deprecated `subscriptions-transport-ws`). The verification
 * now runs inline and the session is established via the standard
 * `req.login` (wrapped by `PassportGqlContext.login`).
 */
export async function verifyEmailPasswordCredentials(
  deps: {
    kyselyPg: Dependencies['KyselyPg'];
    orgSettingsService: Dependencies['OrgSettingsService'];
    tracer: Dependencies['Tracer'];
  },
  email: string,
  password: string,
): Promise<GraphQLUserParent> {
  try {
    const user = await kyselyUserFindByEmail(deps.kyselyPg, email);
    if (user == null) {
      throw makeLoginUserDoesNotExistError({ shouldErrorSpan: true });
    }

    const samlSettings = await deps.orgSettingsService.getSamlSettings(
      user.orgId,
    );

    if (samlSettings?.saml_enabled) {
      throw makeLoginSsoRequiredError({
        detail:
          'SAML is enabled for this organization. Password login is disabled.',
        shouldErrorSpan: true,
      });
    }

    if (!user.loginMethods.includes('password')) {
      throw makeLoginIncorrectPasswordError({
        detail: 'Password is not set for user.',
        shouldErrorSpan: true,
      });
    }

    // `loginMethods` includes 'password', so the DB CHECK constraint
    // guarantees `user.password` is non-null here.
    if (user.password == null) {
      throw makeLoginIncorrectPasswordError({ shouldErrorSpan: true });
    }

    const passwordMatches = await passwordMatchesHash(password, user.password);
    if (!passwordMatches) {
      throw makeLoginIncorrectPasswordError({ shouldErrorSpan: true });
    }

    if (passwordNeedsRehash(user.password)) {
      await rehashPasswordOnLogin(deps, user.id, user.password, password);
    }

    return user;
  } catch (e) {
    if (e instanceof CoopError) {
      throw e;
    }
    deps.tracer.logActiveSpanFailedIfAny(e);
    throw makeInternalServerError('Unknown error during login attempt', {
      shouldErrorSpan: true,
    });
  }
}
