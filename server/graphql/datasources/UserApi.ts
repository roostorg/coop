/* eslint-disable max-classes-per-file */

import { type Exception } from '@opentelemetry/api';
import { DataSource } from 'apollo-datasource';
import { type PassportContext } from 'graphql-passport';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type Rule } from '../../models/rules/RuleModel.js';
import { type User as TUser } from '../../models/UserModel.js';
import { hashPassword } from '../../services/userManagementService/index.js';
import {
  CoopError,
  ErrorType,
  makeBadRequestError,
  makeInternalServerError,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { safePick } from '../../utils/misc.js';
import { WEEK_MS } from '../../utils/time.js';

/**
 * GraphQL Object for a User
 */
class UserAPI extends DataSource {
  constructor(
    private readonly sequelize: Dependencies['Sequelize'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly userManagementService: Dependencies['UserManagementService'],
  ) {
    super();
  }

  async getGraphQLUserFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;

    return this.sequelize.User.findOne({
      where: {
        id,
        orgId,
      },
      rejectOnEmpty: true,
    });
  }

  async getGraphQLUsersFromIds(ids: string[]) {
    return this.sequelize.User.findAll({
      where: { id: ids },
    });
  }

  async login(params: any, context: PassportContext<TUser, any>) {
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

  async logout(context: any) {
    try {
      context.logout();
      return true;
    } catch (_) {
      return false;
    }
  }

  async signUp(params: any, _: any) {
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

    const existingUser = await this.sequelize.User.findOne({
      where: { email },
    });
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

    const user = await this.sequelize.User.create({
      id: uid(),
      email,
      password: passwordToSave,
      firstName,
      lastName,
      role: token.role,
      approvedByAdmin: true,
      orgId,
      loginMethods: [loginMethod.toLowerCase()],
    });

    // Delete the invite token after successful user creation
    await this.userManagementService.deleteInvite(token.id, orgId);

    return user;
  }

  async updateAccountInfo(
    user: TUser,
    params: { firstName?: string | null; lastName?: string | null },
  ) {
    const { firstName, lastName } = params;
    if (firstName != null) {
      user.firstName = firstName;
    }
    if (lastName != null) {
      user.lastName = lastName;
    }
    await user.save();
  }

  async changePassword(
    user: TUser,
    params: { currentPassword: string; newPassword: string },
  ) {
    const { currentPassword, newPassword } = params;

    // Check if user has password login method
    if (!user.loginMethods.includes('password')) {
      throw makeChangePasswordNotAllowedError({
        detail: 'Password login is not enabled for this user.',
        shouldErrorSpan: true,
      });
    }

    // Verify current password
    if (user.password == null) {
      throw makeChangePasswordIncorrectPasswordError({
        detail: 'Current password is not set.',
        shouldErrorSpan: true,
      });
    }

    const isCurrentPasswordValid = await this.sequelize.User.passwordMatchesHash(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw makeChangePasswordIncorrectPasswordError({
        shouldErrorSpan: true,
      });
    }

    // Hash and save new password
    const hashedNewPassword = await hashPassword(newPassword);
    user.password = hashedNewPassword;
    await user.save();

    return {
      __typename: 'ChangePasswordSuccessResponse' as const,
      _: true,
    };
  }

  async deleteUser(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    try {
      const user = await this.sequelize.User.findOne({ where: { id, orgId } });
      await user?.destroy();
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
    const user = await this.sequelize.User.findByPk(id, {
      rejectOnEmpty: true,
    });
    
    // Security check: ensure admin can only approve users in their own org
    if (user.orgId !== invokerOrgId) {
      throw makeUnauthorizedError(
        'You can only approve users in your organization',
        { shouldErrorSpan: true },
      );
    }
    
    user.approvedByAdmin = true;
    await user.save();
    return true;
  }

  async rejectUser(id: string, invokerOrgId: string) {
    const user = await this.sequelize.User.findByPk(id, {
      rejectOnEmpty: true,
    });
    
    // Security check: ensure admin can only reject users in their own org
    if (user.orgId !== invokerOrgId) {
      throw makeUnauthorizedError(
        'You can only reject users in your organization',
        { shouldErrorSpan: true },
      );
    }
    
    user.rejectedByAdmin = true;
    await user.save();
    return true;
  }

  async getFavoriteRules(id: string, orgId: string): Promise<Array<Rule>> {
    const user = await this.getGraphQLUserFromId({ id, orgId });
    const rules = await user.getFavoriteRules();
    return rules;
  }

  async addFavoriteRule(userId: string, ruleId: string, orgId: string) {
    const user = await this.getGraphQLUserFromId({ id: userId, orgId });
    await user.addFavoriteRules([ruleId]);
  }

  async removeFavoriteRule(userId: string, ruleId: string, orgId: string) {
    const user = await this.getGraphQLUserFromId({ id: userId, orgId });
    await user.removeFavoriteRules([ruleId]);
  }
}

export default inject(
  ['Sequelize', 'Tracer', 'UserManagementService'],
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
