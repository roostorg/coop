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
  kyselyUserUpdate,
  type GraphQLUserParent,
} from './userKyselyPersistence.js';

/**
 * Best-effort upgrade of a legacy-cost bcrypt hash to the current work
 * factor, run after a password has already been verified correct. Must
 * never fail the login it's piggybacking on: any error here is logged and
 * swallowed, and the row is picked up again on the user's next login.
 *
 * Deliberately a plain `kyselyUserUpdate` column write, NOT the transactional
 * path `UserApi.changePassword` / `resetPasswordForToken` use — those also
 * purge the user's other sessions as part of an explicit password *change*.
 * Reusing that path here would silently log out every user the first time
 * their legacy hash gets upgraded, even though their password never changed
 * (see #778, which added that session purge).
 */
async function rehashPasswordOnLogin(
  deps: {
    kyselyPg: Dependencies['KyselyPg'];
    tracer: Dependencies['Tracer'];
  },
  user: GraphQLUserParent,
  plaintextPassword: string,
): Promise<void> {
  try {
    const rehashed = await hashPassword(plaintextPassword);
    await kyselyUserUpdate(deps.kyselyPg, user.id, { password: rehashed });
  } catch (e) {
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
    if (
      user.password == null ||
      !(await passwordMatchesHash(password, user.password))
    ) {
      throw makeLoginIncorrectPasswordError({ shouldErrorSpan: true });
    }

    if (passwordNeedsRehash(user.password)) {
      await rehashPasswordOnLogin(deps, user, password);
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
