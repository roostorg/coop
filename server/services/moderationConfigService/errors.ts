import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';

export type ItemTypeErrorType =
  | 'ItemTypeSchemaIncompatibleError'
  | 'InvalidItemTypeSchemaError'
  | 'InvalidItemTypeHiddenFieldsError'
  | 'ItemTypeNameAlreadyExistsError';

export const makeItemTypeSchemaIncompatibleError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.Conflict],
    title: 'The item type schema is not backward compatible.',
    name: 'ItemTypeSchemaIncompatibleError',
    ...data,
  });

export const makeInvalidItemTypeSchemaError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'The item type schema is invalid.',
    name: 'InvalidItemTypeSchemaError',
    ...data,
  });

export const makeInvalidItemTypeHiddenFieldsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'The item type hidden fields are invalid.',
    name: 'InvalidItemTypeHiddenFieldsError',
    ...data,
  });

export const makeItemTypeNameAlreadyExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'An item type with that name already exists in this organization.',
    name: 'ItemTypeNameAlreadyExistsError',
    ...data,
  });

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
