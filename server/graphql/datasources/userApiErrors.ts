import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';

/**
 * Auth-related typed error factories used by `UserAPI` and the
 * `verifyEmailPasswordCredentials` helper. Lives in its own module so that
 * `userApiCredentials.ts` can import them without creating a circular
 * dependency with `UserApi.ts` (which imports the credentials helper).
 */

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
