import { type Dependencies } from '../../iocContainer/index.js';
import { passwordMatchesHash } from '../../services/userManagementService/index.js';
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
