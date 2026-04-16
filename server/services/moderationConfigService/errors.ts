import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';

export type RuleErrorType =
  | 'RuleNameExistsError'
  | 'RuleHasRunningBacktestsError'
  | 'RuleIsMissingContentTypeError';

export const makeRuleNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A rule with that name already exists in this organization.',
    name: 'RuleNameExistsError',
    ...data,
  });

export const makeRuleIsMissingContentTypeError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'This rule must contain a content type on which to operate.',
    name: 'RuleIsMissingContentTypeError',
    ...data,
  });

export const makeRuleHasRunningBacktestsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.AttemptingToMutateActiveRule],
    title:
      "This rule cannot be updated while it has running backtests, which are using the rule's current conditions.",
    name: 'RuleHasRunningBacktestsError',
    ...data,
  });

export type LocationBankErrorType = 'LocationBankNameExistsError';

export const makeLocationBankNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'A location bank with this name already exists',
    name: 'LocationBankNameExistsError',
    ...data,
  });
