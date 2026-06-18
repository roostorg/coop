import { type Exception } from '@opentelemetry/api';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  deleteSessionsForUser,
  hashPassword,
  passwordMatchesHash,
} from '../../services/userManagementService/index.js';
import {
  makeBadRequestError,
  makeNotFoundError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';
import { safePick } from '../../utils/misc.js';
import { WEEK_MS } from '../../utils/time.js';
import {
  type GQLMutationLoginArgs,
  type GQLMutationSignUpArgs,
} from '../generated.js';
import { type PassportGqlContext } from '../utils/passportContext.js';
import { buildGraphqlRuleParent } from './buildGraphqlRuleParent.js';
import { type GraphQLRuleParent } from './ruleKyselyPersistence.js';
import { verifyEmailPasswordCredentials } from './userApiCredentials.js';
import {
  makeChangePasswordIncorrectPasswordError,
  makeChangePasswordNotAllowedError,
  makeSignUpUserExistsError,
} from './userApiErrors.js';
import {
  kyselyUserAddFavoriteRule,
  kyselyUserFindByEmail,
  kyselyUserFindById,
  kyselyUserFindByIdAndOrg,
  kyselyUserFindByIds,
  kyselyUserInsert,
  kyselyUserListFavoriteRuleIds,
  kyselyUserRemoveFavoriteRule,
  kyselyUserUpdate,
  type GraphQLUserParent,
} from './userKyselyPersistence.js';
import {
  validateUserCreateInput,
  validateUserUpdatePatch,
  type UserValidationFailure,
} from './userValidation.js';

/**
 * GraphQL Object for a User
 */
class UserAPI {
  constructor(
    private readonly kyselyPg: Dependencies['KyselyPg'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly userManagementService: Dependencies['UserManagementService'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly orgSettingsService: Dependencies['OrgSettingsService'],
  ) {}

  async getGraphQLUserFromId(opts: {
    id: string;
    orgId: string;
  }): Promise<GraphQLUserParent> {
    const user = await kyselyUserFindByIdAndOrg(this.kyselyPg, opts);
    if (user === undefined) {
      // Matches the `rejectOnEmpty: true` semantics of the Sequelize call
      // this method replaced (callers rely on a throw when the row is
      // missing, e.g. `getFavoriteRules`).
      throw makeNotFoundError(
        `User ${opts.id} not found in org ${opts.orgId}`,
        { shouldErrorSpan: true },
      );
    }
    return user;
  }

  async getGraphQLUsersFromIds(ids: string[]): Promise<GraphQLUserParent[]> {
    return kyselyUserFindByIds(this.kyselyPg, ids);
  }

  async login(params: GQLMutationLoginArgs, context: PassportGqlContext) {
    const { email, password } = safePick(params.input, ['email', 'password']);

    // Reject missing/empty credentials as a bad request before verifying.
    if (
      typeof email !== 'string' ||
      email.length === 0 ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      throw makeBadRequestError('Email and password are required.', {
        shouldErrorSpan: true,
      });
    }

    const user = await verifyEmailPasswordCredentials(
      {
        kyselyPg: this.kyselyPg,
        orgSettingsService: this.orgSettingsService,
        tracer: this.tracer,
      },
      email,
      password,
    );

    await context.login(user);

    return user;
  }

  async logout(context: PassportGqlContext) {
    try {
      await context.logout();
      return true;
    } catch (e) {
      // Session teardown is best-effort: surface the failure to the active
      // tracing span (mirrors the pattern used elsewhere in this file and in
      // `verifyEmailPasswordCredentials`) but still report `false` to the
      // client so a stale session doesn't block the logout response.
      this.tracer.logActiveSpanFailedIfAny(e);
      return false;
    }
  }

  async signUp(
    params: GQLMutationSignUpArgs,
    _: unknown,
  ): Promise<GraphQLUserParent> {
    const { role } = params.input;
    const {
      email,
      password,
      firstName,
      lastName,
      orgId,
      inviteUserToken,
      loginMethod,
    } = params.input;

    if (password == null && loginMethod === 'PASSWORD')
      throw makeBadRequestError(
        'Password is required for password login method',
        { shouldErrorSpan: true },
      );

    const existingUser = await kyselyUserFindByEmail(this.kyselyPg, email);
    if (existingUser != null) {
      throw makeSignUpUserExistsError({ shouldErrorSpan: true });
    }
    const passwordToSave =
      password == null ? null : await hashPassword(password);

    let token;
    if (inviteUserToken != null) {
      token = await this.userManagementService.getInviteUserToken({
        token: inviteUserToken,
      });
    }
    if (
      !(
        token != null &&
        token.email === email &&
        token.orgId === orgId &&
        token.role === role &&
        Date.now() - new Date(token.createdAt).getTime() < 2 * WEEK_MS
      )
    ) {
      throw makeUnauthorizedError('Invalid invite token', {
        shouldErrorSpan: true,
      });
    }

    const loginMethodNormalized = String(
      loginMethod,
    ).toLowerCase() as LoginMethod;
    const createInput = {
      email,
      firstName,
      lastName,
      role: token.role,
      loginMethods: [loginMethodNormalized] as const,
      password: passwordToSave,
    };

    const validation = validateUserCreateInput(createInput);
    if (!validation.ok) {
      throw userValidationFailureToBadRequestError(validation.failure);
    }

    const user = await kyselyUserInsert({
      db: this.kyselyPg,
      id: uid(),
      orgId,
      email,
      password: passwordToSave,
      firstName,
      lastName,
      role: token.role,
      approvedByAdmin: true,
      loginMethods: [loginMethodNormalized],
    });

    // Delete the invite token after successful user creation
    await this.userManagementService.deleteInvite(token.id, orgId);

    return user;
  }

  async updateAccountInfo(
    user: GraphQLUserParent,
    params: { firstName?: string | null; lastName?: string | null },
  ): Promise<GraphQLUserParent> {
    const patch = {
      firstName: params.firstName ?? undefined,
      lastName: params.lastName ?? undefined,
    };

    const validation = validateUserUpdatePatch(patch);
    if (!validation.ok) {
      throw userValidationFailureToBadRequestError(validation.failure);
    }

    const updated = await kyselyUserUpdate(this.kyselyPg, user.id, patch);
    if (updated == null) {
      // Row went missing between load and update (e.g. concurrent delete).
      throw makeNotFoundError(`User ${user.id} not found`, {
        shouldErrorSpan: true,
      });
    }
    return updated;
  }

  async changePassword(
    user: GraphQLUserParent,
    params: { currentPassword: string; newPassword: string },
    // The caller's current session id, preserved so the user isn't logged out
    // of the session they're changing their password from.
    currentSid?: string,
  ) {
    const { currentPassword, newPassword } = params;

    if (!user.loginMethods.includes('password')) {
      throw makeChangePasswordNotAllowedError({
        detail: 'Password login is not enabled for this user.',
        shouldErrorSpan: true,
      });
    }

    if (user.password == null) {
      throw makeChangePasswordIncorrectPasswordError({
        detail: 'Current password is not set.',
        shouldErrorSpan: true,
      });
    }

    const isCurrentPasswordValid = await passwordMatchesHash(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw makeChangePasswordIncorrectPasswordError({
        shouldErrorSpan: true,
      });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    // Update the password and invalidate the user's other sessions atomically:
    // if the session purge failed independently, a phished/attacker session
    // could outlive the password change. Keep the caller's own session.
    await makeKyselyTransactionWithRetry<CombinedPg>(this.kyselyPg)(
      async (trx) => {
        const updated = await kyselyUserUpdate(trx, user.id, {
          password: hashedNewPassword,
        });
        if (updated == null) {
          // Row went missing between load and update (e.g. concurrent delete).
          throw makeNotFoundError(`User ${user.id} not found`, {
            shouldErrorSpan: true,
          });
        }

        await deleteSessionsForUser(trx, user.id, { exceptSid: currentSid });
      },
    );

    return {
      __typename: 'ChangePasswordSuccessResponse' as const,
      _: true,
    };
  }

  async deleteUser(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    try {
      const user = await kyselyUserFindByIdAndOrg(this.kyselyPg, {
        id,
        orgId,
      });
      if (user != null) {
        await this.kyselyPg
          .deleteFrom('public.users')
          .where('id', '=', id)
          .where('org_id', '=', orgId)
          .execute();
      }
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }
      return false;
    }
    return true;
  }

  async approveUser(id: string, invokerOrgId: string) {
    const user = await kyselyUserFindById(this.kyselyPg, id);
    if (user == null) {
      throw makeNotFoundError(`User ${id} not found`, {
        shouldErrorSpan: true,
      });
    }

    // Security check: ensure admin can only approve users in their own org.
    if (user.orgId !== invokerOrgId) {
      throw makeUnauthorizedError(
        'You can only approve users in your organization',
        { shouldErrorSpan: true },
      );
    }

    const updated = await kyselyUserUpdate(this.kyselyPg, id, {
      approvedByAdmin: true,
    });
    if (updated == null) {
      // Row went missing between load and update (e.g. concurrent delete).
      throw makeNotFoundError(`User ${id} not found`, {
        shouldErrorSpan: true,
      });
    }
    return true;
  }

  async rejectUser(id: string, invokerOrgId: string) {
    const user = await kyselyUserFindById(this.kyselyPg, id);
    if (user == null) {
      throw makeNotFoundError(`User ${id} not found`, {
        shouldErrorSpan: true,
      });
    }

    // Security check: ensure admin can only reject users in their own org.
    if (user.orgId !== invokerOrgId) {
      throw makeUnauthorizedError(
        'You can only reject users in your organization',
        { shouldErrorSpan: true },
      );
    }

    const updated = await kyselyUserUpdate(this.kyselyPg, id, {
      rejectedByAdmin: true,
    });
    if (updated == null) {
      // Row went missing between load and update (e.g. concurrent delete).
      throw makeNotFoundError(`User ${id} not found`, {
        shouldErrorSpan: true,
      });
    }
    return true;
  }

  async getFavoriteRules(
    id: string,
    orgId: string,
  ): Promise<Array<GraphQLRuleParent>> {
    // Make sure the requested user lives in the invoker's org (the caller
    // always passes the invoker's orgId), then scope rule lookups to that
    // org so cross-org data can't leak even if stale favorites exist.
    await this.getGraphQLUserFromId({ id, orgId });
    const ruleIds = await kyselyUserListFavoriteRuleIds(this.kyselyPg, id);
    const plains = (
      await Promise.all(
        ruleIds.map(async (ruleId) =>
          this.moderationConfigService.getRuleByIdAndOrg(ruleId, orgId),
        ),
      )
    ).filter((plain): plain is NonNullable<typeof plain> => plain != null);
    return plains.map((plain) =>
      buildGraphqlRuleParent(plain, {
        moderationConfigService: this.moderationConfigService,
        findUserByIdAndOrg: async (opts) =>
          kyselyUserFindByIdAndOrg(this.kyselyPg, opts),
      }),
    );
  }

  async addFavoriteRule(userId: string, ruleId: string, orgId: string) {
    // Scope by org so a caller can't add a favorite targeting a rule in a
    // different org (the Sequelize association was unscoped).
    await this.getGraphQLUserFromId({ id: userId, orgId });
    const rule = await this.moderationConfigService.getRuleByIdAndOrg(
      ruleId,
      orgId,
    );
    if (rule == null) {
      throw makeNotFoundError(`Rule ${ruleId} not found in org ${orgId}`, {
        shouldErrorSpan: true,
      });
    }
    await kyselyUserAddFavoriteRule(this.kyselyPg, userId, ruleId);
  }

  async removeFavoriteRule(userId: string, ruleId: string, orgId: string) {
    await this.getGraphQLUserFromId({ id: userId, orgId });
    await kyselyUserRemoveFavoriteRule(this.kyselyPg, userId, ruleId);
  }
}

function userValidationFailureToBadRequestError(
  failure: UserValidationFailure,
) {
  return makeBadRequestError(failure.message, {
    pointer: `/input/${failure.field}`,
    shouldErrorSpan: false,
  });
}

export default inject(
  [
    'KyselyPg',
    'Tracer',
    'UserManagementService',
    'ModerationConfigService',
    'OrgSettingsService',
  ],
  UserAPI,
);
export type { UserAPI };

// Re-export for backward compatibility with other modules that historically
// imported these from `UserApi`. New code should import directly from
// `./userApiErrors`.
export {
  makeChangePasswordIncorrectPasswordError,
  makeChangePasswordNotAllowedError,
  makeLoginIncorrectPasswordError,
  makeLoginSsoRequiredError,
  makeLoginUserDoesNotExistError,
  makeSignUpUserExistsError,
  type SignUpErrorType,
  type UserErrorType,
} from './userApiErrors.js';
