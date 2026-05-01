import { type Exception } from '@opentelemetry/api';
import { type PassportContext } from 'graphql-passport';
import { uid } from 'uid';

import {
  type GQLMutationLoginArgs,
  type GQLMutationSignUpArgs,
} from '../generated.js';
import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type Rule } from '../../models/rules/RuleModel.js';
import { type LoginMethod } from '../../services/coreAppTables.js';
import {
  hashPassword,
  passwordMatchesHash,
} from '../../services/userManagementService/index.js';
import {
  CoopError,
  ErrorType,
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { safePick } from '../../utils/misc.js';
import { WEEK_MS } from '../../utils/time.js';
import { buildGraphqlRuleParent } from './buildGraphqlRuleParent.js';
import {
  type GraphQLUserParent,
  kyselyUserAddFavoriteRule,
  kyselyUserFindByEmail,
  kyselyUserFindByIdAndOrg,
  kyselyUserFindById,
  kyselyUserFindByIds,
  kyselyUserInsert,
  kyselyUserListFavoriteRuleIds,
  kyselyUserRemoveFavoriteRule,
  kyselyUserUpdate,
} from './userKyselyPersistence.js';
import {
  type UserValidationFailure,
  validateUserCreateInput,
  validateUserUpdatePatch,
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

  async login(
    params: GQLMutationLoginArgs,
    context: PassportContext<GraphQLUserParent, { email: string; password: string }>,
  ) {
    const credentials = safePick(params.input, ['email', 'password']);

    // NB: this will throw for bad credentials; will be handled in the resolver.
    const { user } = await context.authenticate('graphql-local', credentials);

    if (!user) {
      throw makeInternalServerError('Unknown error during login attempt', {
        shouldErrorSpan: true,
      });
    }

    await context.login(user);

    return user;
  }

  async logout(context: { logout(): void }) {
    try {
      context.logout();
      return true;
    } catch (_) {
      return false;
    }
  }

  async signUp(params: GQLMutationSignUpArgs, _: unknown): Promise<GraphQLUserParent> {
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

    const loginMethodNormalized = String(loginMethod).toLowerCase() as LoginMethod;
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
    const updated = await kyselyUserUpdate(this.kyselyPg, user.id, {
      password: hashedNewPassword,
    });
    if (updated == null) {
      // Row went missing between load and update (e.g. concurrent delete).
      throw makeNotFoundError(`User ${user.id} not found`, {
        shouldErrorSpan: true,
      });
    }

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

  async getFavoriteRules(id: string, orgId: string): Promise<Array<Rule>> {
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

function userValidationFailureToBadRequestError(failure: UserValidationFailure) {
  return makeBadRequestError(failure.message, {
    pointer: `/input/${failure.field}`,
    shouldErrorSpan: false,
  });
}

export default inject(
  ['KyselyPg', 'Tracer', 'UserManagementService', 'ModerationConfigService'],
  UserAPI,
);
export type { UserAPI };

export type UserErrorType =
  | 'LoginUserDoesNotExistError'
  | 'LoginIncorrectPasswordError'
  | 'LoginSsoRequiredError'
  | 'CannotDeleteDefaultUserError'
  | 'ChangePasswordIncorrectPasswordError'
  | 'ChangePasswordNotAllowedError';

export const makeLoginUserDoesNotExistError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 401,
    type: [ErrorType.Unauthenticated],
    title: 'User with this email does not exist.',
    name: 'LoginUserDoesNotExistError',
    ...data,
  });

export const makeLoginIncorrectPasswordError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 401,
    type: [ErrorType.Unauthenticated],
    title: 'Incorrect password.',
    name: 'LoginIncorrectPasswordError',
    ...data,
  });

export const makeLoginSsoRequiredError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 401,
    type: [ErrorType.Unauthenticated],
    title: 'SSO Login is Required',
    name: 'LoginSsoRequiredError',
    ...data,
  });

export type SignUpErrorType = 'SignUpUserExistsError';

export const makeSignUpUserExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'User with this email already exists.',
    name: 'SignUpUserExistsError',
    ...data,
  });

export const makeChangePasswordIncorrectPasswordError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 401,
    type: [ErrorType.Unauthenticated],
    title: 'Current password is incorrect.',
    name: 'ChangePasswordIncorrectPasswordError',
    ...data,
  });

export const makeChangePasswordNotAllowedError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 403,
    type: [ErrorType.Unauthorized],
    title: 'Password change is not allowed for this user.',
    name: 'ChangePasswordNotAllowedError',
    ...data,
  });
