export {
  ItemTypeKind,
  ItemSchema,
  ItemTypeSchemaVariant,
  ItemType,
  UserItemType,
  ContentItemType,
  ThreadItemType,
  UserSchemaFieldRoles,
  ThreadSchemaFieldRoles,
  ContentSchemaFieldRoles,
  SchemaFieldRoles,
  ItemTypeIdentifier,
  ItemTypeSelector,
  FieldRoleToScalarType,
} from './types/itemTypes.js';

export {
  RuleType,
  RuleStatus,
  RuleAlarmStatus,
  ConditionInput,
  CoopInput,
  ValueComparator,
  ConditionConjunction,
  Condition,
  ConditionSet,
  LeafCondition,
  ConditionSignalInfo,
  PlainRuleWithLatestVersion,
  RuleLatestVersionRow,
  RuleWithLatestVersion,
  computeRuleStatusFromRow,
} from './types/rules.js';

export {
  ConditionCompletionOutcome,
  ConditionFailureOutcome,
  ConditionOutcome,
  ConditionCompletionMetadata,
  ConditionFailureMetadata,
  ConditionResult,
  ConditionWithResult,
  ConditionSetWithResult,
  LeafConditionWithResult,
} from './types/conditionResults.js';

export {
  Action,
  ActionType,
  CustomAction,
  EnqueueToMrtAction,
} from './types/actions.js';

export { BUILT_IN_ACTIONS } from './modules/ActionOperations.js';

export type { ModerationConfigServicePg } from './dbTypes.js';

export { Policy, PolicyType } from './types/policies.js';
export { type ModerationConfigMutationActor } from './types/mutationActor.js';

export { UserPenaltySeverity } from './types/shared.js';

export { LocationArea, LocationGeometry } from './types/locationArea.js';

export {
  MatchingValueType,
  MatchingValues,
  getMatchingValuesType,
  isLocationArea,
} from './types/matchingValues.js';

export {
  TaggedItemData,
  isTaggedItemData,
  isTextValue,
  isTranscribableType,
  isTranscribableValue,
} from './types/itemTypeFields.js';

export {
  ModerationConfigService,
  ModerationConfigErrorType,
} from './moderationConfigService.js';

export {
  type ItemTypeErrorType,
  makeItemTypeSchemaIncompatibleError,
  makeInvalidItemTypeSchemaError,
  makeInvalidItemTypeHiddenFieldsError,
  makeItemTypeNameAlreadyExistsError,
  makeRuleNameExistsError,
  makeRuleIsMissingContentTypeError,
  makeRuleHasRunningBacktestsError,
  makeLocationBankNameExistsError,
} from './errors.js';

export {
  assertValidItemSchema,
  assertBackwardCompatibleItemSchema,
  assertHiddenFieldsExist,
} from './modules/itemTypeSchemaValidation.js';

export {
  ACTION_PARAMETER_TYPES,
  type ActionParameter,
  type ActionParameterOption,
  type ActionParameterType,
  type RawActionParameterInput,
  parseStoredParameters,
  serializeParameters,
  validateActionParameters,
} from './modules/actionParametersValidation.js';
export {
  resolveConfiguredActionParameterValues,
  validateActionParameterValues,
} from './modules/actionParameterValueValidation.js';
export {
  makeInvalidPolicyParentError,
  makePolicyHierarchyCycleError,
} from './modules/PolicyOperations.js';
export {
  makeBuiltInActionImmutableError,
  makeInvalidActionItemTypeIdsError,
} from './modules/ActionOperations.js';
export {
  MAX_ACTOR_NOTE_LENGTH,
  validateActorNote,
} from './modules/actorNoteValidation.js';
