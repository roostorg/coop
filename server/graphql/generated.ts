/* eslint-disable */
import type {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';
import { JsonObject, JsonValue } from 'type-fest';

import type { UserHistoryForGQL } from '../graphql/datasources/InvestigationApi.js';
import type {
  ContentItemTypeResolversParentType,
  ItemTypeResolversParentType,
  ItemTypeSchemaVariantInputResolverValue,
  ItemTypeSchemaVariantResolverValue,
  ThreadItemTypeResolversParentType,
  UserItemTypeResolversParentType,
} from '../graphql/modules/itemType.js';
import type { ReportingInsights } from '../graphql/modules/reporting.js';
import type { HashBank } from '../models/HashBankModel.js';
import type { Org } from '../models/OrgModel.js';
import type {
  CustomAction,
  EnqueueAuthorToMrtAction,
  EnqueueToMrtAction,
  EnqueueToNcmecAction,
} from '../models/rules/ActionModel.js';
import type { Backtest } from '../models/rules/BacktestModel.js';
import type { ItemType } from '../models/rules/ItemTypeModel.js';
import type {
  ConditionSetWithResult,
  ConditionWithResult,
  LeafConditionWithResult,
  Rule,
} from '../models/rules/RuleModel.js';
import type { User } from '../models/UserModel.js';
import type { SignalWithScore } from '../services/analyticsQueries/RuleActionInsights.js';
import type { DerivedFieldSpecSource } from '../services/derivedFieldsService/helpers.js';
import type {
  ContentAppealReviewJobPayload,
  ContentManualReviewJobPayload,
  ManualReviewJobOrAppeal,
  ManualReviewJobPayload,
  ManualReviewQueue,
  NcmecManualReviewJobPayload,
  ThreadAppealReviewJobPayload,
  ThreadManualReviewJobPayload,
  UserAppealReviewJobPayload,
  UserManualReviewJobPayload,
} from '../services/manualReviewToolService/index.js';
import type { ManualReviewJobComment } from '../services/manualReviewToolService/modules/CommentOperations.js';
import type { RoutingRuleWithoutVersion } from '../services/manualReviewToolService/modules/JobRouting.js';
import type {
  Condition,
  ConditionSet,
  LeafCondition,
} from '../services/moderationConfigService/index.js';
import type { Notification } from '../services/notificationsService/notificationsService.js';
import type { ReportingRuleWithoutVersion } from '../services/reportingService/ReportingRules.js';
import type { Signal } from '../services/signalsService/index.js';
import type { NonEmptyString } from '../utils/typescript-types.js';
import type { LocationBankWithoutFullPlacesAPIResponse } from './datasources/LocationBankApi.js';
import type { Context } from './resolvers.js';
import type { ItemSubmissionForGQL } from './types.js';

export type Maybe<T> = T extends Promise<infer U>
  ? Promise<U | null>
  : T | null;
export type InputMaybe<T> = T extends Promise<infer U>
  ? Promise<U | null>
  : T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type EnumResolverSignature<T, AllowedValues = any> = {
  [key in keyof T]?: AllowedValues;
};
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** Represents the possible types for the name of a ConditionInput */
  CoopInputOrString: string;
  Cursor: JsonValue;
  /** Date represents just a date, with no time, no timezone, no offset. */
  Date: Date | string;
  /**
   * DateTime represents an instant, with a UTC offset, serialized in ISO 8601
   * (specifically, the profile of ISO 8601 supported by Date.toISOString()).
   * as implemented by https://www.graphql-scalars.dev/docs/scalars/date-time
   * NB: This is different from Apollo's default serialization of JS Date's, which
   * uses a string with a unix timestamp in it, so be careful when updating existing
   * fields.
   */
  DateTime: Date | string;
  /** Represents an arbitrary json object. */
  JSONObject: JsonObject;
  /** Represents a string that must be non-empty. */
  NonEmptyString: NonEmptyString;
  /** Represents a string | float union, which is the type of a Condition's threshold */
  StringOrFloat: string | number;
};

export type GQLAcceptAppealDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'AcceptAppealDecisionComponent';
    readonly actionIds: ReadonlyArray<Scalars['String']>;
    readonly appealId: Scalars['String'];
    readonly type: GQLManualReviewDecisionType;
  };

export type GQLAction =
  | GQLCustomAction
  | GQLEnqueueAuthorToMrtAction
  | GQLEnqueueToMrtAction
  | GQLEnqueueToNcmecAction;

export type GQLActionBase = {
  readonly applyUserStrikes?: Maybe<Scalars['Boolean']>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly penalty: GQLUserPenaltySeverity;
};

export type GQLActionData = {
  readonly __typename?: 'ActionData';
  readonly action_id?: Maybe<Scalars['String']>;
  readonly count: Scalars['Int'];
  readonly item_type_id?: Maybe<Scalars['String']>;
  readonly policy_id?: Maybe<Scalars['String']>;
  readonly rule_id?: Maybe<Scalars['String']>;
  readonly source?: Maybe<Scalars['String']>;
  readonly time: Scalars['String'];
};

export type GQLActionNameExistsError = GQLError & {
  readonly __typename?: 'ActionNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLActionSource = {
  AutomatedRule: 'AUTOMATED_RULE',
  ManualActionRun: 'MANUAL_ACTION_RUN',
  MrtDecision: 'MRT_DECISION',
  PostActions: 'POST_ACTIONS',
} as const;

export type GQLActionSource =
  (typeof GQLActionSource)[keyof typeof GQLActionSource];
export type GQLActionStatisticsFilters = {
  readonly actionIds: ReadonlyArray<Scalars['String']>;
  readonly endDate: Scalars['DateTime'];
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly ruleIds: ReadonlyArray<Scalars['String']>;
  readonly sources: ReadonlyArray<GQLActionSource>;
  readonly startDate: Scalars['DateTime'];
};

export const GQLActionStatisticsGroupByColumns = {
  ActionId: 'ACTION_ID',
  ActionSource: 'ACTION_SOURCE',
  ItemTypeId: 'ITEM_TYPE_ID',
  PolicyId: 'POLICY_ID',
  RuleId: 'RULE_ID',
} as const;

export type GQLActionStatisticsGroupByColumns =
  (typeof GQLActionStatisticsGroupByColumns)[keyof typeof GQLActionStatisticsGroupByColumns];
export type GQLActionStatisticsInput = {
  readonly filterBy: GQLActionStatisticsFilters;
  readonly groupBy: GQLActionStatisticsGroupByColumns;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly timeZone: Scalars['String'];
};

export type GQLAddAccessibleQueuesToUserInput = {
  readonly queueIds: ReadonlyArray<Scalars['ID']>;
  readonly userId: Scalars['ID'];
};

export type GQLAddAccessibleQueuesToUserResponse =
  GQLMutateAccessibleQueuesForUserSuccessResponse;

export type GQLAddCommentFailedError = GQLError & {
  readonly __typename?: 'AddCommentFailedError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLAddFavoriteMrtQueueSuccessResponse = {
  readonly __typename?: 'AddFavoriteMRTQueueSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLAddFavoriteRuleResponse = GQLAddFavoriteRuleSuccessResponse;

export type GQLAddFavoriteRuleSuccessResponse = {
  readonly __typename?: 'AddFavoriteRuleSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLAddManualReviewJobCommentResponse =
  | GQLAddManualReviewJobCommentSuccessResponse
  | GQLNotFoundError;

export type GQLAddManualReviewJobCommentSuccessResponse = {
  readonly __typename?: 'AddManualReviewJobCommentSuccessResponse';
  readonly comment: GQLManualReviewJobComment;
};

export type GQLAddPoliciesResponse = {
  readonly __typename?: 'AddPoliciesResponse';
  readonly failures: ReadonlyArray<Scalars['String']>;
  readonly policies: ReadonlyArray<GQLPolicy>;
};

export type GQLAddPolicyInput = {
  readonly enforcementGuidelines?: InputMaybe<Scalars['String']>;
  readonly id?: InputMaybe<Scalars['ID']>;
  readonly name: Scalars['String'];
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly parentName?: InputMaybe<Scalars['String']>;
  readonly policyText?: InputMaybe<Scalars['String']>;
  readonly policyType?: InputMaybe<GQLPolicyType>;
};

export type GQLAggregation = {
  readonly __typename?: 'Aggregation';
  readonly type: GQLAggregationType;
};

export type GQLAggregationClause = {
  readonly __typename?: 'AggregationClause';
  readonly aggregation?: Maybe<GQLAggregation>;
  readonly conditionSet?: Maybe<GQLConditionSet>;
  readonly groupBy: ReadonlyArray<GQLConditionInputField>;
  readonly id: Scalars['ID'];
  readonly window: GQLWindowConfiguration;
};

export type GQLAggregationClauseInput = {
  readonly aggregation: GQLAggregationInput;
  readonly conditionSet?: InputMaybe<GQLConditionSetInput>;
  readonly groupBy: ReadonlyArray<GQLConditionInputFieldInput>;
  readonly window: GQLWindowConfigurationInput;
};

export type GQLAggregationInput = {
  readonly type: GQLAggregationType;
};

export type GQLAggregationSignalArgs = {
  readonly __typename?: 'AggregationSignalArgs';
  readonly aggregationClause?: Maybe<GQLAggregationClause>;
};

export type GQLAggregationSignalArgsInput = {
  readonly aggregationClause: GQLAggregationClauseInput;
};

export const GQLAggregationType = {
  Count: 'COUNT',
} as const;

export type GQLAggregationType =
  (typeof GQLAggregationType)[keyof typeof GQLAggregationType];
export type GQLAllLanguages = {
  readonly __typename?: 'AllLanguages';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLAllRuleInsights = {
  readonly __typename?: 'AllRuleInsights';
  readonly actionedSubmissionsByActionByDay: ReadonlyArray<GQLCountByActionByDay>;
  readonly actionedSubmissionsByDay: ReadonlyArray<GQLCountByDay>;
  readonly actionedSubmissionsByPolicyByDay: ReadonlyArray<GQLCountByPolicyByDay>;
  readonly actionedSubmissionsByTagByDay: ReadonlyArray<GQLCountByTagByDay>;
  readonly totalSubmissionsByDay: ReadonlyArray<GQLCountByDay>;
};

export type GQLApiKey = {
  readonly __typename?: 'ApiKey';
  readonly createdAt: Scalars['String'];
  readonly createdBy?: Maybe<Scalars['String']>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly isActive: Scalars['Boolean'];
  readonly lastUsedAt?: Maybe<Scalars['String']>;
  readonly name: Scalars['String'];
};

export const GQLAppealDecision = {
  Accept: 'ACCEPT',
  Reject: 'REJECT',
} as const;

export type GQLAppealDecision =
  (typeof GQLAppealDecision)[keyof typeof GQLAppealDecision];
export type GQLAppealEnqueueSourceInfo = {
  readonly __typename?: 'AppealEnqueueSourceInfo';
  readonly kind: GQLJobCreationSourceOptions;
};

export type GQLAppealSettings = {
  readonly __typename?: 'AppealSettings';
  readonly appealsCallbackBody?: Maybe<Scalars['JSONObject']>;
  readonly appealsCallbackHeaders?: Maybe<Scalars['JSONObject']>;
  readonly appealsCallbackUrl?: Maybe<Scalars['String']>;
};

export type GQLAppealSettingsInput = {
  readonly appealsCallbackBody?: InputMaybe<Scalars['JSONObject']>;
  readonly appealsCallbackHeaders?: InputMaybe<Scalars['JSONObject']>;
  readonly appealsCallbackUrl?: InputMaybe<Scalars['String']>;
};

export type GQLAutomaticCloseDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'AutomaticCloseDecisionComponent';
    readonly type: GQLManualReviewDecisionType;
  };

export type GQLBacktest = {
  readonly __typename?: 'Backtest';
  readonly contentItemsMatched: Scalars['Int'];
  readonly contentItemsProcessed: Scalars['Int'];
  readonly createdAt: Scalars['String'];
  readonly id: Scalars['ID'];
  readonly results?: Maybe<GQLRuleExecutionResultsConnection>;
  readonly sampleActualSize: Scalars['Int'];
  readonly sampleDesiredSize: Scalars['Int'];
  readonly sampleEndAt: Scalars['String'];
  readonly sampleStartAt: Scalars['String'];
  readonly samplingComplete: Scalars['Boolean'];
  readonly status: GQLBacktestStatus;
};

export type GQLBacktestResultsArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<GQLSortOrder>;
};

export const GQLBacktestStatus = {
  Canceled: 'CANCELED',
  Complete: 'COMPLETE',
  Running: 'RUNNING',
} as const;

export type GQLBacktestStatus =
  (typeof GQLBacktestStatus)[keyof typeof GQLBacktestStatus];
export type GQLBaseField = GQLField & {
  readonly __typename?: 'BaseField';
  readonly container?: Maybe<GQLContainer>;
  readonly name: Scalars['String'];
  readonly required: Scalars['Boolean'];
  readonly type: GQLFieldType;
};

export type GQLCannotDeleteDefaultUserError = GQLError & {
  readonly __typename?: 'CannotDeleteDefaultUserError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLChangePasswordError = GQLError & {
  readonly __typename?: 'ChangePasswordError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLChangePasswordInput = {
  readonly currentPassword: Scalars['String'];
  readonly newPassword: Scalars['String'];
};

export type GQLChangePasswordResponse =
  | GQLChangePasswordError
  | GQLChangePasswordSuccessResponse;

export type GQLChangePasswordSuccessResponse = {
  readonly __typename?: 'ChangePasswordSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLCondition = GQLConditionSet | GQLLeafCondition;

export const GQLConditionConjunction = {
  And: 'AND',
  Or: 'OR',
  Xor: 'XOR',
} as const;

export type GQLConditionConjunction =
  (typeof GQLConditionConjunction)[keyof typeof GQLConditionConjunction];
export type GQLConditionInput = {
  readonly comparator?: InputMaybe<GQLValueComparator>;
  readonly conditions?: InputMaybe<ReadonlyArray<GQLConditionInput>>;
  readonly conjunction?: InputMaybe<GQLConditionConjunction>;
  readonly input?: InputMaybe<GQLConditionInputFieldInput>;
  readonly matchingValues?: InputMaybe<GQLConditionMatchingValuesInput>;
  readonly signal?: InputMaybe<GQLConditionInputSignalInput>;
  readonly threshold?: InputMaybe<Scalars['StringOrFloat']>;
};

export type GQLConditionInputField = {
  readonly __typename?: 'ConditionInputField';
  readonly contentTypeId?: Maybe<Scalars['String']>;
  readonly contentTypeIds?: Maybe<ReadonlyArray<Scalars['String']>>;
  readonly name?: Maybe<Scalars['CoopInputOrString']>;
  readonly spec?: Maybe<GQLDerivedFieldSpec>;
  readonly type: GQLConditionInputInputType;
};

export type GQLConditionInputFieldInput = {
  readonly contentTypeId?: InputMaybe<Scalars['String']>;
  readonly contentTypeIds?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly name?: InputMaybe<Scalars['CoopInputOrString']>;
  readonly spec?: InputMaybe<GQLDerivedFieldSpecInput>;
  readonly type: GQLConditionInputInputType;
};

export const GQLConditionInputInputType = {
  ContentCoopInput: 'CONTENT_COOP_INPUT',
  ContentDerivedField: 'CONTENT_DERIVED_FIELD',
  ContentField: 'CONTENT_FIELD',
  FullItem: 'FULL_ITEM',
  UserId: 'USER_ID',
} as const;

export type GQLConditionInputInputType =
  (typeof GQLConditionInputInputType)[keyof typeof GQLConditionInputInputType];
export type GQLConditionInputSignalInput = {
  readonly args?: InputMaybe<GQLSignalArgsInput>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
  readonly subcategory?: InputMaybe<Scalars['String']>;
  readonly type: GQLSignalType;
};

export type GQLConditionMatchingValuesInput = {
  readonly imageBankIds?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly locationBankIds?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly locations?: InputMaybe<ReadonlyArray<GQLLocationAreaInput>>;
  readonly strings?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly textBankIds?: InputMaybe<ReadonlyArray<Scalars['String']>>;
};

export const GQLConditionOutcome = {
  Errored: 'ERRORED',
  Failed: 'FAILED',
  Inapplicable: 'INAPPLICABLE',
  Passed: 'PASSED',
} as const;

export type GQLConditionOutcome =
  (typeof GQLConditionOutcome)[keyof typeof GQLConditionOutcome];
export type GQLConditionResult = {
  readonly __typename?: 'ConditionResult';
  readonly matchedValue?: Maybe<Scalars['String']>;
  readonly outcome: GQLConditionOutcome;
  readonly score?: Maybe<Scalars['String']>;
};

export type GQLConditionSet = {
  readonly __typename?: 'ConditionSet';
  readonly conditions: ReadonlyArray<GQLCondition>;
  readonly conjunction: GQLConditionConjunction;
};

export type GQLConditionSetInput = {
  readonly conditions: ReadonlyArray<GQLConditionInput>;
  readonly conjunction: GQLConditionConjunction;
};

export type GQLConditionSetWithResult = {
  readonly __typename?: 'ConditionSetWithResult';
  readonly conditions: ReadonlyArray<GQLConditionWithResult>;
  readonly conjunction?: Maybe<GQLConditionConjunction>;
  readonly result?: Maybe<GQLConditionResult>;
};

export type GQLConditionWithResult =
  | GQLConditionSetWithResult
  | GQLLeafConditionWithResult;

export type GQLContainer = {
  readonly __typename?: 'Container';
  readonly containerType: GQLContainerType;
  readonly keyScalarType?: Maybe<GQLScalarType>;
  readonly valueScalarType: GQLScalarType;
};

export type GQLContainerInput = {
  readonly containerType: GQLContainerType;
  readonly keyScalarType?: InputMaybe<GQLScalarType>;
  readonly valueScalarType: GQLScalarType;
};

export const GQLContainerType = {
  Array: 'ARRAY',
  Map: 'MAP',
} as const;

export type GQLContainerType =
  (typeof GQLContainerType)[keyof typeof GQLContainerType];
export type GQLContentAppealManualReviewJobPayload = {
  readonly __typename?: 'ContentAppealManualReviewJobPayload';
  readonly actionsTaken: ReadonlyArray<Scalars['String']>;
  readonly additionalContentItems: ReadonlyArray<GQLContentItem>;
  readonly appealId: Scalars['String'];
  readonly appealReason?: Maybe<Scalars['String']>;
  readonly appealerIdentifier?: Maybe<GQLItemIdentifier>;
  readonly enqueueSourceInfo?: Maybe<GQLAppealEnqueueSourceInfo>;
  readonly item: GQLContentItem;
  readonly userScore?: Maybe<Scalars['Int']>;
};

export type GQLContentItem = GQLItemBase & {
  readonly __typename?: 'ContentItem';
  readonly data: Scalars['JSONObject'];
  readonly id: Scalars['ID'];
  readonly submissionId: Scalars['ID'];
  readonly submissionTime?: Maybe<Scalars['DateTime']>;
  readonly type: GQLContentItemType;
};

export type GQLContentItemType = GQLItemTypeBase & {
  readonly __typename?: 'ContentItemType';
  readonly baseFields: ReadonlyArray<GQLBaseField>;
  readonly derivedFields: ReadonlyArray<GQLDerivedField>;
  readonly description?: Maybe<Scalars['String']>;
  readonly hiddenFields: ReadonlyArray<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly schemaFieldRoles: GQLContentSchemaFieldRoles;
  readonly schemaVariant: GQLItemTypeSchemaVariant;
  readonly version: Scalars['String'];
};

export type GQLContentManualReviewJobPayload = {
  readonly __typename?: 'ContentManualReviewJobPayload';
  readonly additionalContentItems: ReadonlyArray<GQLContentItem>;
  readonly enqueueSourceInfo?: Maybe<GQLManualReviewJobEnqueueSourceInfo>;
  readonly item: GQLContentItem;
  readonly itemThreadContentItems?: Maybe<ReadonlyArray<GQLContentItem>>;
  readonly reportHistory: ReadonlyArray<GQLReportHistoryEntry>;
  readonly reportedForReason?: Maybe<Scalars['String']>;
  readonly reportedForReasons: ReadonlyArray<GQLReportedForReason>;
  readonly userScore?: Maybe<Scalars['Int']>;
};

export type GQLContentRule = GQLRule & {
  readonly __typename?: 'ContentRule';
  readonly actions: ReadonlyArray<GQLAction>;
  readonly backtests: ReadonlyArray<GQLBacktest>;
  readonly conditionSet: GQLConditionSet;
  readonly createdAt: Scalars['String'];
  readonly creator: GQLUser;
  readonly description?: Maybe<Scalars['String']>;
  readonly expirationTime?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly insights: GQLRuleInsights;
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly maxDailyActions?: Maybe<Scalars['Float']>;
  readonly name: Scalars['String'];
  readonly parentId?: Maybe<Scalars['ID']>;
  readonly policies: ReadonlyArray<GQLPolicy>;
  readonly status: GQLRuleStatus;
  readonly tags?: Maybe<ReadonlyArray<Maybe<Scalars['String']>>>;
  readonly updatedAt: Scalars['String'];
};

export type GQLContentRuleBacktestsArgs = {
  ids?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
};

export type GQLContentSchemaFieldRoles = {
  readonly __typename?: 'ContentSchemaFieldRoles';
  readonly createdAt?: Maybe<Scalars['String']>;
  readonly creatorId?: Maybe<Scalars['String']>;
  readonly displayName?: Maybe<Scalars['String']>;
  readonly isDeleted?: Maybe<Scalars['String']>;
  readonly parentId?: Maybe<Scalars['String']>;
  readonly threadId?: Maybe<Scalars['String']>;
};

export type GQLContentSchemaFieldRolesInput = {
  readonly createdAt?: InputMaybe<Scalars['String']>;
  readonly creatorId?: InputMaybe<Scalars['String']>;
  readonly displayName?: InputMaybe<Scalars['String']>;
  readonly isDeleted?: InputMaybe<Scalars['String']>;
  readonly parentId?: InputMaybe<Scalars['String']>;
  readonly threadId?: InputMaybe<Scalars['String']>;
};

export type GQLContentType = {
  readonly __typename?: 'ContentType';
  readonly actions: ReadonlyArray<GQLAction>;
  readonly baseFields: ReadonlyArray<GQLBaseField>;
  readonly derivedFields: ReadonlyArray<GQLDerivedField>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
};

export type GQLCoopActionDecisionInput = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export const GQLCoopInput = {
  AllText: 'ALL_TEXT',
  AnyGeohash: 'ANY_GEOHASH',
  AnyImage: 'ANY_IMAGE',
  AnyVideo: 'ANY_VIDEO',
  AuthorUser: 'AUTHOR_USER',
  PolicyId: 'POLICY_ID',
  Source: 'SOURCE',
} as const;

export type GQLCoopInput = (typeof GQLCoopInput)[keyof typeof GQLCoopInput];
export type GQLCountByActionByDay = {
  readonly __typename?: 'CountByActionByDay';
  readonly action: GQLCountByActionByDayAction;
  readonly count: Scalars['Int'];
  readonly date: Scalars['Date'];
};

export type GQLCountByActionByDayAction = {
  readonly __typename?: 'CountByActionByDayAction';
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
};

export type GQLCountByDay = {
  readonly __typename?: 'CountByDay';
  readonly count: Scalars['Int'];
  readonly date: Scalars['Date'];
};

export type GQLCountByDecisionTypeByDay = {
  readonly __typename?: 'CountByDecisionTypeByDay';
  readonly count: Scalars['Int'];
  readonly date: Scalars['Date'];
  readonly decisionType: Scalars['String'];
};

export type GQLCountByPolicyByDay = {
  readonly __typename?: 'CountByPolicyByDay';
  readonly count: Scalars['Int'];
  readonly date: Scalars['Date'];
  readonly policy: GQLCountByPolicyByDayPolicy;
};

export type GQLCountByPolicyByDayPolicy = {
  readonly __typename?: 'CountByPolicyByDayPolicy';
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
};

export type GQLCountByTagByDay = {
  readonly __typename?: 'CountByTagByDay';
  readonly count: Scalars['Int'];
  readonly date: Scalars['Date'];
  readonly tag: Scalars['String'];
};

export type GQLCreateActionInput = {
  readonly applyUserStrikes?: InputMaybe<Scalars['Boolean']>;
  readonly callbackUrl: Scalars['String'];
  readonly callbackUrlBody?: InputMaybe<Scalars['JSONObject']>;
  readonly callbackUrlHeaders?: InputMaybe<Scalars['JSONObject']>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly itemTypeIds: ReadonlyArray<Scalars['ID']>;
  readonly name: Scalars['String'];
};

export type GQLCreateBacktestInput = {
  readonly ruleId: Scalars['ID'];
  readonly sampleDesiredSize: Scalars['Int'];
  readonly sampleEndAt: Scalars['String'];
  readonly sampleStartAt: Scalars['String'];
};

export type GQLCreateBacktestResponse = {
  readonly __typename?: 'CreateBacktestResponse';
  readonly backtest: GQLBacktest;
};

export type GQLCreateContentItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles: GQLContentSchemaFieldRolesInput;
  readonly fields: ReadonlyArray<GQLFieldInput>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly name: Scalars['String'];
};

export type GQLCreateContentRuleInput = {
  readonly actionIds: ReadonlyArray<Scalars['ID']>;
  readonly conditionSet: GQLConditionSetInput;
  readonly contentTypeIds: ReadonlyArray<Scalars['ID']>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly expirationTime?: InputMaybe<Scalars['DateTime']>;
  readonly maxDailyActions?: InputMaybe<Scalars['Float']>;
  readonly name: Scalars['String'];
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly policyIds: ReadonlyArray<Scalars['ID']>;
  readonly status: GQLRuleStatus;
  readonly tags: ReadonlyArray<Scalars['String']>;
};

export type GQLCreateContentRuleResponse =
  | GQLMutateContentRuleSuccessResponse
  | GQLRuleNameExistsError;

export type GQLCreateHashBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly enabled_ratio: Scalars['Float'];
  readonly name: Scalars['String'];
};

export type GQLCreateLocationBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly locations: ReadonlyArray<GQLLocationAreaInput>;
  readonly name: Scalars['String'];
};

export type GQLCreateManualReviewJobCommentInput = {
  readonly commentText: Scalars['String'];
  readonly jobId: Scalars['String'];
};

export type GQLCreateManualReviewQueueInput = {
  readonly autoCloseJobs: Scalars['Boolean'];
  readonly description?: InputMaybe<Scalars['String']>;
  readonly hiddenActionIds: ReadonlyArray<Scalars['ID']>;
  readonly isAppealsQueue: Scalars['Boolean'];
  readonly name: Scalars['String'];
  readonly userIds: ReadonlyArray<Scalars['ID']>;
};

export type GQLCreateManualReviewQueueResponse =
  | GQLManualReviewQueueNameExistsError
  | GQLMutateManualReviewQueueSuccessResponse;

export type GQLCreateOrgInput = {
  readonly email: Scalars['String'];
  readonly name: Scalars['String'];
  readonly website: Scalars['String'];
};

export type GQLCreateOrgResponse =
  | GQLCreateOrgSuccessResponse
  | GQLOrgWithEmailExistsError
  | GQLOrgWithNameExistsError;

export type GQLCreateOrgSuccessResponse = {
  readonly __typename?: 'CreateOrgSuccessResponse';
  readonly id: Scalars['ID'];
};

export type GQLCreateReportingRuleInput = {
  readonly actionIds: ReadonlyArray<Scalars['ID']>;
  readonly conditionSet: GQLConditionSetInput;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly itemTypeIds: ReadonlyArray<Scalars['ID']>;
  readonly name: Scalars['String'];
  readonly policyIds: ReadonlyArray<Scalars['ID']>;
  readonly status: GQLReportingRuleStatus;
};

export type GQLCreateReportingRuleResponse =
  | GQLMutateReportingRuleSuccessResponse
  | GQLReportingRuleNameExistsError;

export type GQLCreateRoutingRuleInput = {
  readonly conditionSet: GQLConditionSetInput;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly destinationQueueId: Scalars['ID'];
  readonly isAppealsRule?: InputMaybe<Scalars['Boolean']>;
  readonly itemTypeIds: ReadonlyArray<Scalars['ID']>;
  readonly name: Scalars['String'];
  readonly sequenceNumber?: InputMaybe<Scalars['Int']>;
  readonly status: GQLRoutingRuleStatus;
};

export type GQLCreateRoutingRuleResponse =
  | GQLMutateRoutingRuleSuccessResponse
  | GQLQueueDoesNotExistError
  | GQLRoutingRuleNameExistsError;

export type GQLCreateTextBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly name: Scalars['String'];
  readonly strings: ReadonlyArray<Scalars['String']>;
  readonly type: GQLTextBankType;
};

export type GQLCreateThreadItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles: GQLThreadSchemaFieldRolesInput;
  readonly fields: ReadonlyArray<GQLFieldInput>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly name: Scalars['String'];
};

export type GQLCreateUserItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles: GQLUserSchemaFieldRolesInput;
  readonly fields: ReadonlyArray<GQLFieldInput>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly name: Scalars['String'];
};

export type GQLCreateUserRuleInput = {
  readonly actionIds: ReadonlyArray<Scalars['ID']>;
  readonly conditionSet: GQLConditionSetInput;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly expirationTime?: InputMaybe<Scalars['DateTime']>;
  readonly maxDailyActions?: InputMaybe<Scalars['Float']>;
  readonly name: Scalars['String'];
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly policyIds: ReadonlyArray<Scalars['ID']>;
  readonly status: GQLRuleStatus;
  readonly tags: ReadonlyArray<Scalars['String']>;
};

export type GQLCreateUserRuleResponse =
  | GQLMutateUserRuleSuccessResponse
  | GQLRuleNameExistsError;

export type GQLCustomAction = GQLActionBase & {
  readonly __typename?: 'CustomAction';
  readonly applyUserStrikes?: Maybe<Scalars['Boolean']>;
  readonly callbackUrl: Scalars['String'];
  readonly callbackUrlBody?: Maybe<Scalars['JSONObject']>;
  readonly callbackUrlHeaders?: Maybe<Scalars['JSONObject']>;
  readonly customMrtApiParams: ReadonlyArray<Maybe<GQLCustomMrtApiParamSpec>>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly penalty: GQLUserPenaltySeverity;
};

export type GQLCustomMrtApiParamSpec = {
  readonly __typename?: 'CustomMrtApiParamSpec';
  readonly displayName: Scalars['String'];
  readonly name: Scalars['String'];
  readonly type: Scalars['String'];
};

export const GQLDecisionActionType = {
  CustomAction: 'CUSTOM_ACTION',
  RelatedAction: 'RELATED_ACTION',
} as const;

export type GQLDecisionActionType =
  (typeof GQLDecisionActionType)[keyof typeof GQLDecisionActionType];
export type GQLDecisionCount = {
  readonly __typename?: 'DecisionCount';
  readonly action_id?: Maybe<Scalars['String']>;
  readonly count: Scalars['Int'];
  readonly policy_id?: Maybe<Scalars['String']>;
  readonly queue_id?: Maybe<Scalars['String']>;
  readonly reviewer_id?: Maybe<Scalars['String']>;
  readonly time: Scalars['String'];
  readonly type?: Maybe<GQLManualReviewDecisionType>;
};

export type GQLDecisionCountFilterBy = {
  readonly __typename?: 'DecisionCountFilterBy';
  readonly actionIds: ReadonlyArray<Scalars['String']>;
  readonly endDate: Scalars['DateTime'];
  readonly filteredDecisionActionType?: Maybe<
    ReadonlyArray<GQLDecisionActionType>
  >;
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly reviewerIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
  readonly type: ReadonlyArray<GQLManualReviewDecisionType>;
};

export type GQLDecisionCountFilterByInput = {
  readonly actionIds: ReadonlyArray<Scalars['String']>;
  readonly endDate: Scalars['DateTime'];
  readonly filteredDecisionActionType?: InputMaybe<
    ReadonlyArray<GQLDecisionActionType>
  >;
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly reviewerIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
  readonly type: ReadonlyArray<GQLManualReviewDecisionType>;
};

export const GQLDecisionCountGroupByColumns = {
  PolicyId: 'POLICY_ID',
  QueueId: 'QUEUE_ID',
  ReviewerId: 'REVIEWER_ID',
  Type: 'TYPE',
} as const;

export type GQLDecisionCountGroupByColumns =
  (typeof GQLDecisionCountGroupByColumns)[keyof typeof GQLDecisionCountGroupByColumns];
export type GQLDecisionCountSettingsInput = {
  readonly filterBy: GQLDecisionCountFilterByInput;
  readonly groupBy: ReadonlyArray<GQLDecisionCountGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
};

export type GQLDecisionCountTableFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly reviewerIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
};

export type GQLDecisionSubmission = {
  readonly acceptAppeal?: InputMaybe<GQLSubmitAppealDecisionInput>;
  readonly ignore?: InputMaybe<GQLCoopActionDecisionInput>;
  readonly rejectAppeal?: InputMaybe<GQLSubmitAppealDecisionInput>;
  readonly submitNcmecReport?: InputMaybe<GQLSubmitNcmecReportInput>;
  readonly transformJobAndRecreateInQueue?: InputMaybe<GQLTransformJobAndRecreateInQueue>;
  readonly userAction?: InputMaybe<GQLExecuteBulkActionsInput>;
};

export const GQLDecisionsCountGroupBy = {
  QueueId: 'QUEUE_ID',
  ReviewerId: 'REVIEWER_ID',
} as const;

export type GQLDecisionsCountGroupBy =
  (typeof GQLDecisionsCountGroupBy)[keyof typeof GQLDecisionsCountGroupBy];
export type GQLDeleteAllJobsFromQueueResponse =
  | GQLDeleteAllJobsFromQueueSuccessResponse
  | GQLDeleteAllJobsUnauthorizedError;

export type GQLDeleteAllJobsFromQueueSuccessResponse = {
  readonly __typename?: 'DeleteAllJobsFromQueueSuccessResponse';
  readonly _: Scalars['Boolean'];
};

export type GQLDeleteAllJobsUnauthorizedError = GQLError & {
  readonly __typename?: 'DeleteAllJobsUnauthorizedError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLDeleteItemTypeResponse =
  | GQLCannotDeleteDefaultUserError
  | GQLDeleteItemTypeSuccessResponse;

export type GQLDeleteItemTypeSuccessResponse = {
  readonly __typename?: 'DeleteItemTypeSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLDeleteManualReviewJobCommentInput = {
  readonly commentId: Scalars['String'];
  readonly jobId: Scalars['String'];
};

export type GQLDeleteRoutingRuleInput = {
  readonly id: Scalars['ID'];
  readonly isAppealsRule?: InputMaybe<Scalars['Boolean']>;
};

export type GQLDequeueManualReviewJobResponse =
  GQLDequeueManualReviewJobSuccessResponse;

export type GQLDequeueManualReviewJobSuccessResponse = {
  readonly __typename?: 'DequeueManualReviewJobSuccessResponse';
  readonly job: GQLManualReviewJob;
  readonly lockToken: Scalars['String'];
  readonly numPendingJobs: Scalars['Int'];
};

export type GQLDerivedField = GQLField & {
  readonly __typename?: 'DerivedField';
  readonly container?: Maybe<GQLContainer>;
  readonly name: Scalars['String'];
  readonly spec: GQLDerivedFieldSpec;
  readonly type: GQLFieldType;
};

export type GQLDerivedFieldCoopInputSource = {
  readonly __typename?: 'DerivedFieldCoopInputSource';
  readonly name: GQLCoopInput;
};

export type GQLDerivedFieldCoopInputSourceInput = {
  readonly name: GQLCoopInput;
};

export const GQLDerivedFieldDerivationType = {
  EnglishTranslation: 'ENGLISH_TRANSLATION',
  VideoTranscription: 'VIDEO_TRANSCRIPTION',
} as const;

export type GQLDerivedFieldDerivationType =
  (typeof GQLDerivedFieldDerivationType)[keyof typeof GQLDerivedFieldDerivationType];
export type GQLDerivedFieldFieldSource = {
  readonly __typename?: 'DerivedFieldFieldSource';
  readonly contentTypeId: Scalars['String'];
  readonly name: Scalars['String'];
};

export type GQLDerivedFieldFieldSourceInput = {
  readonly contentTypeId: Scalars['String'];
  readonly name: Scalars['String'];
};

export type GQLDerivedFieldFullItemSource = {
  readonly __typename?: 'DerivedFieldFullItemSource';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLDerivedFieldFullItemSourceInput = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLDerivedFieldSource =
  | GQLDerivedFieldCoopInputSource
  | GQLDerivedFieldFieldSource
  | GQLDerivedFieldFullItemSource;

export type GQLDerivedFieldSourceInput = {
  readonly contentCoopInput?: InputMaybe<GQLDerivedFieldCoopInputSourceInput>;
  readonly contentField?: InputMaybe<GQLDerivedFieldFieldSourceInput>;
  readonly fullItem?: InputMaybe<GQLDerivedFieldFullItemSourceInput>;
};

export type GQLDerivedFieldSpec = {
  readonly __typename?: 'DerivedFieldSpec';
  readonly derivationType: GQLDerivedFieldDerivationType;
  readonly source: GQLDerivedFieldSource;
};

export type GQLDerivedFieldSpecInput = {
  readonly derivationType: GQLDerivedFieldDerivationType;
  readonly source: GQLDerivedFieldSourceInput;
};

export type GQLDisabledInfo = {
  readonly __typename?: 'DisabledInfo';
  readonly disabled: Scalars['Boolean'];
  readonly disabledMessage?: Maybe<Scalars['String']>;
};

export type GQLDisabledInfoInput = {
  readonly disabled?: InputMaybe<Scalars['Boolean']>;
  readonly disabledMessage?: InputMaybe<Scalars['String']>;
};

export type GQLEnqueueAuthorToMrtAction = GQLActionBase & {
  readonly __typename?: 'EnqueueAuthorToMrtAction';
  readonly applyUserStrikes: Scalars['Boolean'];
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly penalty: GQLUserPenaltySeverity;
};

export type GQLEnqueueToMrtAction = GQLActionBase & {
  readonly __typename?: 'EnqueueToMrtAction';
  readonly applyUserStrikes?: Maybe<Scalars['Boolean']>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly penalty: GQLUserPenaltySeverity;
};

export type GQLEnqueueToNcmecAction = GQLActionBase & {
  readonly __typename?: 'EnqueueToNcmecAction';
  readonly applyUserStrikes?: Maybe<Scalars['Boolean']>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly penalty: GQLUserPenaltySeverity;
};

export type GQLEnumSignalOutputType = {
  readonly __typename?: 'EnumSignalOutputType';
  readonly enum: ReadonlyArray<Scalars['String']>;
  readonly ordered: Scalars['Boolean'];
  readonly scalarType: GQLScalarType;
};

/** Base type for all errors. */
export type GQLError = {
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLExecuteActionResponse = {
  readonly __typename?: 'ExecuteActionResponse';
  readonly actionId: Scalars['String'];
  readonly itemId: Scalars['String'];
  readonly success: Scalars['Boolean'];
};

export type GQLExecuteBulkActionInput = {
  readonly actionIds: ReadonlyArray<Scalars['String']>;
  readonly itemIds: ReadonlyArray<Scalars['String']>;
  readonly itemTypeId: Scalars['String'];
  readonly policyIds: ReadonlyArray<Scalars['String']>;
};

export type GQLExecuteBulkActionResponse = {
  readonly __typename?: 'ExecuteBulkActionResponse';
  readonly results: ReadonlyArray<GQLExecuteActionResponse>;
};

export type GQLExecuteBulkActionsInput = {
  readonly actionIds: ReadonlyArray<Scalars['String']>;
  readonly actionIdsToMrtApiParamDecisionPayload?: InputMaybe<
    Scalars['JSONObject']
  >;
  readonly itemIds: ReadonlyArray<Scalars['String']>;
  readonly itemTypeId: Scalars['String'];
  readonly policyIds: ReadonlyArray<Scalars['String']>;
};

export type GQLField = {
  readonly container?: Maybe<GQLContainer>;
  readonly name: Scalars['String'];
  readonly type: GQLFieldType;
};

export type GQLFieldInput = {
  readonly container?: InputMaybe<GQLContainerInput>;
  readonly name: Scalars['String'];
  readonly required: Scalars['Boolean'];
  readonly type: GQLFieldType;
};

export const GQLFieldType = {
  Array: 'ARRAY',
  Audio: 'AUDIO',
  Boolean: 'BOOLEAN',
  Datetime: 'DATETIME',
  Geohash: 'GEOHASH',
  Id: 'ID',
  Image: 'IMAGE',
  Map: 'MAP',
  Number: 'NUMBER',
  PolicyId: 'POLICY_ID',
  RelatedItem: 'RELATED_ITEM',
  String: 'STRING',
  Url: 'URL',
  UserId: 'USER_ID',
  Video: 'VIDEO',
} as const;

export type GQLFieldType = (typeof GQLFieldType)[keyof typeof GQLFieldType];
export const GQLForgotPasswordError = {
  Other: 'OTHER',
  UserNotFound: 'USER_NOT_FOUND',
} as const;

export type GQLForgotPasswordError =
  (typeof GQLForgotPasswordError)[keyof typeof GQLForgotPasswordError];
export type GQLGetDecisionCountInput = {
  readonly filterBy: GQLDecisionCountFilterByInput;
  readonly groupBy: ReadonlyArray<GQLDecisionCountGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly timeZone: Scalars['String'];
};

export type GQLGetDecisionCountSettings = {
  readonly __typename?: 'GetDecisionCountSettings';
  readonly filterBy: GQLDecisionCountFilterBy;
  readonly groupBy: ReadonlyArray<GQLDecisionCountGroupByColumns>;
  readonly metric: GQLManualReviewChartMetric;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly title: Scalars['String'];
};

export type GQLGetDecisionCountsTableInput = {
  readonly filterBy: GQLDecisionCountTableFilterByInput;
  readonly groupBy: GQLDecisionsCountGroupBy;
  readonly timeZone: Scalars['String'];
};

export type GQLGetFullReportingRuleResultForItemResponse =
  | GQLNotFoundError
  | GQLReportingRuleExecutionResult;

export type GQLGetFullResultForItemInput = {
  readonly date?: InputMaybe<Scalars['String']>;
  readonly item: GQLItemIdentifierInput;
  readonly lookback?: InputMaybe<GQLLookbackVersion>;
  readonly ruleId: Scalars['ID'];
};

export type GQLGetFullResultForItemResponse =
  | GQLNotFoundError
  | GQLRuleExecutionResult;

export type GQLGetJobCreationCountInput = {
  readonly filterBy: GQLJobCreationFilterByInput;
  readonly groupBy: ReadonlyArray<GQLJobCreationGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly timeZone: Scalars['String'];
};

export type GQLGetJobCreationCountSettings = {
  readonly __typename?: 'GetJobCreationCountSettings';
  readonly filterBy: GQLJobCreationFilterBy;
  readonly groupBy: ReadonlyArray<GQLJobCreationGroupByColumns>;
  readonly metric: GQLManualReviewChartMetric;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly title: Scalars['String'];
};

export type GQLGetResolvedJobCountInput = {
  readonly filterBy: GQLJobCountFilterByInput;
  readonly groupBy: ReadonlyArray<GQLJobCountGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly timeZone: Scalars['String'];
};

export type GQLGetSkippedJobCountInput = {
  readonly filterBy: GQLSkippedJobFilterByInput;
  readonly groupBy: ReadonlyArray<GQLSkippedJobCountGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
  readonly timeZone: Scalars['String'];
};

export type GQLGoogleContentSafetyApiIntegrationApiCredential = {
  readonly __typename?: 'GoogleContentSafetyApiIntegrationApiCredential';
  readonly apiKey: Scalars['String'];
};

export type GQLGoogleContentSafetyApiIntegrationApiCredentialInput = {
  readonly apiKey: Scalars['String'];
};

export type GQLGooglePlaceLocationInfo = {
  readonly __typename?: 'GooglePlaceLocationInfo';
  readonly id: Scalars['ID'];
};

export type GQLHashBank = {
  readonly __typename?: 'HashBank';
  readonly description?: Maybe<Scalars['String']>;
  readonly enabled_ratio: Scalars['Float'];
  readonly hma_name: Scalars['String'];
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly org_id: Scalars['String'];
};

export type GQLIgnoreDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'IgnoreDecisionComponent';
    readonly type: GQLManualReviewDecisionType;
  };

export const GQLIntegration = {
  Akismet: 'AKISMET',
  GoogleContentSafetyApi: 'GOOGLE_CONTENT_SAFETY_API',
  L1Ght: 'L1GHT',
  MicrosoftAzureContentModerator: 'MICROSOFT_AZURE_CONTENT_MODERATOR',
  Oopspam: 'OOPSPAM',
  OpenAi: 'OPEN_AI',
  SightEngine: 'SIGHT_ENGINE',
  TwoHat: 'TWO_HAT',
  Zentropi: 'ZENTROPI',
} as const;

export type GQLIntegration =
  (typeof GQLIntegration)[keyof typeof GQLIntegration];
export type GQLIntegrationApiCredential =
  | GQLGoogleContentSafetyApiIntegrationApiCredential
  | GQLOpenAiIntegrationApiCredential
  | GQLZentropiIntegrationApiCredential;

export type GQLIntegrationApiCredentialInput = {
  readonly googleContentSafetyApi?: InputMaybe<GQLGoogleContentSafetyApiIntegrationApiCredentialInput>;
  readonly openAi?: InputMaybe<GQLOpenAiIntegrationApiCredentialInput>;
  readonly zentropi?: InputMaybe<GQLZentropiIntegrationApiCredentialInput>;
};

export type GQLIntegrationConfig = {
  readonly __typename?: 'IntegrationConfig';
  readonly apiCredential: GQLIntegrationApiCredential;
  readonly name: GQLIntegration;
};

export type GQLIntegrationConfigQueryResponse =
  | GQLIntegrationConfigSuccessResult
  | GQLIntegrationConfigUnsupportedIntegrationError;

export type GQLIntegrationConfigSuccessResult = {
  readonly __typename?: 'IntegrationConfigSuccessResult';
  readonly config?: Maybe<GQLIntegrationConfig>;
};

export type GQLIntegrationConfigTooManyCredentialsError = GQLError & {
  readonly __typename?: 'IntegrationConfigTooManyCredentialsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLIntegrationConfigUnsupportedIntegrationError = GQLError & {
  readonly __typename?: 'IntegrationConfigUnsupportedIntegrationError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLIntegrationEmptyInputCredentialsError = GQLError & {
  readonly __typename?: 'IntegrationEmptyInputCredentialsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLIntegrationNoInputCredentialsError = GQLError & {
  readonly __typename?: 'IntegrationNoInputCredentialsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLInviteUserInput = {
  readonly email: Scalars['String'];
  readonly role: GQLUserRole;
};

export type GQLInviteUserToken = {
  readonly __typename?: 'InviteUserToken';
  readonly email: Scalars['String'];
  readonly orgId: Scalars['String'];
  readonly role: GQLUserRole;
  readonly samlEnabled: Scalars['Boolean'];
  readonly token: Scalars['String'];
};

export type GQLInviteUserTokenExpiredError = GQLError & {
  readonly __typename?: 'InviteUserTokenExpiredError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLInviteUserTokenMissingError = GQLError & {
  readonly __typename?: 'InviteUserTokenMissingError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLInviteUserTokenResponse =
  | GQLInviteUserTokenExpiredError
  | GQLInviteUserTokenMissingError
  | GQLInviteUserTokenSuccessResponse;

export type GQLInviteUserTokenSuccessResponse = {
  readonly __typename?: 'InviteUserTokenSuccessResponse';
  readonly tokenData: GQLInviteUserToken;
};

export type GQLIpAddress = {
  readonly __typename?: 'IpAddress';
  readonly ip: Scalars['String'];
  readonly port?: Maybe<Scalars['Int']>;
};

export type GQLIpAddressInput = {
  readonly ip: Scalars['String'];
  readonly port?: InputMaybe<Scalars['Int']>;
};

export type GQLItem = GQLContentItem | GQLThreadItem | GQLUserItem;

export type GQLItemAction = {
  readonly __typename?: 'ItemAction';
  readonly actionId: Scalars['ID'];
  readonly actorId?: Maybe<Scalars['ID']>;
  readonly itemCreatorId?: Maybe<Scalars['ID']>;
  readonly itemCreatorTypeId?: Maybe<Scalars['ID']>;
  readonly itemId: Scalars['ID'];
  readonly itemTypeId: Scalars['ID'];
  readonly jobId?: Maybe<Scalars['ID']>;
  readonly policies: ReadonlyArray<Scalars['String']>;
  readonly ruleIds: ReadonlyArray<Scalars['ID']>;
  readonly ts: Scalars['DateTime'];
};

export type GQLItemBase = {
  readonly data: Scalars['JSONObject'];
  readonly id: Scalars['ID'];
  readonly submissionId: Scalars['ID'];
  readonly submissionTime?: Maybe<Scalars['DateTime']>;
  readonly type: GQLItemTypeBase;
};

export type GQLItemHistoryResponse = GQLItemHistoryResult | GQLNotFoundError;

export type GQLItemHistoryResult = {
  readonly __typename?: 'ItemHistoryResult';
  readonly executions: ReadonlyArray<GQLRuleExecutionResult>;
  readonly item: GQLItem;
};

export type GQLItemIdentifier = {
  readonly __typename?: 'ItemIdentifier';
  readonly id: Scalars['String'];
  readonly typeId: Scalars['String'];
};

export type GQLItemIdentifierInput = {
  readonly id: Scalars['String'];
  readonly typeId: Scalars['String'];
};

export type GQLItemInput = {
  readonly data: Scalars['JSONObject'];
  readonly itemId: Scalars['NonEmptyString'];
  readonly itemType: GQLItemTypeIdentifierInput;
};

export type GQLItemSubmissions = {
  readonly __typename?: 'ItemSubmissions';
  readonly latest: GQLItem;
  readonly prior?: Maybe<ReadonlyArray<GQLItem>>;
};

export type GQLItemType =
  | GQLContentItemType
  | GQLThreadItemType
  | GQLUserItemType;

export type GQLItemTypeBase = {
  readonly baseFields: ReadonlyArray<GQLBaseField>;
  readonly derivedFields: ReadonlyArray<GQLDerivedField>;
  readonly description?: Maybe<Scalars['String']>;
  readonly hiddenFields: ReadonlyArray<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly schemaVariant: GQLItemTypeSchemaVariant;
  readonly version: Scalars['String'];
};

export type GQLItemTypeIdentifier = {
  readonly __typename?: 'ItemTypeIdentifier';
  readonly id: Scalars['String'];
  readonly schemaVariant: GQLItemTypeSchemaVariant;
  readonly version: Scalars['NonEmptyString'];
};

export type GQLItemTypeIdentifierInput = {
  readonly id: Scalars['NonEmptyString'];
  readonly schemaVariant: GQLItemTypeSchemaVariantInput;
  readonly version: Scalars['NonEmptyString'];
};

export type GQLItemTypeNameAlreadyExistsError = GQLError & {
  readonly __typename?: 'ItemTypeNameAlreadyExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLItemTypeSchemaVariant = {
  Original: 'ORIGINAL',
  Partial: 'PARTIAL',
} as const;

export type GQLItemTypeSchemaVariant =
  (typeof GQLItemTypeSchemaVariant)[keyof typeof GQLItemTypeSchemaVariant];
export const GQLItemTypeSchemaVariantInput = {
  Original: 'ORIGINAL',
} as const;

export type GQLItemTypeSchemaVariantInput =
  (typeof GQLItemTypeSchemaVariantInput)[keyof typeof GQLItemTypeSchemaVariantInput];
export type GQLItemWithParents = {
  readonly __typename?: 'ItemWithParents';
  readonly item: GQLItemSubmissions;
  readonly parents: ReadonlyArray<GQLItemSubmissions>;
};

export type GQLJobCountFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly reviewerIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
};

export const GQLJobCountGroupByColumns = {
  QueueId: 'QUEUE_ID',
  ReviewerId: 'REVIEWER_ID',
} as const;

export type GQLJobCountGroupByColumns =
  (typeof GQLJobCountGroupByColumns)[keyof typeof GQLJobCountGroupByColumns];
export type GQLJobCreationCount = {
  readonly __typename?: 'JobCreationCount';
  readonly count: Scalars['Int'];
  readonly itemTypeId?: Maybe<Scalars['String']>;
  readonly policyId?: Maybe<Scalars['String']>;
  readonly queueId?: Maybe<Scalars['String']>;
  readonly ruleId?: Maybe<Scalars['String']>;
  readonly source?: Maybe<GQLJobCreationSourceOptions>;
  readonly time: Scalars['String'];
};

export type GQLJobCreationFilterBy = {
  readonly __typename?: 'JobCreationFilterBy';
  readonly endDate: Scalars['DateTime'];
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly ruleIds: ReadonlyArray<Scalars['String']>;
  readonly sources: ReadonlyArray<GQLJobCreationSourceOptions>;
  readonly startDate: Scalars['DateTime'];
};

export type GQLJobCreationFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly ruleIds: ReadonlyArray<Scalars['String']>;
  readonly sources: ReadonlyArray<GQLJobCreationSourceOptions>;
  readonly startDate: Scalars['DateTime'];
};

export const GQLJobCreationGroupByColumns = {
  ItemTypeId: 'ITEM_TYPE_ID',
  PolicyId: 'POLICY_ID',
  QueueId: 'QUEUE_ID',
  Source: 'SOURCE',
} as const;

export type GQLJobCreationGroupByColumns =
  (typeof GQLJobCreationGroupByColumns)[keyof typeof GQLJobCreationGroupByColumns];
export type GQLJobCreationSettingsInput = {
  readonly filterBy: GQLJobCreationFilterByInput;
  readonly groupBy: ReadonlyArray<GQLJobCreationGroupByColumns>;
  readonly timeDivision: GQLMetricsTimeDivisionOptions;
};

export const GQLJobCreationSourceOptions = {
  Appeal: 'APPEAL',
  MrtJob: 'MRT_JOB',
  PostActions: 'POST_ACTIONS',
  Report: 'REPORT',
  RuleExecution: 'RULE_EXECUTION',
} as const;

export type GQLJobCreationSourceOptions =
  (typeof GQLJobCreationSourceOptions)[keyof typeof GQLJobCreationSourceOptions];
export type GQLJobHasAlreadyBeenSubmittedError = GQLError & {
  readonly __typename?: 'JobHasAlreadyBeenSubmittedError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLLanguage = {
  Abkhazian: 'ABKHAZIAN',
  Afar: 'AFAR',
  Afrikaans: 'AFRIKAANS',
  Akan: 'AKAN',
  Albanian: 'ALBANIAN',
  Amharic: 'AMHARIC',
  Arabic: 'ARABIC',
  Aragonese: 'ARAGONESE',
  Armenian: 'ARMENIAN',
  Assamese: 'ASSAMESE',
  Avaric: 'AVARIC',
  Avestan: 'AVESTAN',
  Aymara: 'AYMARA',
  Azerbaijani: 'AZERBAIJANI',
  Azeri: 'AZERI',
  Bambara: 'BAMBARA',
  Bashkir: 'BASHKIR',
  Basque: 'BASQUE',
  Belarusian: 'BELARUSIAN',
  Bengali: 'BENGALI',
  Bihari: 'BIHARI',
  Bislama: 'BISLAMA',
  Bokmal: 'BOKMAL',
  Bosnian: 'BOSNIAN',
  Breton: 'BRETON',
  Bulgarian: 'BULGARIAN',
  Burmese: 'BURMESE',
  Catalan: 'CATALAN',
  Cebuano: 'CEBUANO',
  CentralKhmer: 'CENTRAL_KHMER',
  Chamorro: 'CHAMORRO',
  Chechen: 'CHECHEN',
  Chinese: 'CHINESE',
  ChurchSlavic: 'CHURCH_SLAVIC',
  Chuvash: 'CHUVASH',
  Cornish: 'CORNISH',
  Corsican: 'CORSICAN',
  Cree: 'CREE',
  Croatian: 'CROATIAN',
  Czech: 'CZECH',
  Danish: 'DANISH',
  Dhivehi: 'DHIVEHI',
  Dutch: 'DUTCH',
  Dzongkha: 'DZONGKHA',
  English: 'ENGLISH',
  Esperanto: 'ESPERANTO',
  Estonian: 'ESTONIAN',
  Ewe: 'EWE',
  Faroese: 'FAROESE',
  Farsi: 'FARSI',
  Fijian: 'FIJIAN',
  Finnish: 'FINNISH',
  Flemish: 'FLEMISH',
  French: 'FRENCH',
  Fulah: 'FULAH',
  Gaelic: 'GAELIC',
  Galician: 'GALICIAN',
  Ganda: 'GANDA',
  Georgian: 'GEORGIAN',
  German: 'GERMAN',
  Greek: 'GREEK',
  Guarani: 'GUARANI',
  Gujarati: 'GUJARATI',
  Haitian: 'HAITIAN',
  Hausa: 'HAUSA',
  Hawaiian: 'HAWAIIAN',
  Hebrew: 'HEBREW',
  Herero: 'HERERO',
  Hindi: 'HINDI',
  HiriMotu: 'HIRI_MOTU',
  Hungarian: 'HUNGARIAN',
  Icelandic: 'ICELANDIC',
  Ido: 'IDO',
  Igbo: 'IGBO',
  Indonesian: 'INDONESIAN',
  Interlingua: 'INTERLINGUA',
  Inuktitut: 'INUKTITUT',
  Inupiaq: 'INUPIAQ',
  Irish: 'IRISH',
  Italian: 'ITALIAN',
  Japanese: 'JAPANESE',
  Javanese: 'JAVANESE',
  Kalaallisut: 'KALAALLISUT',
  Kannada: 'KANNADA',
  Kanuri: 'KANURI',
  Kashmiri: 'KASHMIRI',
  Kazakh: 'KAZAKH',
  Kikuyu: 'KIKUYU',
  Kinyarwanda: 'KINYARWANDA',
  Komi: 'KOMI',
  Kongo: 'KONGO',
  Korean: 'KOREAN',
  Kuanyama: 'KUANYAMA',
  Kurdish: 'KURDISH',
  Kyrgyz: 'KYRGYZ',
  Lao: 'LAO',
  Latin: 'LATIN',
  Latvian: 'LATVIAN',
  Limburgan: 'LIMBURGAN',
  Lingala: 'LINGALA',
  Lithuanian: 'LITHUANIAN',
  LubaKatanga: 'LUBA_KATANGA',
  Luxembourgish: 'LUXEMBOURGISH',
  Macedonian: 'MACEDONIAN',
  Malagasy: 'MALAGASY',
  Malay: 'MALAY',
  Malayalam: 'MALAYALAM',
  Maltese: 'MALTESE',
  Manx: 'MANX',
  Maori: 'MAORI',
  Marathi: 'MARATHI',
  Marshallese: 'MARSHALLESE',
  Moldovian: 'MOLDOVIAN',
  Mongolian: 'MONGOLIAN',
  Nauru: 'NAURU',
  Navajo: 'NAVAJO',
  Ndonga: 'NDONGA',
  Nepali: 'NEPALI',
  NorthernSami: 'NORTHERN_SAMI',
  NorthNdebele: 'NORTH_NDEBELE',
  Norwegian: 'NORWEGIAN',
  Nyanja: 'NYANJA',
  Occitan: 'OCCITAN',
  Ojibwa: 'OJIBWA',
  Oriya: 'ORIYA',
  Oromo: 'OROMO',
  Ossetian: 'OSSETIAN',
  Pali: 'PALI',
  Pashto: 'PASHTO',
  Persian: 'PERSIAN',
  Pidgin: 'PIDGIN',
  Polish: 'POLISH',
  Portuguese: 'PORTUGUESE',
  Punjabi: 'PUNJABI',
  Quechua: 'QUECHUA',
  Romanian: 'ROMANIAN',
  Romansh: 'ROMANSH',
  Rundi: 'RUNDI',
  Russian: 'RUSSIAN',
  Samoan: 'SAMOAN',
  Sango: 'SANGO',
  Sanskrit: 'SANSKRIT',
  Sardinian: 'SARDINIAN',
  Serbian: 'SERBIAN',
  Shona: 'SHONA',
  SichuanYi: 'SICHUAN_YI',
  Sindhi: 'SINDHI',
  Sinhalese: 'SINHALESE',
  Slovak: 'SLOVAK',
  Slovene: 'SLOVENE',
  Somali: 'SOMALI',
  SouthernSotho: 'SOUTHERN_SOTHO',
  SouthNdebele: 'SOUTH_NDEBELE',
  Spanish: 'SPANISH',
  Sundanese: 'SUNDANESE',
  Swahili: 'SWAHILI',
  Swati: 'SWATI',
  Swedish: 'SWEDISH',
  Tagalog: 'TAGALOG',
  Tahitian: 'TAHITIAN',
  Tajik: 'TAJIK',
  Tamil: 'TAMIL',
  Tatar: 'TATAR',
  Telugu: 'TELUGU',
  Thai: 'THAI',
  Tibetan: 'TIBETAN',
  Tigrinya: 'TIGRINYA',
  Tonga: 'TONGA',
  Tsonga: 'TSONGA',
  Tswana: 'TSWANA',
  Turkish: 'TURKISH',
  Turkmen: 'TURKMEN',
  Twi: 'TWI',
  Ukrainian: 'UKRAINIAN',
  Urdu: 'URDU',
  Uyghur: 'UYGHUR',
  Uzbek: 'UZBEK',
  Venda: 'VENDA',
  Vietnamese: 'VIETNAMESE',
  Volapuk: 'VOLAPUK',
  Walloon: 'WALLOON',
  Welsh: 'WELSH',
  WesternFrisian: 'WESTERN_FRISIAN',
  Wolof: 'WOLOF',
  Xhosa: 'XHOSA',
  Yiddish: 'YIDDISH',
  Yoruba: 'YORUBA',
  Zhuang: 'ZHUANG',
  Zulu: 'ZULU',
} as const;

export type GQLLanguage = (typeof GQLLanguage)[keyof typeof GQLLanguage];
export type GQLLanguages = {
  readonly __typename?: 'Languages';
  readonly languages: ReadonlyArray<GQLLanguage>;
};

export type GQLLatLng = {
  readonly __typename?: 'LatLng';
  readonly lat: Scalars['Float'];
  readonly lng: Scalars['Float'];
};

export type GQLLatLngInput = {
  readonly lat: Scalars['Float'];
  readonly lng: Scalars['Float'];
};

export type GQLLeafCondition = {
  readonly __typename?: 'LeafCondition';
  readonly comparator?: Maybe<GQLValueComparator>;
  readonly input: GQLConditionInputField;
  readonly matchingValues?: Maybe<GQLMatchingValues>;
  readonly signal?: Maybe<GQLSignal>;
  readonly threshold?: Maybe<Scalars['StringOrFloat']>;
};

export type GQLLeafConditionWithResult = {
  readonly __typename?: 'LeafConditionWithResult';
  readonly comparator?: Maybe<GQLValueComparator>;
  readonly input: GQLConditionInputField;
  readonly matchingValues?: Maybe<GQLMatchingValues>;
  readonly result?: Maybe<GQLConditionResult>;
  readonly signal?: Maybe<GQLSignal>;
  readonly threshold?: Maybe<Scalars['StringOrFloat']>;
};

export type GQLLocationArea = {
  readonly __typename?: 'LocationArea';
  readonly bounds?: Maybe<GQLPlaceBounds>;
  readonly geometry: GQLLocationGeometry;
  readonly googlePlaceInfo?: Maybe<GQLGooglePlaceLocationInfo>;
  readonly id: Scalars['ID'];
  readonly name?: Maybe<Scalars['String']>;
};

export type GQLLocationAreaInput = {
  readonly bounds?: InputMaybe<GQLPlaceBoundsInput>;
  readonly geometry: GQLLocationGeometryInput;
  readonly googlePlaceId?: InputMaybe<Scalars['String']>;
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLLocationBank = {
  readonly __typename?: 'LocationBank';
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly locations: ReadonlyArray<GQLLocationArea>;
  readonly name: Scalars['String'];
};

export type GQLLocationBankNameExistsError = GQLError & {
  readonly __typename?: 'LocationBankNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLLocationGeometry = {
  readonly __typename?: 'LocationGeometry';
  readonly center: GQLLatLng;
  readonly radius: Scalars['Float'];
};

export type GQLLocationGeometryInput = {
  readonly center: GQLLatLngInput;
  readonly radius: Scalars['Float'];
};

export type GQLLogSkipInput = {
  readonly jobId: Scalars['String'];
  readonly queueId: Scalars['String'];
};

export type GQLLoginIncorrectPasswordError = GQLError & {
  readonly __typename?: 'LoginIncorrectPasswordError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLLoginInput = {
  readonly email: Scalars['String'];
  readonly password: Scalars['String'];
  readonly remember?: InputMaybe<Scalars['Boolean']>;
};

export const GQLLoginMethod = {
  Password: 'PASSWORD',
  Saml: 'SAML',
} as const;

export type GQLLoginMethod =
  (typeof GQLLoginMethod)[keyof typeof GQLLoginMethod];
export type GQLLoginResponse =
  | GQLLoginIncorrectPasswordError
  | GQLLoginSsoRequiredError
  | GQLLoginSuccessResponse
  | GQLLoginUserDoesNotExistError;

export type GQLLoginSsoRequiredError = GQLError & {
  readonly __typename?: 'LoginSsoRequiredError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLLoginSuccessResponse = {
  readonly __typename?: 'LoginSuccessResponse';
  readonly user: GQLUser;
};

export type GQLLoginUserDoesNotExistError = GQLError & {
  readonly __typename?: 'LoginUserDoesNotExistError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLLookbackVersion = {
  Latest: 'LATEST',
  Prior: 'PRIOR',
} as const;

export type GQLLookbackVersion =
  (typeof GQLLookbackVersion)[keyof typeof GQLLookbackVersion];
export type GQLManualReviewChartConfigurationsInput = {
  readonly chartConfigurations: ReadonlyArray<GQLManualReviewChartSettingsInput>;
};

export const GQLManualReviewChartMetric = {
  Decisions: 'DECISIONS',
  Jobs: 'JOBS',
} as const;

export type GQLManualReviewChartMetric =
  (typeof GQLManualReviewChartMetric)[keyof typeof GQLManualReviewChartMetric];
export type GQLManualReviewChartSettings =
  | GQLGetDecisionCountSettings
  | GQLGetJobCreationCountSettings;

export type GQLManualReviewChartSettingsInput = {
  readonly decisionCountSettings?: InputMaybe<GQLDecisionCountSettingsInput>;
  readonly jobCreationCountSettings?: InputMaybe<GQLJobCreationSettingsInput>;
  readonly metric: GQLManualReviewChartMetric;
  readonly title: Scalars['String'];
};

export type GQLManualReviewDecision = {
  readonly __typename?: 'ManualReviewDecision';
  readonly createdAt: Scalars['DateTime'];
  readonly decisionReason?: Maybe<Scalars['String']>;
  readonly decisions: ReadonlyArray<GQLManualReviewDecisionComponent>;
  readonly id: Scalars['String'];
  readonly itemId?: Maybe<Scalars['String']>;
  readonly itemTypeId?: Maybe<Scalars['String']>;
  readonly jobId: Scalars['String'];
  readonly queueId: Scalars['String'];
  readonly relatedActions: ReadonlyArray<GQLManualReviewDecisionComponent>;
  readonly reviewerId?: Maybe<Scalars['String']>;
};

export type GQLManualReviewDecisionComponent =
  | GQLAcceptAppealDecisionComponent
  | GQLAutomaticCloseDecisionComponent
  | GQLIgnoreDecisionComponent
  | GQLRejectAppealDecisionComponent
  | GQLSubmitNcmecReportDecisionComponent
  | GQLTransformJobAndRecreateInQueueDecisionComponent
  | GQLUserOrRelatedActionDecisionComponent;

export type GQLManualReviewDecisionComponentBase = {
  readonly type: GQLManualReviewDecisionType;
};

export const GQLManualReviewDecisionType = {
  AcceptAppeal: 'ACCEPT_APPEAL',
  AutomaticClose: 'AUTOMATIC_CLOSE',
  CustomAction: 'CUSTOM_ACTION',
  Ignore: 'IGNORE',
  RejectAppeal: 'REJECT_APPEAL',
  RelatedAction: 'RELATED_ACTION',
  SubmitNcmecReport: 'SUBMIT_NCMEC_REPORT',
  TransformJobAndRecreateInQueue: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE',
} as const;

export type GQLManualReviewDecisionType =
  (typeof GQLManualReviewDecisionType)[keyof typeof GQLManualReviewDecisionType];
export type GQLManualReviewExistingJob = {
  readonly __typename?: 'ManualReviewExistingJob';
  readonly job: GQLManualReviewJob;
  readonly queueId: Scalars['String'];
};

export type GQLManualReviewJob = {
  readonly __typename?: 'ManualReviewJob';
  readonly comments: ReadonlyArray<GQLManualReviewJobComment>;
  readonly createdAt: Scalars['DateTime'];
  readonly id: Scalars['ID'];
  readonly numTimesReported?: Maybe<Scalars['Int']>;
  readonly payload: GQLManualReviewJobPayload;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
};

export type GQLManualReviewJobComment = {
  readonly __typename?: 'ManualReviewJobComment';
  readonly author: GQLUser;
  readonly commentText: Scalars['String'];
  readonly createdAt: Scalars['DateTime'];
  readonly id: Scalars['ID'];
};

export type GQLManualReviewJobEnqueueSourceInfo =
  | GQLAppealEnqueueSourceInfo
  | GQLMrtJobEnqueueSourceInfo
  | GQLPostActionsEnqueueSourceInfo
  | GQLReportEnqueueSourceInfo
  | GQLRuleExecutionEnqueueSourceInfo;

export const GQLManualReviewJobKind = {
  Default: 'DEFAULT',
  Ncmec: 'NCMEC',
} as const;

export type GQLManualReviewJobKind =
  (typeof GQLManualReviewJobKind)[keyof typeof GQLManualReviewJobKind];
export type GQLManualReviewJobPayload =
  | GQLContentAppealManualReviewJobPayload
  | GQLContentManualReviewJobPayload
  | GQLNcmecManualReviewJobPayload
  | GQLThreadAppealManualReviewJobPayload
  | GQLThreadManualReviewJobPayload
  | GQLUserAppealManualReviewJobPayload
  | GQLUserManualReviewJobPayload;

export type GQLManualReviewJobWithDecisions = {
  readonly __typename?: 'ManualReviewJobWithDecisions';
  readonly decision: GQLManualReviewDecision;
  readonly job: GQLManualReviewJob;
};

export type GQLManualReviewQueue = {
  readonly __typename?: 'ManualReviewQueue';
  readonly autoCloseJobs: Scalars['Boolean'];
  readonly description?: Maybe<Scalars['String']>;
  readonly explicitlyAssignedReviewers: ReadonlyArray<GQLUser>;
  readonly hiddenActionIds: ReadonlyArray<Scalars['ID']>;
  readonly id: Scalars['ID'];
  readonly isAppealsQueue: Scalars['Boolean'];
  readonly isDefaultQueue: Scalars['Boolean'];
  readonly jobs: ReadonlyArray<GQLManualReviewJob>;
  readonly name: Scalars['String'];
  readonly oldestJobCreatedAt?: Maybe<Scalars['DateTime']>;
  readonly orgId: Scalars['ID'];
  readonly pendingJobCount: Scalars['Int'];
};

export type GQLManualReviewQueueJobsArgs = {
  ids?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
};

export type GQLManualReviewQueueNameExistsError = GQLError & {
  readonly __typename?: 'ManualReviewQueueNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLMatchingBankNameExistsError = GQLError & {
  readonly __typename?: 'MatchingBankNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLMatchingBanks = {
  readonly __typename?: 'MatchingBanks';
  readonly hashBanks: ReadonlyArray<GQLHashBank>;
  readonly locationBanks: ReadonlyArray<GQLLocationBank>;
  readonly textBanks: ReadonlyArray<GQLTextBank>;
};

export type GQLMatchingValues = {
  readonly __typename?: 'MatchingValues';
  readonly imageBankIds?: Maybe<ReadonlyArray<Scalars['String']>>;
  readonly locationBankIds?: Maybe<ReadonlyArray<Scalars['String']>>;
  readonly locations?: Maybe<ReadonlyArray<GQLLocationArea>>;
  readonly strings?: Maybe<ReadonlyArray<Scalars['String']>>;
  readonly textBankIds?: Maybe<ReadonlyArray<Scalars['String']>>;
};

export type GQLMessageWithIpAddress = {
  readonly __typename?: 'MessageWithIpAddress';
  readonly ipAddress: GQLIpAddress;
  readonly message: GQLContentItem;
};

export const GQLMetricsTimeDivisionOptions = {
  Day: 'DAY',
  Hour: 'HOUR',
} as const;

export type GQLMetricsTimeDivisionOptions =
  (typeof GQLMetricsTimeDivisionOptions)[keyof typeof GQLMetricsTimeDivisionOptions];
export type GQLModeratorSafetySettingsInput = {
  readonly moderatorSafetyBlurLevel: Scalars['Int'];
  readonly moderatorSafetyGrayscale: Scalars['Boolean'];
  readonly moderatorSafetyMuteVideo: Scalars['Boolean'];
  readonly moderatorSafetySepia: Scalars['Boolean'];
};

export type GQLMrtJobEnqueueSourceInfo = {
  readonly __typename?: 'MrtJobEnqueueSourceInfo';
  readonly kind: GQLJobCreationSourceOptions;
};

export type GQLMutateAccessibleQueuesForUserSuccessResponse = {
  readonly __typename?: 'MutateAccessibleQueuesForUserSuccessResponse';
  readonly _: Scalars['Boolean'];
};

export const GQLMutateActionError = {
  ActionNameExists: 'ACTION_NAME_EXISTS',
} as const;

export type GQLMutateActionError =
  (typeof GQLMutateActionError)[keyof typeof GQLMutateActionError];
export type GQLMutateActionResponse =
  | GQLActionNameExistsError
  | GQLMutateActionSuccessResponse;

export type GQLMutateActionSuccessResponse = {
  readonly __typename?: 'MutateActionSuccessResponse';
  readonly data: GQLCustomAction;
};

export type GQLMutateBankResponse = {
  readonly __typename?: 'MutateBankResponse';
  readonly error?: Maybe<Scalars['String']>;
  readonly success?: Maybe<Scalars['Boolean']>;
};

export type GQLMutateContentItemTypeResponse =
  | GQLItemTypeNameAlreadyExistsError
  | GQLMutateContentTypeSuccessResponse;

export type GQLMutateContentRuleSuccessResponse = {
  readonly __typename?: 'MutateContentRuleSuccessResponse';
  readonly data: GQLContentRule;
};

export type GQLMutateContentTypeSuccessResponse = {
  readonly __typename?: 'MutateContentTypeSuccessResponse';
  readonly data?: Maybe<GQLContentItemType>;
};

export type GQLMutateHashBankResponse =
  | GQLMatchingBankNameExistsError
  | GQLMutateHashBankSuccessResponse;

export type GQLMutateHashBankSuccessResponse = {
  readonly __typename?: 'MutateHashBankSuccessResponse';
  readonly data: GQLHashBank;
};

export type GQLMutateLocationBankResponse =
  | GQLLocationBankNameExistsError
  | GQLMutateLocationBankSuccessResponse;

export type GQLMutateLocationBankSuccessResponse = {
  readonly __typename?: 'MutateLocationBankSuccessResponse';
  readonly data: GQLLocationBank;
};

export type GQLMutateManualReviewQueueSuccessResponse = {
  readonly __typename?: 'MutateManualReviewQueueSuccessResponse';
  readonly data: GQLManualReviewQueue;
};

export type GQLMutateReportingRuleSuccessResponse = {
  readonly __typename?: 'MutateReportingRuleSuccessResponse';
  readonly data: GQLReportingRule;
};

export type GQLMutateRoutingRuleSuccessResponse = {
  readonly __typename?: 'MutateRoutingRuleSuccessResponse';
  readonly data: GQLRoutingRule;
};

export type GQLMutateRoutingRulesOrderSuccessResponse = {
  readonly __typename?: 'MutateRoutingRulesOrderSuccessResponse';
  readonly data: ReadonlyArray<GQLRoutingRule>;
};

export type GQLMutateThreadItemTypeResponse =
  | GQLItemTypeNameAlreadyExistsError
  | GQLMutateThreadTypeSuccessResponse;

export type GQLMutateThreadTypeSuccessResponse = {
  readonly __typename?: 'MutateThreadTypeSuccessResponse';
  readonly data?: Maybe<GQLThreadItemType>;
};

export type GQLMutateUserItemTypeResponse =
  | GQLItemTypeNameAlreadyExistsError
  | GQLMutateUserTypeSuccessResponse;

export type GQLMutateUserRuleSuccessResponse = {
  readonly __typename?: 'MutateUserRuleSuccessResponse';
  readonly data: GQLUserRule;
};

export type GQLMutateUserTypeSuccessResponse = {
  readonly __typename?: 'MutateUserTypeSuccessResponse';
  readonly data?: Maybe<GQLUserItemType>;
};

export type GQLMutation = {
  readonly __typename?: 'Mutation';
  readonly addAccessibleQueuesToUser: GQLAddAccessibleQueuesToUserResponse;
  readonly addFavoriteMRTQueue: GQLAddFavoriteMrtQueueSuccessResponse;
  readonly addFavoriteRule: GQLAddFavoriteRuleSuccessResponse;
  readonly addPolicies: GQLAddPoliciesResponse;
  readonly approveUser?: Maybe<Scalars['Boolean']>;
  readonly bulkExecuteActions: GQLExecuteBulkActionResponse;
  readonly changePassword: GQLChangePasswordResponse;
  readonly createAction: GQLMutateActionResponse;
  readonly createBacktest?: Maybe<GQLCreateBacktestResponse>;
  readonly createContentItemType: GQLMutateContentItemTypeResponse;
  readonly createContentRule: GQLCreateContentRuleResponse;
  readonly createHashBank: GQLMutateHashBankResponse;
  readonly createLocationBank: GQLMutateLocationBankResponse;
  readonly createManualReviewJobComment: GQLAddManualReviewJobCommentResponse;
  readonly createManualReviewQueue: GQLCreateManualReviewQueueResponse;
  readonly createOrg: GQLCreateOrgResponse;
  readonly createReportingRule: GQLCreateReportingRuleResponse;
  readonly createRoutingRule: GQLCreateRoutingRuleResponse;
  readonly createTextBank: GQLMutateBankResponse;
  readonly createThreadItemType: GQLMutateThreadItemTypeResponse;
  readonly createUserItemType: GQLMutateUserItemTypeResponse;
  readonly createUserRule: GQLCreateUserRuleResponse;
  readonly deleteAction?: Maybe<Scalars['Boolean']>;
  readonly deleteAllJobsFromQueue: GQLDeleteAllJobsFromQueueResponse;
  readonly deleteHashBank: Scalars['Boolean'];
  readonly deleteInvite?: Maybe<Scalars['Boolean']>;
  readonly deleteItemType: GQLDeleteItemTypeResponse;
  readonly deleteLocationBank?: Maybe<Scalars['Boolean']>;
  readonly deleteManualReviewJobComment: Scalars['Boolean'];
  readonly deleteManualReviewQueue: Scalars['Boolean'];
  readonly deletePolicy?: Maybe<Scalars['Boolean']>;
  readonly deleteReportingRule: Scalars['Boolean'];
  readonly deleteRoutingRule: Scalars['Boolean'];
  readonly deleteRule?: Maybe<Scalars['Boolean']>;
  readonly deleteTextBank: Scalars['Boolean'];
  readonly deleteUser?: Maybe<Scalars['Boolean']>;
  readonly dequeueManualReviewJob?: Maybe<GQLDequeueManualReviewJobResponse>;
  readonly generatePasswordResetToken?: Maybe<Scalars['String']>;
  readonly inviteUser?: Maybe<Scalars['String']>;
  readonly logSkip: Scalars['Boolean'];
  readonly login: GQLLoginResponse;
  readonly logout?: Maybe<Scalars['Boolean']>;
  readonly rejectUser?: Maybe<Scalars['Boolean']>;
  readonly releaseJobLock: Scalars['Boolean'];
  readonly removeAccessibleQueuesToUser: GQLRemoveAccessibleQueuesToUserResponse;
  readonly removeFavoriteMRTQueue: GQLRemoveFavoriteMrtQueueSuccessResponse;
  readonly removeFavoriteRule: GQLRemoveFavoriteRuleSuccessResponse;
  readonly reorderRoutingRules: GQLReorderRoutingRulesResponse;
  readonly requestDemo?: Maybe<Scalars['Boolean']>;
  readonly resetPassword: Scalars['Boolean'];
  readonly rotateApiKey: GQLRotateApiKeyResponse;
  readonly runRetroaction?: Maybe<GQLRunRetroactionResponse>;
  readonly sendPasswordReset: Scalars['Boolean'];
  readonly setAllUserStrikeThresholds: GQLSetAllUserStrikeThresholdsSuccessResponse;
  readonly setIntegrationConfig: GQLSetIntegrationConfigResponse;
  readonly setModeratorSafetySettings?: Maybe<GQLSetModeratorSafetySettingsSuccessResponse>;
  readonly setMrtChartConfigurationSettings?: Maybe<GQLSetMrtChartConfigurationSettingsSuccessResponse>;
  readonly setOrgDefaultSafetySettings?: Maybe<GQLSetModeratorSafetySettingsSuccessResponse>;
  readonly signUp: GQLSignUpResponse;
  readonly submitManualReviewDecision: GQLSubmitDecisionResponse;
  readonly updateAccountInfo?: Maybe<Scalars['Boolean']>;
  readonly updateAction: GQLMutateActionResponse;
  readonly updateAppealSettings: GQLAppealSettings;
  readonly updateContentItemType: GQLMutateContentItemTypeResponse;
  readonly updateContentRule: GQLUpdateContentRuleResponse;
  readonly updateHashBank: GQLMutateHashBankResponse;
  readonly updateLocationBank: GQLMutateLocationBankResponse;
  readonly updateManualReviewQueue: GQLUpdateManualReviewQueueQueueResponse;
  readonly updateNcmecOrgSettings: GQLUpdateNcmecOrgSettingsResponse;
  readonly updateOrgInfo: GQLUpdateOrgInfoSuccessResponse;
  readonly updatePolicy: GQLUpdatePolicyResponse;
  readonly updateReportingRule: GQLUpdateReportingRuleResponse;
  readonly updateRole?: Maybe<Scalars['Boolean']>;
  readonly updateRoutingRule: GQLUpdateRoutingRuleResponse;
  readonly updateSSOCredentials: Scalars['Boolean'];
  readonly updateTextBank: GQLMutateBankResponse;
  readonly updateThreadItemType: GQLMutateThreadItemTypeResponse;
  readonly updateUserItemType: GQLMutateUserItemTypeResponse;
  readonly updateUserRule: GQLUpdateUserRuleResponse;
  readonly updateUserStrikeTTL: GQLUpdateUserStrikeTtlSuccessResponse;
};

export type GQLMutationAddAccessibleQueuesToUserArgs = {
  input: GQLAddAccessibleQueuesToUserInput;
};

export type GQLMutationAddFavoriteMrtQueueArgs = {
  queueId: Scalars['ID'];
};

export type GQLMutationAddFavoriteRuleArgs = {
  ruleId: Scalars['ID'];
};

export type GQLMutationAddPoliciesArgs = {
  policies: ReadonlyArray<GQLAddPolicyInput>;
};

export type GQLMutationApproveUserArgs = {
  id: Scalars['ID'];
};

export type GQLMutationBulkExecuteActionsArgs = {
  input: GQLExecuteBulkActionInput;
};

export type GQLMutationChangePasswordArgs = {
  input: GQLChangePasswordInput;
};

export type GQLMutationCreateActionArgs = {
  input: GQLCreateActionInput;
};

export type GQLMutationCreateBacktestArgs = {
  input: GQLCreateBacktestInput;
};

export type GQLMutationCreateContentItemTypeArgs = {
  input: GQLCreateContentItemTypeInput;
};

export type GQLMutationCreateContentRuleArgs = {
  input: GQLCreateContentRuleInput;
};

export type GQLMutationCreateHashBankArgs = {
  input: GQLCreateHashBankInput;
};

export type GQLMutationCreateLocationBankArgs = {
  input: GQLCreateLocationBankInput;
};

export type GQLMutationCreateManualReviewJobCommentArgs = {
  input: GQLCreateManualReviewJobCommentInput;
};

export type GQLMutationCreateManualReviewQueueArgs = {
  input: GQLCreateManualReviewQueueInput;
};

export type GQLMutationCreateOrgArgs = {
  input: GQLCreateOrgInput;
};

export type GQLMutationCreateReportingRuleArgs = {
  input: GQLCreateReportingRuleInput;
};

export type GQLMutationCreateRoutingRuleArgs = {
  input: GQLCreateRoutingRuleInput;
};

export type GQLMutationCreateTextBankArgs = {
  input: GQLCreateTextBankInput;
};

export type GQLMutationCreateThreadItemTypeArgs = {
  input: GQLCreateThreadItemTypeInput;
};

export type GQLMutationCreateUserItemTypeArgs = {
  input: GQLCreateUserItemTypeInput;
};

export type GQLMutationCreateUserRuleArgs = {
  input: GQLCreateUserRuleInput;
};

export type GQLMutationDeleteActionArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteAllJobsFromQueueArgs = {
  queueId: Scalars['ID'];
};

export type GQLMutationDeleteHashBankArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteInviteArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteItemTypeArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteLocationBankArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteManualReviewJobCommentArgs = {
  input: GQLDeleteManualReviewJobCommentInput;
};

export type GQLMutationDeleteManualReviewQueueArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeletePolicyArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteReportingRuleArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteRoutingRuleArgs = {
  input: GQLDeleteRoutingRuleInput;
};

export type GQLMutationDeleteRuleArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteTextBankArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDeleteUserArgs = {
  id: Scalars['ID'];
};

export type GQLMutationDequeueManualReviewJobArgs = {
  queueId: Scalars['ID'];
};

export type GQLMutationGeneratePasswordResetTokenArgs = {
  userId: Scalars['ID'];
};

export type GQLMutationInviteUserArgs = {
  input: GQLInviteUserInput;
};

export type GQLMutationLogSkipArgs = {
  input: GQLLogSkipInput;
};

export type GQLMutationLoginArgs = {
  input: GQLLoginInput;
};

export type GQLMutationRejectUserArgs = {
  id: Scalars['ID'];
};

export type GQLMutationReleaseJobLockArgs = {
  input: GQLReleaseJobLockInput;
};

export type GQLMutationRemoveAccessibleQueuesToUserArgs = {
  input: GQLRemoveAccessibleQueuesToUserInput;
};

export type GQLMutationRemoveFavoriteMrtQueueArgs = {
  queueId: Scalars['ID'];
};

export type GQLMutationRemoveFavoriteRuleArgs = {
  ruleId: Scalars['ID'];
};

export type GQLMutationReorderRoutingRulesArgs = {
  input: GQLReorderRoutingRulesInput;
};

export type GQLMutationRequestDemoArgs = {
  input: GQLRequestDemoInput;
};

export type GQLMutationResetPasswordArgs = {
  input: GQLResetPasswordInput;
};

export type GQLMutationRotateApiKeyArgs = {
  input: GQLRotateApiKeyInput;
};

export type GQLMutationRunRetroactionArgs = {
  input: GQLRunRetroactionInput;
};

export type GQLMutationSendPasswordResetArgs = {
  input: GQLSendPasswordResetInput;
};

export type GQLMutationSetAllUserStrikeThresholdsArgs = {
  input: GQLSetAllUserStrikeThresholdsInput;
};

export type GQLMutationSetIntegrationConfigArgs = {
  input: GQLSetIntegrationConfigInput;
};

export type GQLMutationSetModeratorSafetySettingsArgs = {
  moderatorSafetySettings: GQLModeratorSafetySettingsInput;
};

export type GQLMutationSetMrtChartConfigurationSettingsArgs = {
  mrtChartConfigurationSettings: GQLManualReviewChartConfigurationsInput;
};

export type GQLMutationSetOrgDefaultSafetySettingsArgs = {
  orgDefaultSafetySettings: GQLModeratorSafetySettingsInput;
};

export type GQLMutationSignUpArgs = {
  input: GQLSignUpInput;
};

export type GQLMutationSubmitManualReviewDecisionArgs = {
  input: GQLSubmitDecisionInput;
};

export type GQLMutationUpdateAccountInfoArgs = {
  firstName?: InputMaybe<Scalars['String']>;
  lastName?: InputMaybe<Scalars['String']>;
};

export type GQLMutationUpdateActionArgs = {
  input: GQLUpdateActionInput;
};

export type GQLMutationUpdateAppealSettingsArgs = {
  input: GQLAppealSettingsInput;
};

export type GQLMutationUpdateContentItemTypeArgs = {
  input: GQLUpdateContentItemTypeInput;
};

export type GQLMutationUpdateContentRuleArgs = {
  input: GQLUpdateContentRuleInput;
};

export type GQLMutationUpdateHashBankArgs = {
  input: GQLUpdateHashBankInput;
};

export type GQLMutationUpdateLocationBankArgs = {
  input: GQLUpdateLocationBankInput;
};

export type GQLMutationUpdateManualReviewQueueArgs = {
  input: GQLUpdateManualReviewQueueInput;
};

export type GQLMutationUpdateNcmecOrgSettingsArgs = {
  input: GQLNcmecOrgSettingsInput;
};

export type GQLMutationUpdateOrgInfoArgs = {
  input: GQLUpdateOrgInfoInput;
};

export type GQLMutationUpdatePolicyArgs = {
  input: GQLUpdatePolicyInput;
};

export type GQLMutationUpdateReportingRuleArgs = {
  input: GQLUpdateReportingRuleInput;
};

export type GQLMutationUpdateRoleArgs = {
  input: GQLUpdateRoleInput;
};

export type GQLMutationUpdateRoutingRuleArgs = {
  input: GQLUpdateRoutingRuleInput;
};

export type GQLMutationUpdateSsoCredentialsArgs = {
  input: GQLUpdateSsoCredentialsInput;
};

export type GQLMutationUpdateTextBankArgs = {
  input: GQLUpdateTextBankInput;
};

export type GQLMutationUpdateThreadItemTypeArgs = {
  input: GQLUpdateThreadItemTypeInput;
};

export type GQLMutationUpdateUserItemTypeArgs = {
  input: GQLUpdateUserItemTypeInput;
};

export type GQLMutationUpdateUserRuleArgs = {
  input: GQLUpdateUserRuleInput;
};

export type GQLMutationUpdateUserStrikeTtlArgs = {
  input: GQLUpdateUserStrikeTtlInput;
};

export const GQLNcmecIncidentType = {
  ChildPornography: 'CHILD_PORNOGRAPHY',
  ChildSexualMolestation: 'CHILD_SEXUAL_MOLESTATION',
  ChildSexTourism: 'CHILD_SEX_TOURISM',
  ChildSexTrafficking: 'CHILD_SEX_TRAFFICKING',
  MisleadingDomainName: 'MISLEADING_DOMAIN_NAME',
  MisleadingWordsOrDigitalImages: 'MISLEADING_WORDS_OR_DIGITAL_IMAGES',
  OnlineEnticementOfChildren: 'ONLINE_ENTICEMENT_OF_CHILDREN',
  UnsolicitedObsceneMaterialToChild: 'UNSOLICITED_OBSCENE_MATERIAL_TO_CHILD',
} as const;

export type GQLNcmecIncidentType =
  (typeof GQLNcmecIncidentType)[keyof typeof GQLNcmecIncidentType];
export type GQLNcmecReport = {
  readonly __typename?: 'NCMECReport';
  readonly additionalFiles: ReadonlyArray<GQLNcmecAdditionalFile>;
  readonly isTest?: Maybe<Scalars['Boolean']>;
  readonly reportId: Scalars['String'];
  readonly reportXml: Scalars['String'];
  readonly reportedMedia: ReadonlyArray<GQLNcmecReportedMedia>;
  readonly reportedMessages: ReadonlyArray<GQLNcmecReportedThread>;
  readonly reviewerId?: Maybe<Scalars['String']>;
  readonly ts: Scalars['DateTime'];
  readonly userId: Scalars['String'];
  readonly userItemType: GQLUserItemType;
};

export type GQLNcmecReportedMedia = {
  readonly __typename?: 'NCMECReportedMedia';
  readonly id: Scalars['String'];
  readonly xml: Scalars['String'];
};

export type GQLNcmecReportedThread = {
  readonly __typename?: 'NCMECReportedThread';
  readonly csv: Scalars['String'];
  readonly fileName: Scalars['String'];
  readonly ncmecFileId: Scalars['String'];
};

export type GQLNcmecAdditionalFile = {
  readonly __typename?: 'NcmecAdditionalFile';
  readonly ncmecFileId: Scalars['String'];
  readonly url: Scalars['String'];
  readonly xml: Scalars['String'];
};

export type GQLNcmecContentInThreadReport = {
  readonly chatType: Scalars['String'];
  readonly content?: InputMaybe<Scalars['String']>;
  readonly contentId: Scalars['ID'];
  readonly contentTypeId: Scalars['ID'];
  readonly creatorId: Scalars['ID'];
  readonly ipAddress: GQLIpAddressInput;
  readonly sentAt: Scalars['DateTime'];
  readonly targetId: Scalars['ID'];
  readonly type: Scalars['String'];
};

export type GQLNcmecContentItem = {
  readonly __typename?: 'NcmecContentItem';
  readonly contentItem: GQLItem;
  readonly isConfirmedCSAM: Scalars['Boolean'];
  readonly isReported: Scalars['Boolean'];
};

export const GQLNcmecFileAnnotation = {
  AnimeDrawingVirtualHentai: 'ANIME_DRAWING_VIRTUAL_HENTAI',
  Bestiality: 'BESTIALITY',
  GenerativeAi: 'GENERATIVE_AI',
  Infant: 'INFANT',
  LiveStreaming: 'LIVE_STREAMING',
  PhysicalHarm: 'PHYSICAL_HARM',
  PossibleSelfProduction: 'POSSIBLE_SELF_PRODUCTION',
  PotentialMeme: 'POTENTIAL_MEME',
  ViolenceGore: 'VIOLENCE_GORE',
  Viral: 'VIRAL',
} as const;

export type GQLNcmecFileAnnotation =
  (typeof GQLNcmecFileAnnotation)[keyof typeof GQLNcmecFileAnnotation];
export const GQLNcmecIndustryClassification = {
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
} as const;

export type GQLNcmecIndustryClassification =
  (typeof GQLNcmecIndustryClassification)[keyof typeof GQLNcmecIndustryClassification];
export type GQLNcmecManualReviewJobPayload = {
  readonly __typename?: 'NcmecManualReviewJobPayload';
  readonly allMediaItems: ReadonlyArray<GQLNcmecContentItem>;
  readonly enqueueSourceInfo?: Maybe<GQLManualReviewJobEnqueueSourceInfo>;
  readonly item: GQLUserItem;
  readonly userScore?: Maybe<Scalars['Int']>;
};

export type GQLNcmecMediaInput = {
  readonly fileAnnotations: ReadonlyArray<GQLNcmecFileAnnotation>;
  readonly id: Scalars['ID'];
  readonly industryClassification: GQLNcmecIndustryClassification;
  readonly typeId: Scalars['ID'];
  readonly url: Scalars['String'];
};

export type GQLNcmecOrgSettings = {
  readonly __typename?: 'NcmecOrgSettings';
  readonly companyTemplate?: Maybe<Scalars['String']>;
  readonly contactEmail?: Maybe<Scalars['String']>;
  readonly defaultNcmecQueueId?: Maybe<Scalars['String']>;
  readonly legalUrl?: Maybe<Scalars['String']>;
  readonly moreInfoUrl?: Maybe<Scalars['String']>;
  readonly ncmecAdditionalInfoEndpoint?: Maybe<Scalars['String']>;
  readonly ncmecPreservationEndpoint?: Maybe<Scalars['String']>;
  readonly password: Scalars['String'];
  readonly username: Scalars['String'];
};

export type GQLNcmecOrgSettingsInput = {
  readonly companyTemplate?: InputMaybe<Scalars['String']>;
  readonly contactEmail?: InputMaybe<Scalars['String']>;
  readonly defaultNcmecQueueId?: InputMaybe<Scalars['String']>;
  readonly legalUrl?: InputMaybe<Scalars['String']>;
  readonly moreInfoUrl?: InputMaybe<Scalars['String']>;
  readonly ncmecAdditionalInfoEndpoint?: InputMaybe<Scalars['String']>;
  readonly ncmecPreservationEndpoint?: InputMaybe<Scalars['String']>;
  readonly password: Scalars['String'];
  readonly username: Scalars['String'];
};

export type GQLNcmecReportedMediaDetails = {
  readonly __typename?: 'NcmecReportedMediaDetails';
  readonly fileAnnotations: ReadonlyArray<GQLNcmecFileAnnotation>;
  readonly id: Scalars['String'];
  readonly industryClassification: GQLNcmecIndustryClassification;
  readonly typeId: Scalars['ID'];
  readonly url: Scalars['String'];
};

export type GQLNcmecThreadInput = {
  readonly reportedContent: ReadonlyArray<GQLNcmecContentInThreadReport>;
  readonly threadId: Scalars['ID'];
  readonly threadTypeId: Scalars['ID'];
};

export type GQLNoJobWithIdInQueueError = GQLError & {
  readonly __typename?: 'NoJobWithIdInQueueError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

/**
 * A not found error that we reuse in many different places,
 * where it's obvious what the error is referring to.
 */
export type GQLNotFoundError = GQLError & {
  readonly __typename?: 'NotFoundError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLNotification = {
  readonly __typename?: 'Notification';
  readonly createdAt: Scalars['DateTime'];
  readonly data?: Maybe<Scalars['JSONObject']>;
  readonly id: Scalars['ID'];
  readonly message: Scalars['String'];
  readonly readAt?: Maybe<Scalars['DateTime']>;
  readonly type: GQLNotificationType;
};

export const GQLNotificationType = {
  RulePassRateIncreaseAnomalyEnd: 'RULE_PASS_RATE_INCREASE_ANOMALY_END',
  RulePassRateIncreaseAnomalyStart: 'RULE_PASS_RATE_INCREASE_ANOMALY_START',
} as const;

export type GQLNotificationType =
  (typeof GQLNotificationType)[keyof typeof GQLNotificationType];
export type GQLOpenAiIntegrationApiCredential = {
  readonly __typename?: 'OpenAiIntegrationApiCredential';
  readonly apiKey: Scalars['String'];
};

export type GQLOpenAiIntegrationApiCredentialInput = {
  readonly apiKey: Scalars['String'];
};

export type GQLOrg = {
  readonly __typename?: 'Org';
  readonly actions: ReadonlyArray<GQLAction>;
  readonly allowMultiplePoliciesPerAction: Scalars['Boolean'];
  readonly apiKey: Scalars['String'];
  readonly appealsRoutingRules: ReadonlyArray<GQLRoutingRule>;
  readonly banks?: Maybe<GQLMatchingBanks>;
  readonly contentTypes: ReadonlyArray<GQLContentType>;
  readonly defaultInterfacePreferences: GQLUserInterfacePreferences;
  readonly email: Scalars['String'];
  readonly hasAppealsEnabled: Scalars['Boolean'];
  readonly hasNCMECReportingEnabled: Scalars['Boolean'];
  readonly hasPartialItemsEndpoint: Scalars['Boolean'];
  readonly hasReportingRulesEnabled: Scalars['Boolean'];
  readonly hideSkipButtonForNonAdmins: Scalars['Boolean'];
  readonly id: Scalars['ID'];
  readonly integrationConfigs: ReadonlyArray<GQLIntegrationConfig>;
  readonly isDemoOrg: Scalars['Boolean'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly mrtQueues: ReadonlyArray<GQLManualReviewQueue>;
  readonly name: Scalars['String'];
  readonly ncmecReports: ReadonlyArray<GQLNcmecReport>;
  readonly onCallAlertEmail?: Maybe<Scalars['String']>;
  readonly pendingInvites: ReadonlyArray<GQLPendingInvite>;
  readonly policies: ReadonlyArray<GQLPolicy>;
  readonly previewJobsViewEnabled: Scalars['Boolean'];
  readonly publicSigningKey: Scalars['String'];
  readonly reportingRules: ReadonlyArray<GQLReportingRule>;
  readonly requiresDecisionReasonInMrt: Scalars['Boolean'];
  readonly requiresPolicyForDecisionsInMrt: Scalars['Boolean'];
  readonly routingRules: ReadonlyArray<GQLRoutingRule>;
  readonly rules: ReadonlyArray<GQLRule>;
  readonly signals: ReadonlyArray<GQLSignal>;
  readonly ssoCert?: Maybe<Scalars['String']>;
  readonly ssoUrl?: Maybe<Scalars['String']>;
  readonly userStrikeTTL: Scalars['Int'];
  readonly userStrikeThresholds: ReadonlyArray<GQLUserStrikeThreshold>;
  readonly users: ReadonlyArray<GQLUser>;
  readonly usersWhoCanReviewEveryQueue: ReadonlyArray<GQLUser>;
  readonly websiteUrl: Scalars['String'];
};

export type GQLOrgSignalsArgs = {
  customOnly?: InputMaybe<Scalars['Boolean']>;
};

export type GQLOrgWithEmailExistsError = GQLError & {
  readonly __typename?: 'OrgWithEmailExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLOrgWithNameExistsError = GQLError & {
  readonly __typename?: 'OrgWithNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

/** Information about the current page in a connection. */
export type GQLPageInfo = {
  readonly __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  readonly endCursor: Scalars['Cursor'];
  /** When paginating forwards, are there more items? */
  readonly hasNextPage: Scalars['Boolean'];
  /** When paginating backwards, are there more items? */
  readonly hasPreviousPage: Scalars['Boolean'];
  /** When paginating backwards, the cursor to continue. */
  readonly startCursor: Scalars['Cursor'];
};

export type GQLPartialItemsEndpointResponseError = GQLError & {
  readonly __typename?: 'PartialItemsEndpointResponseError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLPartialItemsInvalidResponseError = GQLError & {
  readonly __typename?: 'PartialItemsInvalidResponseError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLPartialItemsMissingEndpointError = GQLError & {
  readonly __typename?: 'PartialItemsMissingEndpointError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLPartialItemsResponse =
  | GQLPartialItemsEndpointResponseError
  | GQLPartialItemsInvalidResponseError
  | GQLPartialItemsMissingEndpointError
  | GQLPartialItemsSuccessResponse;

export type GQLPartialItemsSuccessResponse = {
  readonly __typename?: 'PartialItemsSuccessResponse';
  readonly items: ReadonlyArray<GQLItem>;
};

export type GQLPendingInvite = {
  readonly __typename?: 'PendingInvite';
  readonly createdAt: Scalars['DateTime'];
  readonly email: Scalars['String'];
  readonly id: Scalars['ID'];
  readonly role: GQLUserRole;
};

export type GQLPlaceBounds = {
  readonly __typename?: 'PlaceBounds';
  readonly northeastCorner: GQLLatLng;
  readonly southwestCorner: GQLLatLng;
};

export type GQLPlaceBoundsInput = {
  readonly northeastCorner: GQLLatLngInput;
  readonly southwestCorner: GQLLatLngInput;
};

export type GQLPolicy = {
  readonly __typename?: 'Policy';
  readonly applyUserStrikeCountConfigToChildren?: Maybe<Scalars['Boolean']>;
  readonly enforcementGuidelines?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly parentId?: Maybe<Scalars['ID']>;
  readonly policyText?: Maybe<Scalars['String']>;
  readonly policyType?: Maybe<GQLPolicyType>;
  readonly userStrikeCount?: Maybe<Scalars['Int']>;
};

export type GQLPolicyActionCount = {
  readonly __typename?: 'PolicyActionCount';
  readonly actionId: Scalars['String'];
  readonly actorId?: Maybe<Scalars['String']>;
  readonly count: Scalars['Int'];
  readonly itemSubmissionIds: ReadonlyArray<Scalars['String']>;
  readonly policyId?: Maybe<Scalars['String']>;
};

export type GQLPolicyNameExistsError = GQLError & {
  readonly __typename?: 'PolicyNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLPolicyType = {
  DrugSales: 'DRUG_SALES',
  FraudAndDeception: 'FRAUD_AND_DECEPTION',
  Grooming: 'GROOMING',
  Harrassment: 'HARRASSMENT',
  Hate: 'HATE',
  Privacy: 'PRIVACY',
  Profanity: 'PROFANITY',
  SelfHarmAndSuicide: 'SELF_HARM_AND_SUICIDE',
  SexualContent: 'SEXUAL_CONTENT',
  SexualExploitation: 'SEXUAL_EXPLOITATION',
  Spam: 'SPAM',
  Terrorism: 'TERRORISM',
  Violence: 'VIOLENCE',
  WeaponSales: 'WEAPON_SALES',
} as const;

export type GQLPolicyType = (typeof GQLPolicyType)[keyof typeof GQLPolicyType];
export type GQLPolicyViolationsCount = {
  readonly __typename?: 'PolicyViolationsCount';
  readonly count: Scalars['Int'];
  readonly policyId: Scalars['String'];
};

export type GQLPostActionsEnqueueSourceInfo = {
  readonly __typename?: 'PostActionsEnqueueSourceInfo';
  readonly kind: GQLJobCreationSourceOptions;
};

export type GQLQuery = {
  readonly __typename?: 'Query';
  readonly action?: Maybe<GQLAction>;
  readonly actionStatistics: ReadonlyArray<GQLActionData>;
  readonly allOrgs: ReadonlyArray<GQLOrg>;
  readonly allRuleInsights: GQLAllRuleInsights;
  readonly apiKey: Scalars['String'];
  readonly appealSettings?: Maybe<GQLAppealSettings>;
  readonly getCommentsForJob: ReadonlyArray<GQLManualReviewJobComment>;
  readonly getDecidedJob?: Maybe<GQLManualReviewJob>;
  readonly getDecidedJobFromJobId?: Maybe<GQLManualReviewJobWithDecisions>;
  readonly getDecisionCounts: ReadonlyArray<GQLDecisionCount>;
  readonly getDecisionsTable: ReadonlyArray<GQLTableDecisionCount>;
  readonly getExistingJobsForItem: ReadonlyArray<GQLManualReviewExistingJob>;
  readonly getFullReportingRuleResultForItem: GQLGetFullReportingRuleResultForItemResponse;
  readonly getFullRuleResultForItem: GQLGetFullResultForItemResponse;
  readonly getJobCreationCounts: ReadonlyArray<GQLJobCreationCount>;
  readonly getRecentDecisions: ReadonlyArray<GQLManualReviewDecision>;
  readonly getResolvedJobCounts: ReadonlyArray<GQLResolvedJobCount>;
  readonly getResolvedJobsForUser: Scalars['Int'];
  readonly getSSORedirectUrl?: Maybe<Scalars['String']>;
  readonly getSkippedJobCounts: ReadonlyArray<GQLSkippedJobCount>;
  readonly getSkippedJobsForUser: Scalars['Int'];
  readonly getSkipsForRecentDecisions: ReadonlyArray<GQLSkippedJob>;
  readonly getTimeToAction?: Maybe<ReadonlyArray<GQLTimeToAction>>;
  readonly getTotalPendingJobsCount: Scalars['Int'];
  readonly getUserStrikeCountDistribution: ReadonlyArray<GQLUserStrikeBucket>;
  readonly hashBank?: Maybe<GQLHashBank>;
  readonly hashBankById?: Maybe<GQLHashBank>;
  readonly hashBanks: ReadonlyArray<GQLHashBank>;
  readonly integrationConfig: GQLIntegrationConfigQueryResponse;
  readonly inviteUserToken: GQLInviteUserTokenResponse;
  readonly itemActionHistory: ReadonlyArray<GQLItemAction>;
  readonly itemSubmissions: ReadonlyArray<GQLItemSubmissions>;
  readonly itemType?: Maybe<GQLItemType>;
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly itemWithHistory: GQLItemHistoryResponse;
  readonly itemsWithId: ReadonlyArray<GQLItemSubmissions>;
  readonly latestItemSubmissions: ReadonlyArray<GQLItem>;
  readonly latestItemsCreatedBy: ReadonlyArray<GQLItemSubmissions>;
  readonly latestItemsCreatedByWithThread: ReadonlyArray<GQLThreadWithMessages>;
  readonly locationBank?: Maybe<GQLLocationBank>;
  readonly manualReviewQueue?: Maybe<GQLManualReviewQueue>;
  readonly me?: Maybe<GQLUser>;
  readonly myOrg?: Maybe<GQLOrg>;
  readonly ncmecOrgSettings?: Maybe<GQLNcmecOrgSettings>;
  readonly ncmecReportById?: Maybe<GQLNcmecReport>;
  readonly ncmecThreads: ReadonlyArray<GQLThreadWithMessagesAndIpAddress>;
  readonly org?: Maybe<GQLOrg>;
  readonly partialItems: GQLPartialItemsResponse;
  readonly policy?: Maybe<GQLPolicy>;
  readonly recentUserStrikeActions: ReadonlyArray<GQLRecentUserStrikeActions>;
  readonly reportingInsights: GQLReportingInsights;
  readonly reportingRule?: Maybe<GQLReportingRule>;
  readonly rule?: Maybe<GQLRule>;
  readonly spotTestRule: GQLRuleExecutionResult;
  readonly textBank?: Maybe<GQLTextBank>;
  readonly threadHistory: ReadonlyArray<GQLItemSubmissions>;
  readonly topPolicyViolations: ReadonlyArray<GQLPolicyViolationsCount>;
  readonly user?: Maybe<GQLUser>;
  readonly userFromToken?: Maybe<Scalars['ID']>;
  readonly userHistory: GQLUserHistoryResponse;
};

export type GQLQueryActionArgs = {
  id: Scalars['ID'];
};

export type GQLQueryActionStatisticsArgs = {
  input: GQLActionStatisticsInput;
};

export type GQLQueryGetCommentsForJobArgs = {
  jobId: Scalars['ID'];
};

export type GQLQueryGetDecidedJobArgs = {
  id: Scalars['ID'];
};

export type GQLQueryGetDecidedJobFromJobIdArgs = {
  id: Scalars['String'];
};

export type GQLQueryGetDecisionCountsArgs = {
  input: GQLGetDecisionCountInput;
};

export type GQLQueryGetDecisionsTableArgs = {
  input: GQLGetDecisionCountsTableInput;
};

export type GQLQueryGetExistingJobsForItemArgs = {
  itemId: Scalars['ID'];
  itemTypeId: Scalars['ID'];
};

export type GQLQueryGetFullReportingRuleResultForItemArgs = {
  input: GQLGetFullResultForItemInput;
};

export type GQLQueryGetFullRuleResultForItemArgs = {
  input: GQLGetFullResultForItemInput;
};

export type GQLQueryGetJobCreationCountsArgs = {
  input: GQLGetJobCreationCountInput;
};

export type GQLQueryGetRecentDecisionsArgs = {
  input: GQLRecentDecisionsInput;
};

export type GQLQueryGetResolvedJobCountsArgs = {
  input: GQLGetResolvedJobCountInput;
};

export type GQLQueryGetResolvedJobsForUserArgs = {
  timeZone: Scalars['String'];
};

export type GQLQueryGetSsoRedirectUrlArgs = {
  emailAddress: Scalars['String'];
};

export type GQLQueryGetSkippedJobCountsArgs = {
  input: GQLGetSkippedJobCountInput;
};

export type GQLQueryGetSkippedJobsForUserArgs = {
  timeZone: Scalars['String'];
};

export type GQLQueryGetSkipsForRecentDecisionsArgs = {
  input: GQLRecentDecisionsInput;
};

export type GQLQueryGetTimeToActionArgs = {
  input: GQLTimeToActionInput;
};

export type GQLQueryHashBankArgs = {
  name: Scalars['String'];
};

export type GQLQueryHashBankByIdArgs = {
  id: Scalars['ID'];
};

export type GQLQueryIntegrationConfigArgs = {
  name: GQLIntegration;
};

export type GQLQueryInviteUserTokenArgs = {
  token: Scalars['String'];
};

export type GQLQueryItemActionHistoryArgs = {
  itemIdentifier: GQLItemIdentifierInput;
  submissionTime?: InputMaybe<Scalars['DateTime']>;
};

export type GQLQueryItemSubmissionsArgs = {
  itemIdentifiers: ReadonlyArray<GQLItemIdentifierInput>;
};

export type GQLQueryItemTypeArgs = {
  id: Scalars['ID'];
  version?: InputMaybe<Scalars['String']>;
};

export type GQLQueryItemTypesArgs = {
  identifiers: ReadonlyArray<GQLItemTypeIdentifierInput>;
};

export type GQLQueryItemWithHistoryArgs = {
  itemIdentifier: GQLItemIdentifierInput;
  submissionTime?: InputMaybe<Scalars['DateTime']>;
};

export type GQLQueryItemsWithIdArgs = {
  itemId: Scalars['ID'];
  returnFirstResultOnly?: InputMaybe<Scalars['Boolean']>;
  typeId?: InputMaybe<Scalars['ID']>;
};

export type GQLQueryLatestItemSubmissionsArgs = {
  itemIdentifiers: ReadonlyArray<GQLItemIdentifierInput>;
};

export type GQLQueryLatestItemsCreatedByArgs = {
  earliestReturnedSubmissionDate?: InputMaybe<Scalars['DateTime']>;
  itemIdentifier: GQLItemIdentifierInput;
  oldestReturnedSubmissionDate?: InputMaybe<Scalars['DateTime']>;
};

export type GQLQueryLatestItemsCreatedByWithThreadArgs = {
  itemIdentifier: GQLItemIdentifierInput;
};

export type GQLQueryLocationBankArgs = {
  id: Scalars['ID'];
};

export type GQLQueryManualReviewQueueArgs = {
  id: Scalars['ID'];
};

export type GQLQueryNcmecReportByIdArgs = {
  reportId: Scalars['ID'];
};

export type GQLQueryNcmecThreadsArgs = {
  reportedMessages: ReadonlyArray<GQLItemIdentifierInput>;
  userId: GQLItemIdentifierInput;
};

export type GQLQueryOrgArgs = {
  id: Scalars['ID'];
};

export type GQLQueryPartialItemsArgs = {
  input: ReadonlyArray<GQLItemIdentifierInput>;
};

export type GQLQueryPolicyArgs = {
  id: Scalars['ID'];
};

export type GQLQueryRecentUserStrikeActionsArgs = {
  input: GQLRecentUserStrikeActionsInput;
};

export type GQLQueryReportingRuleArgs = {
  id: Scalars['ID'];
};

export type GQLQueryRuleArgs = {
  id: Scalars['ID'];
};

export type GQLQuerySpotTestRuleArgs = {
  item: GQLSpotTestItemInput;
  ruleId: Scalars['ID'];
};

export type GQLQueryTextBankArgs = {
  id: Scalars['ID'];
};

export type GQLQueryThreadHistoryArgs = {
  endDate?: InputMaybe<Scalars['DateTime']>;
  threadIdentifier: GQLItemIdentifierInput;
};

export type GQLQueryTopPolicyViolationsArgs = {
  input: GQLTopPolicyViolationsInput;
};

export type GQLQueryUserArgs = {
  id: Scalars['ID'];
};

export type GQLQueryUserFromTokenArgs = {
  token: Scalars['String'];
};

export type GQLQueryUserHistoryArgs = {
  itemIdentifier: GQLItemIdentifierInput;
};

export type GQLQueueDoesNotExistError = GQLError & {
  readonly __typename?: 'QueueDoesNotExistError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLRecentDecisionsFilterInput = {
  readonly decisions?: InputMaybe<
    ReadonlyArray<GQLRecentManualReviewDecisionType>
  >;
  readonly endTime?: InputMaybe<Scalars['DateTime']>;
  readonly policyIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly queueIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly reviewerIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly startTime?: InputMaybe<Scalars['DateTime']>;
  readonly userSearchString?: InputMaybe<Scalars['String']>;
};

export type GQLRecentDecisionsForUser = {
  readonly __typename?: 'RecentDecisionsForUser';
  readonly recentDecisions: ReadonlyArray<GQLManualReviewDecision>;
  readonly userSearchString: Scalars['String'];
};

export type GQLRecentDecisionsInput = {
  readonly filter: GQLRecentDecisionsFilterInput;
  readonly page?: InputMaybe<Scalars['Int']>;
};

export type GQLRecentManualReviewAcceptAppealDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewAutomaticCloseDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewDecisionType = {
  readonly acceptAppealDecision?: InputMaybe<GQLRecentManualReviewAcceptAppealDecision>;
  readonly automaticCloseDecision?: InputMaybe<GQLRecentManualReviewAutomaticCloseDecision>;
  readonly ignoreDecision?: InputMaybe<GQLRecentManualReviewIgnoreDecision>;
  readonly rejectAppealDecision?: InputMaybe<GQLRecentManualReviewRejectAppealDecision>;
  readonly submitNcmecReportDecision?: InputMaybe<GQLRecentManualReviewSubmitNcmecReportDecision>;
  readonly transformJobAndRecreateInQueueDecision?: InputMaybe<GQLRecentManualReviewTransformJobAndRecreateInQueueDecision>;
  readonly userOrRelatedActionDecision?: InputMaybe<GQLRecentManualReviewUserOrRelatedActionDecision>;
};

export type GQLRecentManualReviewIgnoreDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewRejectAppealDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewSubmitNcmecReportDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewTransformJobAndRecreateInQueueDecision = {
  readonly _?: InputMaybe<Scalars['Boolean']>;
};

export type GQLRecentManualReviewUserOrRelatedActionDecision = {
  readonly actionIds: ReadonlyArray<Scalars['ID']>;
};

export type GQLRecentUserStrikeActions = {
  readonly __typename?: 'RecentUserStrikeActions';
  readonly actionId: Scalars['String'];
  readonly itemId: Scalars['String'];
  readonly itemTypeId: Scalars['String'];
  readonly source: Scalars['String'];
  readonly time: Scalars['DateTime'];
};

export type GQLRecentUserStrikeActionsInput = {
  readonly filterBy?: InputMaybe<GQLStartAndEndDateFilterByInput>;
  readonly limit: Scalars['Int'];
};

export type GQLRecommendedThresholds = {
  readonly __typename?: 'RecommendedThresholds';
  readonly highPrecisionThreshold: Scalars['StringOrFloat'];
  readonly highRecallThreshold: Scalars['StringOrFloat'];
};

export type GQLRecordingJobDecisionFailedError = GQLError & {
  readonly __typename?: 'RecordingJobDecisionFailedError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLRejectAppealDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'RejectAppealDecisionComponent';
    readonly actionIds: ReadonlyArray<Scalars['String']>;
    readonly appealId: Scalars['String'];
    readonly type: GQLManualReviewDecisionType;
  };

export type GQLReleaseJobLockInput = {
  readonly jobId: Scalars['String'];
  readonly lockToken: Scalars['String'];
  readonly queueId: Scalars['String'];
};

export type GQLRemoveAccessibleQueuesToUserInput = {
  readonly queueIds: ReadonlyArray<Scalars['ID']>;
  readonly userId: Scalars['ID'];
};

export type GQLRemoveAccessibleQueuesToUserResponse =
  | GQLMutateAccessibleQueuesForUserSuccessResponse
  | GQLNotFoundError;

export type GQLRemoveFavoriteMrtQueueSuccessResponse = {
  readonly __typename?: 'RemoveFavoriteMRTQueueSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLRemoveFavoriteRuleResponse =
  GQLRemoveFavoriteRuleSuccessResponse;

export type GQLRemoveFavoriteRuleSuccessResponse = {
  readonly __typename?: 'RemoveFavoriteRuleSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLReorderRoutingRulesInput = {
  readonly isAppealsRule?: InputMaybe<Scalars['Boolean']>;
  readonly order: ReadonlyArray<Scalars['ID']>;
};

export type GQLReorderRoutingRulesResponse =
  GQLMutateRoutingRulesOrderSuccessResponse;

export type GQLReportEnqueueSourceInfo = {
  readonly __typename?: 'ReportEnqueueSourceInfo';
  readonly kind: GQLJobCreationSourceOptions;
};

export type GQLReportHistoryEntry = {
  readonly __typename?: 'ReportHistoryEntry';
  readonly policyId?: Maybe<Scalars['ID']>;
  readonly reason?: Maybe<Scalars['String']>;
  readonly reportId: Scalars['ID'];
  readonly reportedAt: Scalars['DateTime'];
  readonly reporterId?: Maybe<GQLItemIdentifier>;
};

export type GQLReportHistoryEntryInput = {
  readonly policyId?: InputMaybe<Scalars['ID']>;
  readonly reason?: InputMaybe<Scalars['String']>;
  readonly reportId: Scalars['ID'];
  readonly reportedAt: Scalars['DateTime'];
  readonly reporterId?: InputMaybe<GQLReporterIdInput>;
};

export type GQLReportedForReason = {
  readonly __typename?: 'ReportedForReason';
  readonly reason?: Maybe<Scalars['String']>;
  readonly reporterId?: Maybe<GQLItemIdentifier>;
};

export type GQLReporterIdInput = {
  readonly id: Scalars['ID'];
  readonly typeId: Scalars['ID'];
};

export type GQLReportingInsights = {
  readonly __typename?: 'ReportingInsights';
  readonly totalIngestedReportsByDay: ReadonlyArray<GQLCountByDay>;
};

export type GQLReportingRule = {
  readonly __typename?: 'ReportingRule';
  readonly actions: ReadonlyArray<GQLAction>;
  readonly conditionSet: GQLConditionSet;
  readonly creator?: Maybe<GQLUser>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly insights: GQLReportingRuleInsights;
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly orgId: Scalars['ID'];
  readonly policies: ReadonlyArray<GQLPolicy>;
  readonly status: GQLReportingRuleStatus;
};

export type GQLReportingRuleExecutionResult = {
  readonly __typename?: 'ReportingRuleExecutionResult';
  readonly creatorId?: Maybe<Scalars['String']>;
  readonly creatorTypeId?: Maybe<Scalars['String']>;
  readonly date: Scalars['Date'];
  readonly environment: GQLRuleEnvironment;
  readonly itemData: Scalars['String'];
  readonly itemId: Scalars['ID'];
  readonly itemTypeId: Scalars['ID'];
  readonly itemTypeName: Scalars['String'];
  readonly passed: Scalars['Boolean'];
  readonly policyIds: ReadonlyArray<Scalars['String']>;
  readonly result?: Maybe<GQLConditionSetWithResult>;
  readonly ruleId: Scalars['ID'];
  readonly ruleName: Scalars['String'];
  readonly signalResults?: Maybe<ReadonlyArray<GQLSignalWithScore>>;
  readonly ts: Scalars['DateTime'];
};

export type GQLReportingRuleInsights = {
  readonly __typename?: 'ReportingRuleInsights';
  readonly latestVersionSamples: ReadonlyArray<GQLReportingRuleExecutionResult>;
  readonly passRateData: ReadonlyArray<GQLReportingRulePassRateData>;
  readonly priorVersionSamples: ReadonlyArray<GQLReportingRuleExecutionResult>;
};

export type GQLReportingRuleInsightsPassRateDataArgs = {
  lookbackStartDate?: InputMaybe<Scalars['Date']>;
};

export type GQLReportingRuleNameExistsError = GQLError & {
  readonly __typename?: 'ReportingRuleNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLReportingRulePassRateData = {
  readonly __typename?: 'ReportingRulePassRateData';
  readonly date: Scalars['String'];
  readonly totalMatches: Scalars['Float'];
  readonly totalRequests: Scalars['Float'];
};

export const GQLReportingRuleStatus = {
  Archived: 'ARCHIVED',
  Background: 'BACKGROUND',
  Draft: 'DRAFT',
  Live: 'LIVE',
} as const;

export type GQLReportingRuleStatus =
  (typeof GQLReportingRuleStatus)[keyof typeof GQLReportingRuleStatus];
export type GQLRequestDemoInput = {
  readonly company: Scalars['String'];
  readonly email: Scalars['String'];
  readonly interests: ReadonlyArray<GQLRequestDemoInterest>;
  readonly isFromGoogleAds: Scalars['Boolean'];
  readonly ref: Scalars['String'];
  readonly website: Scalars['String'];
};

export const GQLRequestDemoInterest = {
  AutomatedEnforcement: 'AUTOMATED_ENFORCEMENT',
  ComplianceToolkit: 'COMPLIANCE_TOOLKIT',
  CustomAiModels: 'CUSTOM_AI_MODELS',
  ModeratorConsole: 'MODERATOR_CONSOLE',
} as const;

export type GQLRequestDemoInterest =
  (typeof GQLRequestDemoInterest)[keyof typeof GQLRequestDemoInterest];
export type GQLResetPasswordInput = {
  readonly newPassword: Scalars['String'];
  readonly token: Scalars['String'];
};

export type GQLResolvedJobCount = {
  readonly __typename?: 'ResolvedJobCount';
  readonly count: Scalars['Int'];
  readonly queueId?: Maybe<Scalars['String']>;
  readonly reviewerId?: Maybe<Scalars['String']>;
  readonly time: Scalars['String'];
};

export type GQLRotateApiKeyError = GQLError & {
  readonly __typename?: 'RotateApiKeyError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLRotateApiKeyInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly name: Scalars['String'];
};

export type GQLRotateApiKeyResponse =
  | GQLRotateApiKeyError
  | GQLRotateApiKeySuccessResponse;

export type GQLRotateApiKeySuccessResponse = {
  readonly __typename?: 'RotateApiKeySuccessResponse';
  readonly apiKey: Scalars['String'];
  readonly record: GQLApiKey;
};

export type GQLRoutingRule = {
  readonly __typename?: 'RoutingRule';
  readonly conditionSet: GQLConditionSet;
  readonly creatorId: Scalars['String'];
  readonly description?: Maybe<Scalars['String']>;
  readonly destinationQueue: GQLManualReviewQueue;
  readonly id: Scalars['ID'];
  readonly itemTypes: ReadonlyArray<GQLItemType>;
  readonly name: Scalars['String'];
  readonly status: GQLRoutingRuleStatus;
};

export type GQLRoutingRuleNameExistsError = GQLError & {
  readonly __typename?: 'RoutingRuleNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export const GQLRoutingRuleStatus = {
  Live: 'LIVE',
} as const;

export type GQLRoutingRuleStatus =
  (typeof GQLRoutingRuleStatus)[keyof typeof GQLRoutingRuleStatus];
export type GQLRule = {
  readonly actions: ReadonlyArray<GQLAction>;
  readonly backtests: ReadonlyArray<GQLBacktest>;
  readonly conditionSet: GQLConditionSet;
  readonly createdAt: Scalars['String'];
  readonly creator: GQLUser;
  readonly description?: Maybe<Scalars['String']>;
  readonly expirationTime?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly insights: GQLRuleInsights;
  readonly maxDailyActions?: Maybe<Scalars['Float']>;
  readonly name: Scalars['String'];
  readonly parentId?: Maybe<Scalars['ID']>;
  readonly policies: ReadonlyArray<GQLPolicy>;
  readonly status: GQLRuleStatus;
  readonly tags?: Maybe<ReadonlyArray<Maybe<Scalars['String']>>>;
  readonly updatedAt: Scalars['String'];
};

export type GQLRuleBacktestsArgs = {
  ids?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
};

export const GQLRuleEnvironment = {
  Background: 'BACKGROUND',
  Backtest: 'BACKTEST',
  Live: 'LIVE',
  Manual: 'MANUAL',
  Retroaction: 'RETROACTION',
} as const;

export type GQLRuleEnvironment =
  (typeof GQLRuleEnvironment)[keyof typeof GQLRuleEnvironment];
export type GQLRuleExecutionEnqueueSourceInfo = {
  readonly __typename?: 'RuleExecutionEnqueueSourceInfo';
  readonly kind: GQLJobCreationSourceOptions;
  readonly rules: ReadonlyArray<GQLRule>;
};

export type GQLRuleExecutionResult = {
  readonly __typename?: 'RuleExecutionResult';
  readonly content: Scalars['String'];
  readonly contentId: Scalars['String'];
  readonly date: Scalars['Date'];
  readonly environment: GQLRuleEnvironment;
  readonly itemTypeId: Scalars['ID'];
  readonly itemTypeName: Scalars['String'];
  readonly passed: Scalars['Boolean'];
  readonly policies: ReadonlyArray<Scalars['String']>;
  readonly result?: Maybe<GQLConditionSetWithResult>;
  readonly ruleId: Scalars['ID'];
  readonly ruleName: Scalars['String'];
  readonly signalResults?: Maybe<ReadonlyArray<GQLSignalWithScore>>;
  readonly tags: ReadonlyArray<Scalars['String']>;
  readonly ts: Scalars['DateTime'];
  readonly userId?: Maybe<Scalars['String']>;
  readonly userTypeId?: Maybe<Scalars['String']>;
};

export type GQLRuleExecutionResultEdge = {
  readonly __typename?: 'RuleExecutionResultEdge';
  readonly cursor: Scalars['Cursor'];
  readonly node: GQLRuleExecutionResult;
};

export type GQLRuleExecutionResultsConnection = {
  readonly __typename?: 'RuleExecutionResultsConnection';
  readonly edges: ReadonlyArray<GQLRuleExecutionResultEdge>;
  readonly pageInfo: GQLPageInfo;
};

export type GQLRuleHasRunningBacktestsError = GQLError & {
  readonly __typename?: 'RuleHasRunningBacktestsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLRuleInsights = {
  readonly __typename?: 'RuleInsights';
  readonly latestVersionSamples: ReadonlyArray<GQLRuleExecutionResult>;
  readonly passRateData?: Maybe<ReadonlyArray<Maybe<GQLRulePassRateData>>>;
  readonly priorVersionSamples: ReadonlyArray<GQLRuleExecutionResult>;
};

export type GQLRuleInsightsPassRateDataArgs = {
  lookbackStartDate?: InputMaybe<Scalars['Date']>;
};

export type GQLRuleNameExistsError = GQLError & {
  readonly __typename?: 'RuleNameExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLRulePassRateData = {
  readonly __typename?: 'RulePassRateData';
  readonly date: Scalars['String'];
  readonly totalMatches: Scalars['Float'];
  readonly totalRequests: Scalars['Float'];
};

export const GQLRuleStatus = {
  Archived: 'ARCHIVED',
  Background: 'BACKGROUND',
  Deprecated: 'DEPRECATED',
  Draft: 'DRAFT',
  Expired: 'EXPIRED',
  Live: 'LIVE',
} as const;

export type GQLRuleStatus = (typeof GQLRuleStatus)[keyof typeof GQLRuleStatus];
export type GQLRunRetroactionInput = {
  readonly endAt: Scalars['DateTime'];
  readonly ruleId: Scalars['ID'];
  readonly startAt: Scalars['DateTime'];
};

export type GQLRunRetroactionResponse = GQLRunRetroactionSuccessResponse;

export type GQLRunRetroactionSuccessResponse = {
  readonly __typename?: 'RunRetroactionSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLScalarSignalOutputType = {
  readonly __typename?: 'ScalarSignalOutputType';
  readonly scalarType: GQLScalarType;
};

export const GQLScalarType = {
  Audio: 'AUDIO',
  Boolean: 'BOOLEAN',
  Datetime: 'DATETIME',
  Geohash: 'GEOHASH',
  Id: 'ID',
  Image: 'IMAGE',
  Number: 'NUMBER',
  PolicyId: 'POLICY_ID',
  RelatedItem: 'RELATED_ITEM',
  String: 'STRING',
  Url: 'URL',
  UserId: 'USER_ID',
  Video: 'VIDEO',
} as const;

export type GQLScalarType = (typeof GQLScalarType)[keyof typeof GQLScalarType];
export type GQLSchemaFieldRoles =
  | GQLContentSchemaFieldRoles
  | GQLThreadSchemaFieldRoles
  | GQLUserSchemaFieldRoles;

export type GQLSendPasswordResetInput = {
  readonly email: Scalars['String'];
};

export type GQLSetAllUserStrikeThresholdsInput = {
  readonly thresholds: ReadonlyArray<GQLSetUserStrikeThresholdInput>;
};

export type GQLSetAllUserStrikeThresholdsSuccessResponse = {
  readonly __typename?: 'SetAllUserStrikeThresholdsSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLSetIntegrationConfigInput = {
  readonly apiCredential: GQLIntegrationApiCredentialInput;
};

export type GQLSetIntegrationConfigResponse =
  | GQLIntegrationConfigTooManyCredentialsError
  | GQLIntegrationEmptyInputCredentialsError
  | GQLIntegrationNoInputCredentialsError
  | GQLSetIntegrationConfigSuccessResponse;

export type GQLSetIntegrationConfigSuccessResponse = {
  readonly __typename?: 'SetIntegrationConfigSuccessResponse';
  readonly config: GQLIntegrationConfig;
};

export type GQLSetModeratorSafetySettingsSuccessResponse = {
  readonly __typename?: 'SetModeratorSafetySettingsSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLSetMrtChartConfigurationSettingsSuccessResponse = {
  readonly __typename?: 'SetMrtChartConfigurationSettingsSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLSetUserStrikeThresholdInput = {
  readonly actions: ReadonlyArray<Scalars['String']>;
  readonly threshold: Scalars['Int'];
};

export type GQLSignUpInput = {
  readonly email: Scalars['String'];
  readonly firstName: Scalars['String'];
  readonly inviteUserToken?: InputMaybe<Scalars['String']>;
  readonly lastName: Scalars['String'];
  readonly loginMethod: GQLLoginMethod;
  readonly orgId: Scalars['String'];
  readonly password?: InputMaybe<Scalars['String']>;
  readonly role?: InputMaybe<GQLUserRole>;
};

export type GQLSignUpResponse =
  | GQLSignUpSuccessResponse
  | GQLSignUpUserExistsError;

export type GQLSignUpSuccessResponse = {
  readonly __typename?: 'SignUpSuccessResponse';
  readonly data?: Maybe<GQLUser>;
};

export type GQLSignUpUserExistsError = GQLError & {
  readonly __typename?: 'SignUpUserExistsError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLSignal = {
  readonly __typename?: 'Signal';
  readonly allowedInAutomatedRules: Scalars['Boolean'];
  readonly args?: Maybe<GQLSignalArgs>;
  readonly callbackUrl?: Maybe<Scalars['String']>;
  readonly callbackUrlBody?: Maybe<Scalars['String']>;
  readonly callbackUrlHeaders?: Maybe<Scalars['String']>;
  readonly description: Scalars['String'];
  readonly disabledInfo: GQLDisabledInfo;
  readonly docsUrl?: Maybe<Scalars['String']>;
  readonly eligibleInputs: ReadonlyArray<GQLSignalInputType>;
  readonly eligibleSubcategories: ReadonlyArray<GQLSignalSubcategory>;
  readonly id: Scalars['ID'];
  readonly integration?: Maybe<GQLIntegration>;
  readonly name: Scalars['String'];
  readonly outputType: GQLSignalOutputType;
  readonly pricingStructure: GQLSignalPricingStructure;
  readonly recommendedThresholds?: Maybe<GQLRecommendedThresholds>;
  readonly shouldPromptForMatchingValues: Scalars['Boolean'];
  readonly subcategory?: Maybe<Scalars['String']>;
  readonly supportedLanguages: GQLSupportedLanguages;
  readonly type: GQLSignalType;
};

export type GQLSignalArgs = GQLAggregationSignalArgs;

export type GQLSignalArgsInput = {
  readonly AGGREGATION?: InputMaybe<GQLAggregationSignalArgsInput>;
};

export const GQLSignalInputType = {
  Audio: 'AUDIO',
  Boolean: 'BOOLEAN',
  Datetime: 'DATETIME',
  FullItem: 'FULL_ITEM',
  Geohash: 'GEOHASH',
  Id: 'ID',
  Image: 'IMAGE',
  Number: 'NUMBER',
  PolicyId: 'POLICY_ID',
  RelatedItem: 'RELATED_ITEM',
  String: 'STRING',
  Url: 'URL',
  UserId: 'USER_ID',
  Video: 'VIDEO',
} as const;

export type GQLSignalInputType =
  (typeof GQLSignalInputType)[keyof typeof GQLSignalInputType];
export type GQLSignalOutputType =
  | GQLEnumSignalOutputType
  | GQLScalarSignalOutputType;

export type GQLSignalPricingStructure = {
  readonly __typename?: 'SignalPricingStructure';
  readonly type: GQLSignalPricingStructureType;
};

export const GQLSignalPricingStructureType = {
  Free: 'FREE',
  Subscription: 'SUBSCRIPTION',
} as const;

export type GQLSignalPricingStructureType =
  (typeof GQLSignalPricingStructureType)[keyof typeof GQLSignalPricingStructureType];
export type GQLSignalSubcategory = {
  readonly __typename?: 'SignalSubcategory';
  readonly childrenIds: ReadonlyArray<Scalars['String']>;
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['String'];
  readonly label: Scalars['String'];
};

export type GQLSignalSubcategoryInput = {
  readonly name?: InputMaybe<Scalars['String']>;
  readonly options?: InputMaybe<
    ReadonlyArray<InputMaybe<GQLSignalSubcategoryOptionInput>>
  >;
};

export type GQLSignalSubcategoryOptionInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly name?: InputMaybe<Scalars['String']>;
};

export const GQLSignalType = {
  Aggregation: 'AGGREGATION',
  BenignModel: 'BENIGN_MODEL',
  Custom: 'CUSTOM',
  GeoContainedWithin: 'GEO_CONTAINED_WITHIN',
  GoogleContentSafetyApiImage: 'GOOGLE_CONTENT_SAFETY_API_IMAGE',
  ImageExactMatch: 'IMAGE_EXACT_MATCH',
  ImageSimilarityDoesNotMatch: 'IMAGE_SIMILARITY_DOES_NOT_MATCH',
  ImageSimilarityMatch: 'IMAGE_SIMILARITY_MATCH',
  ImageSimilarityScore: 'IMAGE_SIMILARITY_SCORE',
  OpenAiGraphicViolenceTextModel: 'OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL',
  OpenAiHateTextModel: 'OPEN_AI_HATE_TEXT_MODEL',
  OpenAiHateThreateningTextModel: 'OPEN_AI_HATE_THREATENING_TEXT_MODEL',
  OpenAiSelfHarmTextModel: 'OPEN_AI_SELF_HARM_TEXT_MODEL',
  OpenAiSexualMinorsTextModel: 'OPEN_AI_SEXUAL_MINORS_TEXT_MODEL',
  OpenAiSexualTextModel: 'OPEN_AI_SEXUAL_TEXT_MODEL',
  OpenAiViolenceTextModel: 'OPEN_AI_VIOLENCE_TEXT_MODEL',
  OpenAiWhisperTranscription: 'OPEN_AI_WHISPER_TRANSCRIPTION',
  TextMatchingContainsRegex: 'TEXT_MATCHING_CONTAINS_REGEX',
  TextMatchingContainsText: 'TEXT_MATCHING_CONTAINS_TEXT',
  TextMatchingContainsVariant: 'TEXT_MATCHING_CONTAINS_VARIANT',
  TextMatchingNotContainsRegex: 'TEXT_MATCHING_NOT_CONTAINS_REGEX',
  TextMatchingNotContainsText: 'TEXT_MATCHING_NOT_CONTAINS_TEXT',
  TextSimilarityScore: 'TEXT_SIMILARITY_SCORE',
  UserScore: 'USER_SCORE',
  UserStrikeValue: 'USER_STRIKE_VALUE',
  ZentropiLabeler: 'ZENTROPI_LABELER',
} as const;

export type GQLSignalType = (typeof GQLSignalType)[keyof typeof GQLSignalType];
export type GQLSignalWithScore = {
  readonly __typename?: 'SignalWithScore';
  readonly integration?: Maybe<GQLIntegration>;
  readonly score: Scalars['String'];
  readonly signalName: Scalars['String'];
  readonly subcategory?: Maybe<Scalars['String']>;
};

export type GQLSkippedJob = {
  readonly __typename?: 'SkippedJob';
  readonly jobId: Scalars['String'];
  readonly queueId: Scalars['String'];
  readonly ts: Scalars['DateTime'];
  readonly userId: Scalars['String'];
};

export type GQLSkippedJobCount = {
  readonly __typename?: 'SkippedJobCount';
  readonly count: Scalars['Int'];
  readonly queueId?: Maybe<Scalars['String']>;
  readonly reviewerId?: Maybe<Scalars['String']>;
  readonly time: Scalars['String'];
};

export const GQLSkippedJobCountGroupByColumns = {
  QueueId: 'QUEUE_ID',
  ReviewerId: 'REVIEWER_ID',
} as const;

export type GQLSkippedJobCountGroupByColumns =
  (typeof GQLSkippedJobCountGroupByColumns)[keyof typeof GQLSkippedJobCountGroupByColumns];
export type GQLSkippedJobFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly reviewerIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
};

export const GQLSortOrder = {
  Asc: 'ASC',
  Desc: 'DESC',
} as const;

export type GQLSortOrder = (typeof GQLSortOrder)[keyof typeof GQLSortOrder];
export type GQLSpotTestItemInput = {
  readonly data: Scalars['JSONObject'];
  readonly itemTypeIdentifier: GQLItemTypeIdentifierInput;
};

export type GQLStartAndEndDateFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly startDate: Scalars['DateTime'];
};

export type GQLSubmitAppealDecisionInput = {
  readonly appealId: Scalars['String'];
};

export type GQLSubmitDecisionInput = {
  readonly decisionReason?: InputMaybe<Scalars['String']>;
  readonly jobId: Scalars['ID'];
  readonly lockToken: Scalars['String'];
  readonly queueId: Scalars['ID'];
  readonly relatedItemActions: ReadonlyArray<GQLExecuteBulkActionsInput>;
  readonly reportHistory: ReadonlyArray<GQLReportHistoryEntryInput>;
  readonly reportedItemDecisionComponents: ReadonlyArray<GQLDecisionSubmission>;
};

export type GQLSubmitDecisionResponse =
  | GQLJobHasAlreadyBeenSubmittedError
  | GQLNoJobWithIdInQueueError
  | GQLRecordingJobDecisionFailedError
  | GQLSubmitDecisionSuccessResponse
  | GQLSubmittedJobActionNotFoundError;

export type GQLSubmitDecisionSuccessResponse = {
  readonly __typename?: 'SubmitDecisionSuccessResponse';
  readonly success: Scalars['Boolean'];
};

export type GQLSubmitNcmecReportDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'SubmitNCMECReportDecisionComponent';
    readonly reportedMedia: ReadonlyArray<GQLNcmecReportedMediaDetails>;
    readonly type: GQLManualReviewDecisionType;
  };

export type GQLSubmitNcmecReportInput = {
  readonly incidentType: GQLNcmecIncidentType;
  readonly reportedMedia: ReadonlyArray<GQLNcmecMediaInput>;
  readonly reportedMessages: ReadonlyArray<GQLNcmecThreadInput>;
};

export type GQLSubmittedJobActionNotFoundError = GQLError & {
  readonly __typename?: 'SubmittedJobActionNotFoundError';
  readonly detail?: Maybe<Scalars['String']>;
  readonly pointer?: Maybe<Scalars['String']>;
  readonly requestId?: Maybe<Scalars['String']>;
  readonly status: Scalars['Int'];
  readonly title: Scalars['String'];
  readonly type: ReadonlyArray<Scalars['String']>;
};

export type GQLSupportedLanguages = GQLAllLanguages | GQLLanguages;

export type GQLTableDecisionCount = {
  readonly __typename?: 'TableDecisionCount';
  readonly action_id?: Maybe<Scalars['String']>;
  readonly count: Scalars['Int'];
  readonly queue_id?: Maybe<Scalars['String']>;
  readonly reviewer_id?: Maybe<Scalars['String']>;
  readonly type: GQLManualReviewDecisionType;
};

export type GQLTextBank = {
  readonly __typename?: 'TextBank';
  readonly description?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly strings: ReadonlyArray<Scalars['String']>;
  readonly type: GQLTextBankType;
};

export const GQLTextBankType = {
  Regex: 'REGEX',
  String: 'STRING',
} as const;

export type GQLTextBankType =
  (typeof GQLTextBankType)[keyof typeof GQLTextBankType];
export type GQLThreadAppealManualReviewJobPayload = {
  readonly __typename?: 'ThreadAppealManualReviewJobPayload';
  readonly actionsTaken: ReadonlyArray<Scalars['String']>;
  readonly appealId: Scalars['String'];
  readonly appealReason?: Maybe<Scalars['String']>;
  readonly appealerIdentifier?: Maybe<GQLItemIdentifier>;
  readonly enqueueSourceInfo?: Maybe<GQLAppealEnqueueSourceInfo>;
  readonly item: GQLThreadItem;
};

export type GQLThreadItem = GQLItemBase & {
  readonly __typename?: 'ThreadItem';
  readonly data: Scalars['JSONObject'];
  readonly id: Scalars['ID'];
  readonly submissionId: Scalars['ID'];
  readonly submissionTime?: Maybe<Scalars['DateTime']>;
  readonly type: GQLThreadItemType;
};

export type GQLThreadItemType = GQLItemTypeBase & {
  readonly __typename?: 'ThreadItemType';
  readonly baseFields: ReadonlyArray<GQLBaseField>;
  readonly derivedFields: ReadonlyArray<GQLDerivedField>;
  readonly description?: Maybe<Scalars['String']>;
  readonly hiddenFields: ReadonlyArray<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly schemaFieldRoles: GQLThreadSchemaFieldRoles;
  readonly schemaVariant: GQLItemTypeSchemaVariant;
  readonly version: Scalars['String'];
};

export type GQLThreadManualReviewJobPayload = {
  readonly __typename?: 'ThreadManualReviewJobPayload';
  readonly enqueueSourceInfo?: Maybe<GQLManualReviewJobEnqueueSourceInfo>;
  readonly item: GQLThreadItem;
  readonly reportHistory: ReadonlyArray<GQLReportHistoryEntry>;
  readonly reportedForReason?: Maybe<Scalars['String']>;
  readonly reportedForReasons: ReadonlyArray<GQLReportedForReason>;
  readonly threadItems: ReadonlyArray<GQLItemWithParents>;
};

export type GQLThreadSchemaFieldRoles = {
  readonly __typename?: 'ThreadSchemaFieldRoles';
  readonly createdAt?: Maybe<Scalars['String']>;
  readonly creatorId?: Maybe<Scalars['String']>;
  readonly displayName?: Maybe<Scalars['String']>;
  readonly isDeleted?: Maybe<Scalars['String']>;
};

export type GQLThreadSchemaFieldRolesInput = {
  readonly createdAt?: InputMaybe<Scalars['String']>;
  readonly creatorId?: InputMaybe<Scalars['String']>;
  readonly displayName?: InputMaybe<Scalars['String']>;
  readonly isDeleted?: InputMaybe<Scalars['String']>;
};

export type GQLThreadWithMessages = {
  readonly __typename?: 'ThreadWithMessages';
  readonly messages: ReadonlyArray<GQLItemSubmissions>;
  readonly threadId: Scalars['ID'];
  readonly threadTypeId: Scalars['ID'];
};

export type GQLThreadWithMessagesAndIpAddress = {
  readonly __typename?: 'ThreadWithMessagesAndIpAddress';
  readonly messages: ReadonlyArray<GQLMessageWithIpAddress>;
  readonly threadId: Scalars['ID'];
  readonly threadTypeId: Scalars['ID'];
};

export type GQLTimeToAction = {
  readonly __typename?: 'TimeToAction';
  readonly itemTypeId?: Maybe<Scalars['String']>;
  readonly queueId?: Maybe<Scalars['String']>;
  readonly timeToAction?: Maybe<Scalars['Int']>;
};

export type GQLTimeToActionFilterByInput = {
  readonly endDate: Scalars['DateTime'];
  readonly itemTypeIds: ReadonlyArray<Scalars['String']>;
  readonly queueIds: ReadonlyArray<Scalars['String']>;
  readonly startDate: Scalars['DateTime'];
};

export const GQLTimeToActionGroupByColumns = {
  ItemTypeId: 'ITEM_TYPE_ID',
  QueueId: 'QUEUE_ID',
  ReviewerId: 'REVIEWER_ID',
} as const;

export type GQLTimeToActionGroupByColumns =
  (typeof GQLTimeToActionGroupByColumns)[keyof typeof GQLTimeToActionGroupByColumns];
export type GQLTimeToActionInput = {
  readonly filterBy: GQLTimeToActionFilterByInput;
  readonly groupBy: ReadonlyArray<GQLTimeToActionGroupByColumns>;
};

export type GQLTopPolicyViolationsInput = {
  readonly filterBy: GQLStartAndEndDateFilterByInput;
  readonly timeZone: Scalars['String'];
};

export type GQLTransformJobAndRecreateInQueue = {
  readonly newJobKind: GQLManualReviewJobKind;
  readonly newQueueId?: InputMaybe<Scalars['String']>;
  readonly originalQueueId?: InputMaybe<Scalars['String']>;
  readonly policyIds: ReadonlyArray<Scalars['String']>;
};

export type GQLTransformJobAndRecreateInQueueDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'TransformJobAndRecreateInQueueDecisionComponent';
    readonly newJobKind: GQLManualReviewJobKind;
    readonly newQueueId?: Maybe<Scalars['String']>;
    readonly originalQueueId?: Maybe<Scalars['String']>;
    readonly policyIds?: Maybe<ReadonlyArray<Scalars['String']>>;
    readonly type: GQLManualReviewDecisionType;
  };

export type GQLUpdateActionInput = {
  readonly applyUserStrikes?: InputMaybe<Scalars['Boolean']>;
  readonly callbackUrl?: InputMaybe<Scalars['String']>;
  readonly callbackUrlBody?: InputMaybe<Scalars['JSONObject']>;
  readonly callbackUrlHeaders?: InputMaybe<Scalars['JSONObject']>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypeIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateContentItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles?: InputMaybe<GQLContentSchemaFieldRolesInput>;
  readonly fields?: InputMaybe<ReadonlyArray<GQLFieldInput>>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateContentRuleInput = {
  readonly actionIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly cancelRunningBacktests?: InputMaybe<Scalars['Boolean']>;
  readonly conditionSet?: InputMaybe<GQLConditionSetInput>;
  readonly contentTypeIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly expirationTime?: InputMaybe<Scalars['DateTime']>;
  readonly id: Scalars['ID'];
  readonly maxDailyActions?: InputMaybe<Scalars['Float']>;
  readonly name?: InputMaybe<Scalars['String']>;
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly policyIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly status?: InputMaybe<GQLRuleStatus>;
  readonly tags?: InputMaybe<ReadonlyArray<Scalars['String']>>;
};

export type GQLUpdateContentRuleResponse =
  | GQLMutateContentRuleSuccessResponse
  | GQLNotFoundError
  | GQLRuleHasRunningBacktestsError
  | GQLRuleNameExistsError;

export type GQLUpdateHashBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly enabled_ratio?: InputMaybe<Scalars['Float']>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateLocationBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly locationsToAdd?: InputMaybe<ReadonlyArray<GQLLocationAreaInput>>;
  readonly locationsToDelete?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateManualReviewQueueInput = {
  readonly actionIdsToHide: ReadonlyArray<Scalars['ID']>;
  readonly actionIdsToUnhide: ReadonlyArray<Scalars['ID']>;
  readonly autoCloseJobs: Scalars['Boolean'];
  readonly description?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
  readonly userIds: ReadonlyArray<Scalars['ID']>;
};

export type GQLUpdateManualReviewQueueQueueResponse =
  | GQLManualReviewQueueNameExistsError
  | GQLMutateManualReviewQueueSuccessResponse
  | GQLNotFoundError;

export type GQLUpdateNcmecOrgSettingsResponse = {
  readonly __typename?: 'UpdateNcmecOrgSettingsResponse';
  readonly success: Scalars['Boolean'];
};

export type GQLUpdateOrgInfoInput = {
  readonly email?: InputMaybe<Scalars['String']>;
  readonly name?: InputMaybe<Scalars['String']>;
  readonly onCallAlertEmail?: InputMaybe<Scalars['String']>;
  readonly websiteUrl?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateOrgInfoSuccessResponse = {
  readonly __typename?: 'UpdateOrgInfoSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLUpdatePolicyInput = {
  readonly applyUserStrikeCountConfigToChildren?: InputMaybe<
    Scalars['Boolean']
  >;
  readonly enforcementGuidelines?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name: Scalars['String'];
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly policyText?: InputMaybe<Scalars['String']>;
  readonly policyType?: InputMaybe<GQLPolicyType>;
  readonly userStrikeCount?: InputMaybe<Scalars['Int']>;
};

export type GQLUpdatePolicyResponse = GQLNotFoundError | GQLPolicy;

export type GQLUpdateReportingRuleInput = {
  readonly actionIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly conditionSet?: InputMaybe<GQLConditionSetInput>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly itemTypeIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly name?: InputMaybe<Scalars['String']>;
  readonly policyIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly status?: InputMaybe<GQLReportingRuleStatus>;
};

export type GQLUpdateReportingRuleResponse =
  | GQLMutateReportingRuleSuccessResponse
  | GQLNotFoundError
  | GQLReportingRuleNameExistsError;

export type GQLUpdateRoleInput = {
  readonly id: Scalars['ID'];
  readonly role: GQLUserRole;
};

export type GQLUpdateRoutingRuleInput = {
  readonly conditionSet?: InputMaybe<GQLConditionSetInput>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly destinationQueueId?: InputMaybe<Scalars['ID']>;
  readonly id: Scalars['ID'];
  readonly isAppealsRule?: InputMaybe<Scalars['Boolean']>;
  readonly itemTypeIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly name?: InputMaybe<Scalars['String']>;
  readonly sequenceNumber?: InputMaybe<Scalars['Int']>;
  readonly status?: InputMaybe<GQLRoutingRuleStatus>;
};

export type GQLUpdateRoutingRuleResponse =
  | GQLMutateRoutingRuleSuccessResponse
  | GQLNotFoundError
  | GQLQueueDoesNotExistError
  | GQLRoutingRuleNameExistsError;

export type GQLUpdateSsoCredentialsInput = {
  readonly ssoCert: Scalars['String'];
  readonly ssoUrl: Scalars['String'];
};

export type GQLUpdateTextBankInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
  readonly strings?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly type?: InputMaybe<GQLTextBankType>;
};

export type GQLUpdateThreadItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles?: InputMaybe<GQLThreadSchemaFieldRolesInput>;
  readonly fields?: InputMaybe<ReadonlyArray<GQLFieldInput>>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateUserItemTypeInput = {
  readonly description?: InputMaybe<Scalars['String']>;
  readonly fieldRoles?: InputMaybe<GQLUserSchemaFieldRolesInput>;
  readonly fields?: InputMaybe<ReadonlyArray<GQLFieldInput>>;
  readonly hiddenFields?: InputMaybe<ReadonlyArray<Scalars['String']>>;
  readonly id: Scalars['ID'];
  readonly name?: InputMaybe<Scalars['String']>;
};

export type GQLUpdateUserRuleInput = {
  readonly actionIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly cancelRunningBacktests?: InputMaybe<Scalars['Boolean']>;
  readonly conditionSet?: InputMaybe<GQLConditionSetInput>;
  readonly description?: InputMaybe<Scalars['String']>;
  readonly expirationTime?: InputMaybe<Scalars['DateTime']>;
  readonly id: Scalars['ID'];
  readonly maxDailyActions?: InputMaybe<Scalars['Float']>;
  readonly name?: InputMaybe<Scalars['String']>;
  readonly parentId?: InputMaybe<Scalars['ID']>;
  readonly policyIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
  readonly status?: InputMaybe<GQLRuleStatus>;
  readonly tags?: InputMaybe<ReadonlyArray<Scalars['String']>>;
};

export type GQLUpdateUserRuleResponse =
  | GQLMutateUserRuleSuccessResponse
  | GQLNotFoundError
  | GQLRuleHasRunningBacktestsError
  | GQLRuleNameExistsError;

export type GQLUpdateUserStrikeTtlInput = {
  readonly ttlDays: Scalars['Int'];
};

export type GQLUpdateUserStrikeTtlSuccessResponse = {
  readonly __typename?: 'UpdateUserStrikeTTLSuccessResponse';
  readonly _?: Maybe<Scalars['Boolean']>;
};

export type GQLUser = {
  readonly __typename?: 'User';
  readonly approvedByAdmin?: Maybe<Scalars['Boolean']>;
  readonly createdAt: Scalars['String'];
  readonly email: Scalars['String'];
  readonly favoriteMRTQueues: ReadonlyArray<GQLManualReviewQueue>;
  readonly favoriteRules: ReadonlyArray<GQLRule>;
  readonly firstName: Scalars['String'];
  readonly id: Scalars['ID'];
  readonly interfacePreferences: GQLUserInterfacePreferences;
  readonly lastName: Scalars['String'];
  readonly loginMethods: ReadonlyArray<Scalars['String']>;
  readonly notifications: GQLUserNotifications;
  readonly orgId: Scalars['ID'];
  readonly permissions: ReadonlyArray<GQLUserPermission>;
  readonly readMeJWT?: Maybe<Scalars['String']>;
  readonly rejectedByAdmin?: Maybe<Scalars['Boolean']>;
  readonly reviewableQueues: ReadonlyArray<GQLManualReviewQueue>;
  readonly role?: Maybe<GQLUserRole>;
};

export type GQLUserReviewableQueuesArgs = {
  queueIds?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
};

export type GQLUserActionDecisionAction = {
  readonly id: Scalars['ID'];
};

export type GQLUserActionDecisionPolicy = {
  readonly id: Scalars['ID'];
};

export type GQLUserActionsHistory = {
  readonly __typename?: 'UserActionsHistory';
  readonly countsByPolicy: ReadonlyArray<GQLPolicyActionCount>;
};

export type GQLUserAppealManualReviewJobPayload = {
  readonly __typename?: 'UserAppealManualReviewJobPayload';
  readonly actionsTaken: ReadonlyArray<Scalars['String']>;
  readonly additionalContentItems: ReadonlyArray<GQLContentItem>;
  readonly appealId: Scalars['String'];
  readonly appealReason?: Maybe<Scalars['String']>;
  readonly appealerIdentifier?: Maybe<GQLItemIdentifier>;
  readonly enqueueSourceInfo?: Maybe<GQLAppealEnqueueSourceInfo>;
  readonly item: GQLUserItem;
  readonly reportedItems?: Maybe<ReadonlyArray<Maybe<GQLItemIdentifier>>>;
  readonly userScore?: Maybe<Scalars['Int']>;
};

export type GQLUserHistory = {
  readonly __typename?: 'UserHistory';
  readonly actions: GQLUserActionsHistory;
  readonly executions: ReadonlyArray<GQLRuleExecutionResult>;
  readonly id: Scalars['ID'];
  readonly submissions: GQLUserSubmissionsHistory;
  readonly user?: Maybe<GQLUserItem>;
};

export type GQLUserHistoryResponse = GQLNotFoundError | GQLUserHistory;

export type GQLUserInterfacePreferences = {
  readonly __typename?: 'UserInterfacePreferences';
  readonly moderatorSafetyBlurLevel: Scalars['Int'];
  readonly moderatorSafetyGrayscale: Scalars['Boolean'];
  readonly moderatorSafetyMuteVideo: Scalars['Boolean'];
  readonly moderatorSafetySepia: Scalars['Boolean'];
  readonly mrtChartConfigurations: ReadonlyArray<GQLManualReviewChartSettings>;
};

export type GQLUserItem = GQLItemBase & {
  readonly __typename?: 'UserItem';
  readonly data: Scalars['JSONObject'];
  readonly id: Scalars['ID'];
  readonly submissionId: Scalars['ID'];
  readonly submissionTime?: Maybe<Scalars['DateTime']>;
  readonly type: GQLUserItemType;
  readonly userScore: Scalars['Int'];
};

export type GQLUserItemType = GQLItemTypeBase & {
  readonly __typename?: 'UserItemType';
  readonly baseFields: ReadonlyArray<GQLBaseField>;
  readonly derivedFields: ReadonlyArray<GQLDerivedField>;
  readonly description?: Maybe<Scalars['String']>;
  readonly hiddenFields: ReadonlyArray<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly isDefaultUserType: Scalars['Boolean'];
  readonly name: Scalars['String'];
  readonly schemaFieldRoles: GQLUserSchemaFieldRoles;
  readonly schemaVariant: GQLItemTypeSchemaVariant;
  readonly version: Scalars['String'];
};

export type GQLUserManualReviewJobPayload = {
  readonly __typename?: 'UserManualReviewJobPayload';
  readonly additionalContentItems: ReadonlyArray<GQLContentItem>;
  readonly enqueueSourceInfo?: Maybe<GQLManualReviewJobEnqueueSourceInfo>;
  readonly item: GQLUserItem;
  readonly itemThreadContentItems?: Maybe<ReadonlyArray<GQLContentItem>>;
  readonly reportHistory: ReadonlyArray<GQLReportHistoryEntry>;
  readonly reportedForReasons: ReadonlyArray<GQLReportedForReason>;
  readonly reportedItems?: Maybe<ReadonlyArray<Maybe<GQLItemIdentifier>>>;
  readonly userScore?: Maybe<Scalars['Int']>;
  readonly userSubmittedItems: ReadonlyArray<GQLItemSubmissions>;
};

export type GQLUserNotificationEdge = {
  readonly __typename?: 'UserNotificationEdge';
  readonly node: GQLNotification;
};

export type GQLUserNotifications = {
  readonly __typename?: 'UserNotifications';
  readonly edges: ReadonlyArray<GQLUserNotificationEdge>;
};

export type GQLUserOrRelatedActionDecisionComponent =
  GQLManualReviewDecisionComponentBase & {
    readonly __typename?: 'UserOrRelatedActionDecisionComponent';
    readonly actionIds: ReadonlyArray<Scalars['String']>;
    readonly customMrtApiParams?: Maybe<Scalars['JSONObject']>;
    readonly itemIds: ReadonlyArray<Scalars['String']>;
    readonly itemTypeId: Scalars['String'];
    readonly policyIds: ReadonlyArray<Scalars['String']>;
    readonly type: GQLManualReviewDecisionType;
  };

export const GQLUserPenaltySeverity = {
  High: 'HIGH',
  Low: 'LOW',
  Medium: 'MEDIUM',
  None: 'NONE',
  Severe: 'SEVERE',
} as const;

export type GQLUserPenaltySeverity =
  (typeof GQLUserPenaltySeverity)[keyof typeof GQLUserPenaltySeverity];
export const GQLUserPermission = {
  EditMrtQueues: 'EDIT_MRT_QUEUES',
  ManageOrg: 'MANAGE_ORG',
  ManagePolicies: 'MANAGE_POLICIES',
  ManuallyActionContent: 'MANUALLY_ACTION_CONTENT',
  MutateLiveRules: 'MUTATE_LIVE_RULES',
  MutateNonLiveRules: 'MUTATE_NON_LIVE_RULES',
  RunBacktest: 'RUN_BACKTEST',
  RunRetroaction: 'RUN_RETROACTION',
  ViewChildSafetyData: 'VIEW_CHILD_SAFETY_DATA',
  ViewInsights: 'VIEW_INSIGHTS',
  ViewInvestigation: 'VIEW_INVESTIGATION',
  ViewMrt: 'VIEW_MRT',
  ViewMrtData: 'VIEW_MRT_DATA',
  ViewRulesDashboard: 'VIEW_RULES_DASHBOARD',
} as const;

export type GQLUserPermission =
  (typeof GQLUserPermission)[keyof typeof GQLUserPermission];
export const GQLUserRole = {
  Admin: 'ADMIN',
  Analyst: 'ANALYST',
  ChildSafetyModerator: 'CHILD_SAFETY_MODERATOR',
  ExternalModerator: 'EXTERNAL_MODERATOR',
  Moderator: 'MODERATOR',
  ModeratorManager: 'MODERATOR_MANAGER',
  RulesManager: 'RULES_MANAGER',
} as const;

export type GQLUserRole = (typeof GQLUserRole)[keyof typeof GQLUserRole];
export type GQLUserRule = GQLRule & {
  readonly __typename?: 'UserRule';
  readonly actions: ReadonlyArray<GQLAction>;
  readonly backtests: ReadonlyArray<GQLBacktest>;
  readonly conditionSet: GQLConditionSet;
  readonly createdAt: Scalars['String'];
  readonly creator: GQLUser;
  readonly description?: Maybe<Scalars['String']>;
  readonly expirationTime?: Maybe<Scalars['String']>;
  readonly id: Scalars['ID'];
  readonly insights: GQLRuleInsights;
  readonly maxDailyActions?: Maybe<Scalars['Float']>;
  readonly name: Scalars['String'];
  readonly parentId?: Maybe<Scalars['ID']>;
  readonly policies: ReadonlyArray<GQLPolicy>;
  readonly status: GQLRuleStatus;
  readonly tags?: Maybe<ReadonlyArray<Maybe<Scalars['String']>>>;
  readonly updatedAt: Scalars['String'];
};

export type GQLUserRuleBacktestsArgs = {
  ids?: InputMaybe<ReadonlyArray<Scalars['ID']>>;
};

export type GQLUserSchemaFieldRoles = {
  readonly __typename?: 'UserSchemaFieldRoles';
  readonly backgroundImage?: Maybe<Scalars['String']>;
  readonly createdAt?: Maybe<Scalars['String']>;
  readonly displayName?: Maybe<Scalars['String']>;
  readonly isDeleted?: Maybe<Scalars['String']>;
  readonly profileIcon?: Maybe<Scalars['String']>;
};

export type GQLUserSchemaFieldRolesInput = {
  readonly backgroundImage?: InputMaybe<Scalars['String']>;
  readonly createdAt?: InputMaybe<Scalars['String']>;
  readonly displayName?: InputMaybe<Scalars['String']>;
  readonly isDeleted?: InputMaybe<Scalars['String']>;
  readonly profileIcon?: InputMaybe<Scalars['String']>;
};

export type GQLUserStrikeBucket = {
  readonly __typename?: 'UserStrikeBucket';
  readonly numStrikes: Scalars['Int'];
  readonly numUsers: Scalars['Int'];
};

export type GQLUserStrikeThreshold = {
  readonly __typename?: 'UserStrikeThreshold';
  readonly actions: ReadonlyArray<Scalars['ID']>;
  readonly id: Scalars['String'];
  readonly threshold: Scalars['Int'];
};

export type GQLUserSubmissionCount = {
  readonly __typename?: 'UserSubmissionCount';
  readonly count: Scalars['Int'];
  readonly itemTypeId: Scalars['String'];
};

export type GQLUserSubmissionsHistory = {
  readonly __typename?: 'UserSubmissionsHistory';
  readonly countsByItemType: ReadonlyArray<GQLUserSubmissionCount>;
};

export const GQLValueComparator = {
  Equals: 'EQUALS',
  GreaterThan: 'GREATER_THAN',
  GreaterThanOrEquals: 'GREATER_THAN_OR_EQUALS',
  IsNotProvided: 'IS_NOT_PROVIDED',
  IsUnavailable: 'IS_UNAVAILABLE',
  LessThan: 'LESS_THAN',
  LessThanOrEquals: 'LESS_THAN_OR_EQUALS',
  NotEqualTo: 'NOT_EQUAL_TO',
} as const;

export type GQLValueComparator =
  (typeof GQLValueComparator)[keyof typeof GQLValueComparator];
export type GQLWindowConfiguration = {
  readonly __typename?: 'WindowConfiguration';
  readonly hopMs: Scalars['Int'];
  readonly sizeMs: Scalars['Int'];
};

export type GQLWindowConfigurationInput = {
  readonly hopMs: Scalars['Int'];
  readonly sizeMs: Scalars['Int'];
};

export type GQLZentropiIntegrationApiCredential = {
  readonly __typename?: 'ZentropiIntegrationApiCredential';
  readonly apiKey: Scalars['String'];
  readonly labelerVersions: ReadonlyArray<GQLZentropiLabelerVersion>;
};

export type GQLZentropiIntegrationApiCredentialInput = {
  readonly apiKey: Scalars['String'];
  readonly labelerVersions?: InputMaybe<
    ReadonlyArray<GQLZentropiLabelerVersionInput>
  >;
};

export type GQLZentropiLabelerVersion = {
  readonly __typename?: 'ZentropiLabelerVersion';
  readonly id: Scalars['String'];
  readonly label: Scalars['String'];
};

export type GQLZentropiLabelerVersionInput = {
  readonly id: Scalars['String'];
  readonly label: Scalars['String'];
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = {},
  TContext = {},
  TArgs = {},
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = {},
  TParent = {},
  TContext = {},
  TArgs = {},
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type GQLResolversTypes = {
  AcceptAppealDecisionComponent: ResolverTypeWrapper<GQLAcceptAppealDecisionComponent>;
  Action:
    | GQLResolversTypes['CustomAction']
    | GQLResolversTypes['EnqueueAuthorToMrtAction']
    | GQLResolversTypes['EnqueueToMrtAction']
    | GQLResolversTypes['EnqueueToNcmecAction'];
  ActionBase:
    | GQLResolversTypes['CustomAction']
    | GQLResolversTypes['EnqueueAuthorToMrtAction']
    | GQLResolversTypes['EnqueueToMrtAction']
    | GQLResolversTypes['EnqueueToNcmecAction'];
  ActionData: ResolverTypeWrapper<GQLActionData>;
  ActionNameExistsError: ResolverTypeWrapper<GQLActionNameExistsError>;
  ActionSource: GQLActionSource;
  ActionStatisticsFilters: GQLActionStatisticsFilters;
  ActionStatisticsGroupByColumns: GQLActionStatisticsGroupByColumns;
  ActionStatisticsInput: GQLActionStatisticsInput;
  AddAccessibleQueuesToUserInput: GQLAddAccessibleQueuesToUserInput;
  AddAccessibleQueuesToUserResponse: GQLResolversTypes['MutateAccessibleQueuesForUserSuccessResponse'];
  AddCommentFailedError: ResolverTypeWrapper<GQLAddCommentFailedError>;
  AddFavoriteMRTQueueSuccessResponse: ResolverTypeWrapper<GQLAddFavoriteMrtQueueSuccessResponse>;
  AddFavoriteRuleResponse: GQLResolversTypes['AddFavoriteRuleSuccessResponse'];
  AddFavoriteRuleSuccessResponse: ResolverTypeWrapper<GQLAddFavoriteRuleSuccessResponse>;
  AddManualReviewJobCommentResponse:
    | GQLResolversTypes['AddManualReviewJobCommentSuccessResponse']
    | GQLResolversTypes['NotFoundError'];
  AddManualReviewJobCommentSuccessResponse: ResolverTypeWrapper<
    Omit<GQLAddManualReviewJobCommentSuccessResponse, 'comment'> & {
      comment: GQLResolversTypes['ManualReviewJobComment'];
    }
  >;
  AddPoliciesResponse: ResolverTypeWrapper<GQLAddPoliciesResponse>;
  AddPolicyInput: GQLAddPolicyInput;
  Aggregation: ResolverTypeWrapper<GQLAggregation>;
  AggregationClause: ResolverTypeWrapper<
    Omit<GQLAggregationClause, 'conditionSet' | 'groupBy'> & {
      conditionSet?: Maybe<GQLResolversTypes['ConditionSet']>;
      groupBy: ReadonlyArray<GQLResolversTypes['ConditionInputField']>;
    }
  >;
  AggregationClauseInput: GQLAggregationClauseInput;
  AggregationInput: GQLAggregationInput;
  AggregationSignalArgs: ResolverTypeWrapper<
    Omit<GQLAggregationSignalArgs, 'aggregationClause'> & {
      aggregationClause?: Maybe<GQLResolversTypes['AggregationClause']>;
    }
  >;
  AggregationSignalArgsInput: GQLAggregationSignalArgsInput;
  AggregationType: GQLAggregationType;
  AllLanguages: ResolverTypeWrapper<GQLAllLanguages>;
  AllRuleInsights: ResolverTypeWrapper<GQLAllRuleInsights>;
  ApiKey: ResolverTypeWrapper<GQLApiKey>;
  AppealDecision: GQLAppealDecision;
  AppealEnqueueSourceInfo: ResolverTypeWrapper<GQLAppealEnqueueSourceInfo>;
  AppealSettings: ResolverTypeWrapper<GQLAppealSettings>;
  AppealSettingsInput: GQLAppealSettingsInput;
  AutomaticCloseDecisionComponent: ResolverTypeWrapper<GQLAutomaticCloseDecisionComponent>;
  Backtest: ResolverTypeWrapper<Backtest>;
  BacktestStatus: GQLBacktestStatus;
  BaseField: ResolverTypeWrapper<GQLBaseField>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  CannotDeleteDefaultUserError: ResolverTypeWrapper<GQLCannotDeleteDefaultUserError>;
  ChangePasswordError: ResolverTypeWrapper<GQLChangePasswordError>;
  ChangePasswordInput: GQLChangePasswordInput;
  ChangePasswordResponse:
    | GQLResolversTypes['ChangePasswordError']
    | GQLResolversTypes['ChangePasswordSuccessResponse'];
  ChangePasswordSuccessResponse: ResolverTypeWrapper<GQLChangePasswordSuccessResponse>;
  Condition: ResolverTypeWrapper<Condition>;
  ConditionConjunction: GQLConditionConjunction;
  ConditionInput: GQLConditionInput;
  ConditionInputField: ResolverTypeWrapper<
    Omit<GQLConditionInputField, 'spec'> & {
      spec?: Maybe<GQLResolversTypes['DerivedFieldSpec']>;
    }
  >;
  ConditionInputFieldInput: GQLConditionInputFieldInput;
  ConditionInputInputType: GQLConditionInputInputType;
  ConditionInputSignalInput: GQLConditionInputSignalInput;
  ConditionMatchingValuesInput: GQLConditionMatchingValuesInput;
  ConditionOutcome: GQLConditionOutcome;
  ConditionResult: ResolverTypeWrapper<GQLConditionResult>;
  ConditionSet: ResolverTypeWrapper<ConditionSet>;
  ConditionSetInput: GQLConditionSetInput;
  ConditionSetWithResult: ResolverTypeWrapper<ConditionSetWithResult>;
  ConditionWithResult: ResolverTypeWrapper<ConditionWithResult>;
  Container: ResolverTypeWrapper<GQLContainer>;
  ContainerInput: GQLContainerInput;
  ContainerType: GQLContainerType;
  ContentAppealManualReviewJobPayload: ResolverTypeWrapper<ContentAppealReviewJobPayload>;
  ContentItem: ResolverTypeWrapper<
    Omit<GQLContentItem, 'type'> & {
      type: GQLResolversTypes['ContentItemType'];
    }
  >;
  ContentItemType: ResolverTypeWrapper<ContentItemTypeResolversParentType>;
  ContentManualReviewJobPayload: ResolverTypeWrapper<ContentManualReviewJobPayload>;
  ContentRule: ResolverTypeWrapper<Rule>;
  ContentSchemaFieldRoles: ResolverTypeWrapper<GQLContentSchemaFieldRoles>;
  ContentSchemaFieldRolesInput: GQLContentSchemaFieldRolesInput;
  ContentType: ResolverTypeWrapper<ItemType>;
  CoopActionDecisionInput: GQLCoopActionDecisionInput;
  CoopInput: GQLCoopInput;
  CoopInputOrString: ResolverTypeWrapper<Scalars['CoopInputOrString']>;
  CountByActionByDay: ResolverTypeWrapper<GQLCountByActionByDay>;
  CountByActionByDayAction: ResolverTypeWrapper<GQLCountByActionByDayAction>;
  CountByDay: ResolverTypeWrapper<GQLCountByDay>;
  CountByDecisionTypeByDay: ResolverTypeWrapper<GQLCountByDecisionTypeByDay>;
  CountByPolicyByDay: ResolverTypeWrapper<GQLCountByPolicyByDay>;
  CountByPolicyByDayPolicy: ResolverTypeWrapper<GQLCountByPolicyByDayPolicy>;
  CountByTagByDay: ResolverTypeWrapper<GQLCountByTagByDay>;
  CreateActionInput: GQLCreateActionInput;
  CreateBacktestInput: GQLCreateBacktestInput;
  CreateBacktestResponse: ResolverTypeWrapper<
    Omit<GQLCreateBacktestResponse, 'backtest'> & {
      backtest: GQLResolversTypes['Backtest'];
    }
  >;
  CreateContentItemTypeInput: GQLCreateContentItemTypeInput;
  CreateContentRuleInput: GQLCreateContentRuleInput;
  CreateContentRuleResponse:
    | GQLResolversTypes['MutateContentRuleSuccessResponse']
    | GQLResolversTypes['RuleNameExistsError'];
  CreateHashBankInput: GQLCreateHashBankInput;
  CreateLocationBankInput: GQLCreateLocationBankInput;
  CreateManualReviewJobCommentInput: GQLCreateManualReviewJobCommentInput;
  CreateManualReviewQueueInput: GQLCreateManualReviewQueueInput;
  CreateManualReviewQueueResponse:
    | GQLResolversTypes['ManualReviewQueueNameExistsError']
    | GQLResolversTypes['MutateManualReviewQueueSuccessResponse'];
  CreateOrgInput: GQLCreateOrgInput;
  CreateOrgResponse:
    | GQLResolversTypes['CreateOrgSuccessResponse']
    | GQLResolversTypes['OrgWithEmailExistsError']
    | GQLResolversTypes['OrgWithNameExistsError'];
  CreateOrgSuccessResponse: ResolverTypeWrapper<GQLCreateOrgSuccessResponse>;
  CreateReportingRuleInput: GQLCreateReportingRuleInput;
  CreateReportingRuleResponse:
    | GQLResolversTypes['MutateReportingRuleSuccessResponse']
    | GQLResolversTypes['ReportingRuleNameExistsError'];
  CreateRoutingRuleInput: GQLCreateRoutingRuleInput;
  CreateRoutingRuleResponse:
    | GQLResolversTypes['MutateRoutingRuleSuccessResponse']
    | GQLResolversTypes['QueueDoesNotExistError']
    | GQLResolversTypes['RoutingRuleNameExistsError'];
  CreateTextBankInput: GQLCreateTextBankInput;
  CreateThreadItemTypeInput: GQLCreateThreadItemTypeInput;
  CreateUserItemTypeInput: GQLCreateUserItemTypeInput;
  CreateUserRuleInput: GQLCreateUserRuleInput;
  CreateUserRuleResponse:
    | GQLResolversTypes['MutateUserRuleSuccessResponse']
    | GQLResolversTypes['RuleNameExistsError'];
  Cursor: ResolverTypeWrapper<Scalars['Cursor']>;
  CustomAction: ResolverTypeWrapper<CustomAction>;
  CustomMrtApiParamSpec: ResolverTypeWrapper<GQLCustomMrtApiParamSpec>;
  Date: ResolverTypeWrapper<Scalars['Date']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  DecisionActionType: GQLDecisionActionType;
  DecisionCount: ResolverTypeWrapper<GQLDecisionCount>;
  DecisionCountFilterBy: ResolverTypeWrapper<GQLDecisionCountFilterBy>;
  DecisionCountFilterByInput: GQLDecisionCountFilterByInput;
  DecisionCountGroupByColumns: GQLDecisionCountGroupByColumns;
  DecisionCountSettingsInput: GQLDecisionCountSettingsInput;
  DecisionCountTableFilterByInput: GQLDecisionCountTableFilterByInput;
  DecisionSubmission: GQLDecisionSubmission;
  DecisionsCountGroupBy: GQLDecisionsCountGroupBy;
  DeleteAllJobsFromQueueResponse:
    | GQLResolversTypes['DeleteAllJobsFromQueueSuccessResponse']
    | GQLResolversTypes['DeleteAllJobsUnauthorizedError'];
  DeleteAllJobsFromQueueSuccessResponse: ResolverTypeWrapper<GQLDeleteAllJobsFromQueueSuccessResponse>;
  DeleteAllJobsUnauthorizedError: ResolverTypeWrapper<GQLDeleteAllJobsUnauthorizedError>;
  DeleteItemTypeResponse:
    | GQLResolversTypes['CannotDeleteDefaultUserError']
    | GQLResolversTypes['DeleteItemTypeSuccessResponse'];
  DeleteItemTypeSuccessResponse: ResolverTypeWrapper<GQLDeleteItemTypeSuccessResponse>;
  DeleteManualReviewJobCommentInput: GQLDeleteManualReviewJobCommentInput;
  DeleteRoutingRuleInput: GQLDeleteRoutingRuleInput;
  DequeueManualReviewJobResponse: GQLResolversTypes['DequeueManualReviewJobSuccessResponse'];
  DequeueManualReviewJobSuccessResponse: ResolverTypeWrapper<
    Omit<GQLDequeueManualReviewJobSuccessResponse, 'job'> & {
      job: GQLResolversTypes['ManualReviewJob'];
    }
  >;
  DerivedField: ResolverTypeWrapper<
    Omit<GQLDerivedField, 'spec'> & {
      spec: GQLResolversTypes['DerivedFieldSpec'];
    }
  >;
  DerivedFieldCoopInputSource: ResolverTypeWrapper<GQLDerivedFieldCoopInputSource>;
  DerivedFieldCoopInputSourceInput: GQLDerivedFieldCoopInputSourceInput;
  DerivedFieldDerivationType: GQLDerivedFieldDerivationType;
  DerivedFieldFieldSource: ResolverTypeWrapper<GQLDerivedFieldFieldSource>;
  DerivedFieldFieldSourceInput: GQLDerivedFieldFieldSourceInput;
  DerivedFieldFullItemSource: ResolverTypeWrapper<GQLDerivedFieldFullItemSource>;
  DerivedFieldFullItemSourceInput: GQLDerivedFieldFullItemSourceInput;
  DerivedFieldSource: ResolverTypeWrapper<DerivedFieldSpecSource>;
  DerivedFieldSourceInput: GQLDerivedFieldSourceInput;
  DerivedFieldSpec: ResolverTypeWrapper<
    Omit<GQLDerivedFieldSpec, 'source'> & {
      source: GQLResolversTypes['DerivedFieldSource'];
    }
  >;
  DerivedFieldSpecInput: GQLDerivedFieldSpecInput;
  DisabledInfo: ResolverTypeWrapper<GQLDisabledInfo>;
  DisabledInfoInput: GQLDisabledInfoInput;
  EnqueueAuthorToMrtAction: ResolverTypeWrapper<EnqueueAuthorToMrtAction>;
  EnqueueToMrtAction: ResolverTypeWrapper<EnqueueToMrtAction>;
  EnqueueToNcmecAction: ResolverTypeWrapper<EnqueueToNcmecAction>;
  EnumSignalOutputType: ResolverTypeWrapper<GQLEnumSignalOutputType>;
  Error:
    | GQLResolversTypes['ActionNameExistsError']
    | GQLResolversTypes['AddCommentFailedError']
    | GQLResolversTypes['CannotDeleteDefaultUserError']
    | GQLResolversTypes['ChangePasswordError']
    | GQLResolversTypes['DeleteAllJobsUnauthorizedError']
    | GQLResolversTypes['IntegrationConfigTooManyCredentialsError']
    | GQLResolversTypes['IntegrationConfigUnsupportedIntegrationError']
    | GQLResolversTypes['IntegrationEmptyInputCredentialsError']
    | GQLResolversTypes['IntegrationNoInputCredentialsError']
    | GQLResolversTypes['InviteUserTokenExpiredError']
    | GQLResolversTypes['InviteUserTokenMissingError']
    | GQLResolversTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversTypes['JobHasAlreadyBeenSubmittedError']
    | GQLResolversTypes['LocationBankNameExistsError']
    | GQLResolversTypes['LoginIncorrectPasswordError']
    | GQLResolversTypes['LoginSsoRequiredError']
    | GQLResolversTypes['LoginUserDoesNotExistError']
    | GQLResolversTypes['ManualReviewQueueNameExistsError']
    | GQLResolversTypes['MatchingBankNameExistsError']
    | GQLResolversTypes['NoJobWithIdInQueueError']
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['OrgWithEmailExistsError']
    | GQLResolversTypes['OrgWithNameExistsError']
    | GQLResolversTypes['PartialItemsEndpointResponseError']
    | GQLResolversTypes['PartialItemsInvalidResponseError']
    | GQLResolversTypes['PartialItemsMissingEndpointError']
    | GQLResolversTypes['PolicyNameExistsError']
    | GQLResolversTypes['QueueDoesNotExistError']
    | GQLResolversTypes['RecordingJobDecisionFailedError']
    | GQLResolversTypes['ReportingRuleNameExistsError']
    | GQLResolversTypes['RotateApiKeyError']
    | GQLResolversTypes['RoutingRuleNameExistsError']
    | GQLResolversTypes['RuleHasRunningBacktestsError']
    | GQLResolversTypes['RuleNameExistsError']
    | GQLResolversTypes['SignUpUserExistsError']
    | GQLResolversTypes['SubmittedJobActionNotFoundError'];
  ExecuteActionResponse: ResolverTypeWrapper<GQLExecuteActionResponse>;
  ExecuteBulkActionInput: GQLExecuteBulkActionInput;
  ExecuteBulkActionResponse: ResolverTypeWrapper<GQLExecuteBulkActionResponse>;
  ExecuteBulkActionsInput: GQLExecuteBulkActionsInput;
  Field: GQLResolversTypes['BaseField'] | GQLResolversTypes['DerivedField'];
  FieldInput: GQLFieldInput;
  FieldType: GQLFieldType;
  Float: ResolverTypeWrapper<Scalars['Float']>;
  ForgotPasswordError: GQLForgotPasswordError;
  GetDecisionCountInput: GQLGetDecisionCountInput;
  GetDecisionCountSettings: ResolverTypeWrapper<GQLGetDecisionCountSettings>;
  GetDecisionCountsTableInput: GQLGetDecisionCountsTableInput;
  GetFullReportingRuleResultForItemResponse:
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['ReportingRuleExecutionResult'];
  GetFullResultForItemInput: GQLGetFullResultForItemInput;
  GetFullResultForItemResponse:
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['RuleExecutionResult'];
  GetJobCreationCountInput: GQLGetJobCreationCountInput;
  GetJobCreationCountSettings: ResolverTypeWrapper<GQLGetJobCreationCountSettings>;
  GetResolvedJobCountInput: GQLGetResolvedJobCountInput;
  GetSkippedJobCountInput: GQLGetSkippedJobCountInput;
  GoogleContentSafetyApiIntegrationApiCredential: ResolverTypeWrapper<GQLGoogleContentSafetyApiIntegrationApiCredential>;
  GoogleContentSafetyApiIntegrationApiCredentialInput: GQLGoogleContentSafetyApiIntegrationApiCredentialInput;
  GooglePlaceLocationInfo: ResolverTypeWrapper<GQLGooglePlaceLocationInfo>;
  HashBank: ResolverTypeWrapper<HashBank>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  IgnoreDecisionComponent: ResolverTypeWrapper<GQLIgnoreDecisionComponent>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Integration: GQLIntegration;
  IntegrationApiCredential:
    | GQLResolversTypes['GoogleContentSafetyApiIntegrationApiCredential']
    | GQLResolversTypes['OpenAiIntegrationApiCredential']
    | GQLResolversTypes['ZentropiIntegrationApiCredential'];
  IntegrationApiCredentialInput: GQLIntegrationApiCredentialInput;
  IntegrationConfig: ResolverTypeWrapper<
    Omit<GQLIntegrationConfig, 'apiCredential'> & {
      apiCredential: GQLResolversTypes['IntegrationApiCredential'];
    }
  >;
  IntegrationConfigQueryResponse:
    | GQLResolversTypes['IntegrationConfigSuccessResult']
    | GQLResolversTypes['IntegrationConfigUnsupportedIntegrationError'];
  IntegrationConfigSuccessResult: ResolverTypeWrapper<GQLIntegrationConfigSuccessResult>;
  IntegrationConfigTooManyCredentialsError: ResolverTypeWrapper<GQLIntegrationConfigTooManyCredentialsError>;
  IntegrationConfigUnsupportedIntegrationError: ResolverTypeWrapper<GQLIntegrationConfigUnsupportedIntegrationError>;
  IntegrationEmptyInputCredentialsError: ResolverTypeWrapper<GQLIntegrationEmptyInputCredentialsError>;
  IntegrationNoInputCredentialsError: ResolverTypeWrapper<GQLIntegrationNoInputCredentialsError>;
  InviteUserInput: GQLInviteUserInput;
  InviteUserToken: ResolverTypeWrapper<GQLInviteUserToken>;
  InviteUserTokenExpiredError: ResolverTypeWrapper<GQLInviteUserTokenExpiredError>;
  InviteUserTokenMissingError: ResolverTypeWrapper<GQLInviteUserTokenMissingError>;
  InviteUserTokenResponse:
    | GQLResolversTypes['InviteUserTokenExpiredError']
    | GQLResolversTypes['InviteUserTokenMissingError']
    | GQLResolversTypes['InviteUserTokenSuccessResponse'];
  InviteUserTokenSuccessResponse: ResolverTypeWrapper<GQLInviteUserTokenSuccessResponse>;
  IpAddress: ResolverTypeWrapper<GQLIpAddress>;
  IpAddressInput: GQLIpAddressInput;
  Item: ResolverTypeWrapper<ItemSubmissionForGQL>;
  ItemAction: ResolverTypeWrapper<GQLItemAction>;
  ItemBase: ResolverTypeWrapper<ItemSubmissionForGQL>;
  ItemHistoryResponse:
    | GQLResolversTypes['ItemHistoryResult']
    | GQLResolversTypes['NotFoundError'];
  ItemHistoryResult: ResolverTypeWrapper<
    Omit<GQLItemHistoryResult, 'executions' | 'item'> & {
      executions: ReadonlyArray<GQLResolversTypes['RuleExecutionResult']>;
      item: GQLResolversTypes['Item'];
    }
  >;
  ItemIdentifier: ResolverTypeWrapper<GQLItemIdentifier>;
  ItemIdentifierInput: GQLItemIdentifierInput;
  ItemInput: GQLItemInput;
  ItemSubmissions: ResolverTypeWrapper<
    Omit<GQLItemSubmissions, 'latest' | 'prior'> & {
      latest: GQLResolversTypes['Item'];
      prior?: Maybe<ReadonlyArray<GQLResolversTypes['Item']>>;
    }
  >;
  ItemType: ResolverTypeWrapper<ItemTypeResolversParentType>;
  ItemTypeBase: ResolverTypeWrapper<ItemTypeResolversParentType>;
  ItemTypeIdentifier: ResolverTypeWrapper<
    Omit<GQLItemTypeIdentifier, 'schemaVariant' | 'version'> & {
      schemaVariant: GQLResolversTypes['ItemTypeSchemaVariant'];
      version: GQLResolversTypes['NonEmptyString'];
    }
  >;
  ItemTypeIdentifierInput: GQLItemTypeIdentifierInput;
  ItemTypeNameAlreadyExistsError: ResolverTypeWrapper<GQLItemTypeNameAlreadyExistsError>;
  ItemTypeSchemaVariant: ResolverTypeWrapper<ItemTypeSchemaVariantResolverValue>;
  ItemTypeSchemaVariantInput: ResolverTypeWrapper<ItemTypeSchemaVariantInputResolverValue>;
  ItemWithParents: ResolverTypeWrapper<
    Omit<GQLItemWithParents, 'item' | 'parents'> & {
      item: GQLResolversTypes['ItemSubmissions'];
      parents: ReadonlyArray<GQLResolversTypes['ItemSubmissions']>;
    }
  >;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  JobCountFilterByInput: GQLJobCountFilterByInput;
  JobCountGroupByColumns: GQLJobCountGroupByColumns;
  JobCreationCount: ResolverTypeWrapper<GQLJobCreationCount>;
  JobCreationFilterBy: ResolverTypeWrapper<GQLJobCreationFilterBy>;
  JobCreationFilterByInput: GQLJobCreationFilterByInput;
  JobCreationGroupByColumns: GQLJobCreationGroupByColumns;
  JobCreationSettingsInput: GQLJobCreationSettingsInput;
  JobCreationSourceOptions: GQLJobCreationSourceOptions;
  JobHasAlreadyBeenSubmittedError: ResolverTypeWrapper<GQLJobHasAlreadyBeenSubmittedError>;
  Language: GQLLanguage;
  Languages: ResolverTypeWrapper<GQLLanguages>;
  LatLng: ResolverTypeWrapper<GQLLatLng>;
  LatLngInput: GQLLatLngInput;
  LeafCondition: ResolverTypeWrapper<LeafCondition>;
  LeafConditionWithResult: ResolverTypeWrapper<LeafConditionWithResult>;
  LocationArea: ResolverTypeWrapper<GQLLocationArea>;
  LocationAreaInput: GQLLocationAreaInput;
  LocationBank: ResolverTypeWrapper<LocationBankWithoutFullPlacesAPIResponse>;
  LocationBankNameExistsError: ResolverTypeWrapper<GQLLocationBankNameExistsError>;
  LocationGeometry: ResolverTypeWrapper<GQLLocationGeometry>;
  LocationGeometryInput: GQLLocationGeometryInput;
  LogSkipInput: GQLLogSkipInput;
  LoginIncorrectPasswordError: ResolverTypeWrapper<GQLLoginIncorrectPasswordError>;
  LoginInput: GQLLoginInput;
  LoginMethod: GQLLoginMethod;
  LoginResponse:
    | GQLResolversTypes['LoginIncorrectPasswordError']
    | GQLResolversTypes['LoginSsoRequiredError']
    | GQLResolversTypes['LoginSuccessResponse']
    | GQLResolversTypes['LoginUserDoesNotExistError'];
  LoginSsoRequiredError: ResolverTypeWrapper<GQLLoginSsoRequiredError>;
  LoginSuccessResponse: ResolverTypeWrapper<
    Omit<GQLLoginSuccessResponse, 'user'> & { user: GQLResolversTypes['User'] }
  >;
  LoginUserDoesNotExistError: ResolverTypeWrapper<GQLLoginUserDoesNotExistError>;
  LookbackVersion: GQLLookbackVersion;
  ManualReviewChartConfigurationsInput: GQLManualReviewChartConfigurationsInput;
  ManualReviewChartMetric: GQLManualReviewChartMetric;
  ManualReviewChartSettings:
    | GQLResolversTypes['GetDecisionCountSettings']
    | GQLResolversTypes['GetJobCreationCountSettings'];
  ManualReviewChartSettingsInput: GQLManualReviewChartSettingsInput;
  ManualReviewDecision: ResolverTypeWrapper<
    Omit<GQLManualReviewDecision, 'decisions' | 'relatedActions'> & {
      decisions: ReadonlyArray<
        GQLResolversTypes['ManualReviewDecisionComponent']
      >;
      relatedActions: ReadonlyArray<
        GQLResolversTypes['ManualReviewDecisionComponent']
      >;
    }
  >;
  ManualReviewDecisionComponent:
    | GQLResolversTypes['AcceptAppealDecisionComponent']
    | GQLResolversTypes['AutomaticCloseDecisionComponent']
    | GQLResolversTypes['IgnoreDecisionComponent']
    | GQLResolversTypes['RejectAppealDecisionComponent']
    | GQLResolversTypes['SubmitNCMECReportDecisionComponent']
    | GQLResolversTypes['TransformJobAndRecreateInQueueDecisionComponent']
    | GQLResolversTypes['UserOrRelatedActionDecisionComponent'];
  ManualReviewDecisionComponentBase:
    | GQLResolversTypes['AcceptAppealDecisionComponent']
    | GQLResolversTypes['AutomaticCloseDecisionComponent']
    | GQLResolversTypes['IgnoreDecisionComponent']
    | GQLResolversTypes['RejectAppealDecisionComponent']
    | GQLResolversTypes['SubmitNCMECReportDecisionComponent']
    | GQLResolversTypes['TransformJobAndRecreateInQueueDecisionComponent']
    | GQLResolversTypes['UserOrRelatedActionDecisionComponent'];
  ManualReviewDecisionType: GQLManualReviewDecisionType;
  ManualReviewExistingJob: ResolverTypeWrapper<
    Omit<GQLManualReviewExistingJob, 'job'> & {
      job: GQLResolversTypes['ManualReviewJob'];
    }
  >;
  ManualReviewJob: ResolverTypeWrapper<ManualReviewJobOrAppeal>;
  ManualReviewJobComment: ResolverTypeWrapper<ManualReviewJobComment>;
  ManualReviewJobEnqueueSourceInfo:
    | GQLResolversTypes['AppealEnqueueSourceInfo']
    | GQLResolversTypes['MrtJobEnqueueSourceInfo']
    | GQLResolversTypes['PostActionsEnqueueSourceInfo']
    | GQLResolversTypes['ReportEnqueueSourceInfo']
    | GQLResolversTypes['RuleExecutionEnqueueSourceInfo'];
  ManualReviewJobKind: GQLManualReviewJobKind;
  ManualReviewJobPayload: ResolverTypeWrapper<ManualReviewJobPayload>;
  ManualReviewJobWithDecisions: ResolverTypeWrapper<
    Omit<GQLManualReviewJobWithDecisions, 'job'> & {
      job: GQLResolversTypes['ManualReviewJob'];
    }
  >;
  ManualReviewQueue: ResolverTypeWrapper<ManualReviewQueue>;
  ManualReviewQueueNameExistsError: ResolverTypeWrapper<GQLManualReviewQueueNameExistsError>;
  MatchingBankNameExistsError: ResolverTypeWrapper<GQLMatchingBankNameExistsError>;
  MatchingBanks: ResolverTypeWrapper<Org>;
  MatchingValues: ResolverTypeWrapper<GQLMatchingValues>;
  MessageWithIpAddress: ResolverTypeWrapper<
    Omit<GQLMessageWithIpAddress, 'message'> & {
      message: GQLResolversTypes['ContentItem'];
    }
  >;
  MetricsTimeDivisionOptions: GQLMetricsTimeDivisionOptions;
  ModeratorSafetySettingsInput: GQLModeratorSafetySettingsInput;
  MrtJobEnqueueSourceInfo: ResolverTypeWrapper<GQLMrtJobEnqueueSourceInfo>;
  MutateAccessibleQueuesForUserSuccessResponse: ResolverTypeWrapper<GQLMutateAccessibleQueuesForUserSuccessResponse>;
  MutateActionError: GQLMutateActionError;
  MutateActionResponse:
    | GQLResolversTypes['ActionNameExistsError']
    | GQLResolversTypes['MutateActionSuccessResponse'];
  MutateActionSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateActionSuccessResponse, 'data'> & {
      data: GQLResolversTypes['CustomAction'];
    }
  >;
  MutateBankResponse: ResolverTypeWrapper<GQLMutateBankResponse>;
  MutateContentItemTypeResponse:
    | GQLResolversTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversTypes['MutateContentTypeSuccessResponse'];
  MutateContentRuleSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateContentRuleSuccessResponse, 'data'> & {
      data: GQLResolversTypes['ContentRule'];
    }
  >;
  MutateContentTypeSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateContentTypeSuccessResponse, 'data'> & {
      data?: Maybe<GQLResolversTypes['ContentItemType']>;
    }
  >;
  MutateHashBankResponse:
    | GQLResolversTypes['MatchingBankNameExistsError']
    | GQLResolversTypes['MutateHashBankSuccessResponse'];
  MutateHashBankSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateHashBankSuccessResponse, 'data'> & {
      data: GQLResolversTypes['HashBank'];
    }
  >;
  MutateLocationBankResponse:
    | GQLResolversTypes['LocationBankNameExistsError']
    | GQLResolversTypes['MutateLocationBankSuccessResponse'];
  MutateLocationBankSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateLocationBankSuccessResponse, 'data'> & {
      data: GQLResolversTypes['LocationBank'];
    }
  >;
  MutateManualReviewQueueSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateManualReviewQueueSuccessResponse, 'data'> & {
      data: GQLResolversTypes['ManualReviewQueue'];
    }
  >;
  MutateReportingRuleSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateReportingRuleSuccessResponse, 'data'> & {
      data: GQLResolversTypes['ReportingRule'];
    }
  >;
  MutateRoutingRuleSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateRoutingRuleSuccessResponse, 'data'> & {
      data: GQLResolversTypes['RoutingRule'];
    }
  >;
  MutateRoutingRulesOrderSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateRoutingRulesOrderSuccessResponse, 'data'> & {
      data: ReadonlyArray<GQLResolversTypes['RoutingRule']>;
    }
  >;
  MutateThreadItemTypeResponse:
    | GQLResolversTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversTypes['MutateThreadTypeSuccessResponse'];
  MutateThreadTypeSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateThreadTypeSuccessResponse, 'data'> & {
      data?: Maybe<GQLResolversTypes['ThreadItemType']>;
    }
  >;
  MutateUserItemTypeResponse:
    | GQLResolversTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversTypes['MutateUserTypeSuccessResponse'];
  MutateUserRuleSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateUserRuleSuccessResponse, 'data'> & {
      data: GQLResolversTypes['UserRule'];
    }
  >;
  MutateUserTypeSuccessResponse: ResolverTypeWrapper<
    Omit<GQLMutateUserTypeSuccessResponse, 'data'> & {
      data?: Maybe<GQLResolversTypes['UserItemType']>;
    }
  >;
  Mutation: ResolverTypeWrapper<{}>;
  NCMECIncidentType: GQLNcmecIncidentType;
  NCMECReport: ResolverTypeWrapper<
    Omit<GQLNcmecReport, 'userItemType'> & {
      userItemType: GQLResolversTypes['UserItemType'];
    }
  >;
  NCMECReportedMedia: ResolverTypeWrapper<GQLNcmecReportedMedia>;
  NCMECReportedThread: ResolverTypeWrapper<GQLNcmecReportedThread>;
  NcmecAdditionalFile: ResolverTypeWrapper<GQLNcmecAdditionalFile>;
  NcmecContentInThreadReport: GQLNcmecContentInThreadReport;
  NcmecContentItem: ResolverTypeWrapper<
    Omit<GQLNcmecContentItem, 'contentItem'> & {
      contentItem: GQLResolversTypes['Item'];
    }
  >;
  NcmecFileAnnotation: GQLNcmecFileAnnotation;
  NcmecIndustryClassification: GQLNcmecIndustryClassification;
  NcmecManualReviewJobPayload: ResolverTypeWrapper<NcmecManualReviewJobPayload>;
  NcmecMediaInput: GQLNcmecMediaInput;
  NcmecOrgSettings: ResolverTypeWrapper<GQLNcmecOrgSettings>;
  NcmecOrgSettingsInput: GQLNcmecOrgSettingsInput;
  NcmecReportedMediaDetails: ResolverTypeWrapper<GQLNcmecReportedMediaDetails>;
  NcmecThreadInput: GQLNcmecThreadInput;
  NoJobWithIdInQueueError: ResolverTypeWrapper<GQLNoJobWithIdInQueueError>;
  NonEmptyString: ResolverTypeWrapper<NonEmptyString>;
  NotFoundError: ResolverTypeWrapper<GQLNotFoundError>;
  Notification: ResolverTypeWrapper<Notification>;
  NotificationType: GQLNotificationType;
  OpenAiIntegrationApiCredential: ResolverTypeWrapper<GQLOpenAiIntegrationApiCredential>;
  OpenAiIntegrationApiCredentialInput: GQLOpenAiIntegrationApiCredentialInput;
  Org: ResolverTypeWrapper<Org>;
  OrgWithEmailExistsError: ResolverTypeWrapper<GQLOrgWithEmailExistsError>;
  OrgWithNameExistsError: ResolverTypeWrapper<GQLOrgWithNameExistsError>;
  PageInfo: ResolverTypeWrapper<GQLPageInfo>;
  PartialItemsEndpointResponseError: ResolverTypeWrapper<GQLPartialItemsEndpointResponseError>;
  PartialItemsInvalidResponseError: ResolverTypeWrapper<GQLPartialItemsInvalidResponseError>;
  PartialItemsMissingEndpointError: ResolverTypeWrapper<GQLPartialItemsMissingEndpointError>;
  PartialItemsResponse:
    | GQLResolversTypes['PartialItemsEndpointResponseError']
    | GQLResolversTypes['PartialItemsInvalidResponseError']
    | GQLResolversTypes['PartialItemsMissingEndpointError']
    | GQLResolversTypes['PartialItemsSuccessResponse'];
  PartialItemsSuccessResponse: ResolverTypeWrapper<
    Omit<GQLPartialItemsSuccessResponse, 'items'> & {
      items: ReadonlyArray<GQLResolversTypes['Item']>;
    }
  >;
  PendingInvite: ResolverTypeWrapper<GQLPendingInvite>;
  PlaceBounds: ResolverTypeWrapper<GQLPlaceBounds>;
  PlaceBoundsInput: GQLPlaceBoundsInput;
  Policy: ResolverTypeWrapper<GQLPolicy>;
  PolicyActionCount: ResolverTypeWrapper<GQLPolicyActionCount>;
  PolicyNameExistsError: ResolverTypeWrapper<GQLPolicyNameExistsError>;
  PolicyType: GQLPolicyType;
  PolicyViolationsCount: ResolverTypeWrapper<GQLPolicyViolationsCount>;
  PostActionsEnqueueSourceInfo: ResolverTypeWrapper<GQLPostActionsEnqueueSourceInfo>;
  Query: ResolverTypeWrapper<{}>;
  QueueDoesNotExistError: ResolverTypeWrapper<GQLQueueDoesNotExistError>;
  RecentDecisionsFilterInput: GQLRecentDecisionsFilterInput;
  RecentDecisionsForUser: ResolverTypeWrapper<GQLRecentDecisionsForUser>;
  RecentDecisionsInput: GQLRecentDecisionsInput;
  RecentManualReviewAcceptAppealDecision: GQLRecentManualReviewAcceptAppealDecision;
  RecentManualReviewAutomaticCloseDecision: GQLRecentManualReviewAutomaticCloseDecision;
  RecentManualReviewDecisionType: GQLRecentManualReviewDecisionType;
  RecentManualReviewIgnoreDecision: GQLRecentManualReviewIgnoreDecision;
  RecentManualReviewRejectAppealDecision: GQLRecentManualReviewRejectAppealDecision;
  RecentManualReviewSubmitNCMECReportDecision: GQLRecentManualReviewSubmitNcmecReportDecision;
  RecentManualReviewTransformJobAndRecreateInQueueDecision: GQLRecentManualReviewTransformJobAndRecreateInQueueDecision;
  RecentManualReviewUserOrRelatedActionDecision: GQLRecentManualReviewUserOrRelatedActionDecision;
  RecentUserStrikeActions: ResolverTypeWrapper<GQLRecentUserStrikeActions>;
  RecentUserStrikeActionsInput: GQLRecentUserStrikeActionsInput;
  RecommendedThresholds: ResolverTypeWrapper<GQLRecommendedThresholds>;
  RecordingJobDecisionFailedError: ResolverTypeWrapper<GQLRecordingJobDecisionFailedError>;
  RejectAppealDecisionComponent: ResolverTypeWrapper<GQLRejectAppealDecisionComponent>;
  ReleaseJobLockInput: GQLReleaseJobLockInput;
  RemoveAccessibleQueuesToUserInput: GQLRemoveAccessibleQueuesToUserInput;
  RemoveAccessibleQueuesToUserResponse:
    | GQLResolversTypes['MutateAccessibleQueuesForUserSuccessResponse']
    | GQLResolversTypes['NotFoundError'];
  RemoveFavoriteMRTQueueSuccessResponse: ResolverTypeWrapper<GQLRemoveFavoriteMrtQueueSuccessResponse>;
  RemoveFavoriteRuleResponse: GQLResolversTypes['RemoveFavoriteRuleSuccessResponse'];
  RemoveFavoriteRuleSuccessResponse: ResolverTypeWrapper<GQLRemoveFavoriteRuleSuccessResponse>;
  ReorderRoutingRulesInput: GQLReorderRoutingRulesInput;
  ReorderRoutingRulesResponse: GQLResolversTypes['MutateRoutingRulesOrderSuccessResponse'];
  ReportEnqueueSourceInfo: ResolverTypeWrapper<GQLReportEnqueueSourceInfo>;
  ReportHistoryEntry: ResolverTypeWrapper<GQLReportHistoryEntry>;
  ReportHistoryEntryInput: GQLReportHistoryEntryInput;
  ReportedForReason: ResolverTypeWrapper<GQLReportedForReason>;
  ReporterIdInput: GQLReporterIdInput;
  ReportingInsights: ResolverTypeWrapper<ReportingInsights>;
  ReportingRule: ResolverTypeWrapper<ReportingRuleWithoutVersion>;
  ReportingRuleExecutionResult: ResolverTypeWrapper<
    Omit<GQLReportingRuleExecutionResult, 'result' | 'signalResults'> & {
      result?: Maybe<GQLResolversTypes['ConditionSetWithResult']>;
      signalResults?: Maybe<
        ReadonlyArray<GQLResolversTypes['SignalWithScore']>
      >;
    }
  >;
  ReportingRuleInsights: ResolverTypeWrapper<ReportingRuleWithoutVersion>;
  ReportingRuleNameExistsError: ResolverTypeWrapper<GQLReportingRuleNameExistsError>;
  ReportingRulePassRateData: ResolverTypeWrapper<GQLReportingRulePassRateData>;
  ReportingRuleStatus: GQLReportingRuleStatus;
  RequestDemoInput: GQLRequestDemoInput;
  RequestDemoInterest: GQLRequestDemoInterest;
  ResetPasswordInput: GQLResetPasswordInput;
  ResolvedJobCount: ResolverTypeWrapper<GQLResolvedJobCount>;
  RotateApiKeyError: ResolverTypeWrapper<GQLRotateApiKeyError>;
  RotateApiKeyInput: GQLRotateApiKeyInput;
  RotateApiKeyResponse:
    | GQLResolversTypes['RotateApiKeyError']
    | GQLResolversTypes['RotateApiKeySuccessResponse'];
  RotateApiKeySuccessResponse: ResolverTypeWrapper<GQLRotateApiKeySuccessResponse>;
  RoutingRule: ResolverTypeWrapper<RoutingRuleWithoutVersion>;
  RoutingRuleNameExistsError: ResolverTypeWrapper<GQLRoutingRuleNameExistsError>;
  RoutingRuleStatus: GQLRoutingRuleStatus;
  Rule: ResolverTypeWrapper<Rule>;
  RuleEnvironment: GQLRuleEnvironment;
  RuleExecutionEnqueueSourceInfo: ResolverTypeWrapper<
    Omit<GQLRuleExecutionEnqueueSourceInfo, 'rules'> & {
      rules: ReadonlyArray<GQLResolversTypes['Rule']>;
    }
  >;
  RuleExecutionResult: ResolverTypeWrapper<
    Omit<GQLRuleExecutionResult, 'result' | 'signalResults'> & {
      result?: Maybe<GQLResolversTypes['ConditionSetWithResult']>;
      signalResults?: Maybe<
        ReadonlyArray<GQLResolversTypes['SignalWithScore']>
      >;
    }
  >;
  RuleExecutionResultEdge: ResolverTypeWrapper<
    Omit<GQLRuleExecutionResultEdge, 'node'> & {
      node: GQLResolversTypes['RuleExecutionResult'];
    }
  >;
  RuleExecutionResultsConnection: ResolverTypeWrapper<
    Omit<GQLRuleExecutionResultsConnection, 'edges'> & {
      edges: ReadonlyArray<GQLResolversTypes['RuleExecutionResultEdge']>;
    }
  >;
  RuleHasRunningBacktestsError: ResolverTypeWrapper<GQLRuleHasRunningBacktestsError>;
  RuleInsights: ResolverTypeWrapper<Rule>;
  RuleNameExistsError: ResolverTypeWrapper<GQLRuleNameExistsError>;
  RulePassRateData: ResolverTypeWrapper<GQLRulePassRateData>;
  RuleStatus: GQLRuleStatus;
  RunRetroactionInput: GQLRunRetroactionInput;
  RunRetroactionResponse: GQLResolversTypes['RunRetroactionSuccessResponse'];
  RunRetroactionSuccessResponse: ResolverTypeWrapper<GQLRunRetroactionSuccessResponse>;
  ScalarSignalOutputType: ResolverTypeWrapper<GQLScalarSignalOutputType>;
  ScalarType: GQLScalarType;
  SchemaFieldRoles:
    | GQLResolversTypes['ContentSchemaFieldRoles']
    | GQLResolversTypes['ThreadSchemaFieldRoles']
    | GQLResolversTypes['UserSchemaFieldRoles'];
  SendPasswordResetInput: GQLSendPasswordResetInput;
  SetAllUserStrikeThresholdsInput: GQLSetAllUserStrikeThresholdsInput;
  SetAllUserStrikeThresholdsSuccessResponse: ResolverTypeWrapper<GQLSetAllUserStrikeThresholdsSuccessResponse>;
  SetIntegrationConfigInput: GQLSetIntegrationConfigInput;
  SetIntegrationConfigResponse:
    | GQLResolversTypes['IntegrationConfigTooManyCredentialsError']
    | GQLResolversTypes['IntegrationEmptyInputCredentialsError']
    | GQLResolversTypes['IntegrationNoInputCredentialsError']
    | GQLResolversTypes['SetIntegrationConfigSuccessResponse'];
  SetIntegrationConfigSuccessResponse: ResolverTypeWrapper<GQLSetIntegrationConfigSuccessResponse>;
  SetModeratorSafetySettingsSuccessResponse: ResolverTypeWrapper<GQLSetModeratorSafetySettingsSuccessResponse>;
  SetMrtChartConfigurationSettingsSuccessResponse: ResolverTypeWrapper<GQLSetMrtChartConfigurationSettingsSuccessResponse>;
  SetUserStrikeThresholdInput: GQLSetUserStrikeThresholdInput;
  SignUpInput: GQLSignUpInput;
  SignUpResponse:
    | GQLResolversTypes['SignUpSuccessResponse']
    | GQLResolversTypes['SignUpUserExistsError'];
  SignUpSuccessResponse: ResolverTypeWrapper<
    Omit<GQLSignUpSuccessResponse, 'data'> & {
      data?: Maybe<GQLResolversTypes['User']>;
    }
  >;
  SignUpUserExistsError: ResolverTypeWrapper<GQLSignUpUserExistsError>;
  Signal: ResolverTypeWrapper<Signal>;
  SignalArgs: GQLResolversTypes['AggregationSignalArgs'];
  SignalArgsInput: GQLSignalArgsInput;
  SignalInputType: GQLSignalInputType;
  SignalOutputType:
    | GQLResolversTypes['EnumSignalOutputType']
    | GQLResolversTypes['ScalarSignalOutputType'];
  SignalPricingStructure: ResolverTypeWrapper<GQLSignalPricingStructure>;
  SignalPricingStructureType: GQLSignalPricingStructureType;
  SignalSubcategory: ResolverTypeWrapper<GQLSignalSubcategory>;
  SignalSubcategoryInput: GQLSignalSubcategoryInput;
  SignalSubcategoryOptionInput: GQLSignalSubcategoryOptionInput;
  SignalType: GQLSignalType;
  SignalWithScore: ResolverTypeWrapper<SignalWithScore>;
  SkippedJob: ResolverTypeWrapper<GQLSkippedJob>;
  SkippedJobCount: ResolverTypeWrapper<GQLSkippedJobCount>;
  SkippedJobCountGroupByColumns: GQLSkippedJobCountGroupByColumns;
  SkippedJobFilterByInput: GQLSkippedJobFilterByInput;
  SortOrder: GQLSortOrder;
  SpotTestItemInput: GQLSpotTestItemInput;
  StartAndEndDateFilterByInput: GQLStartAndEndDateFilterByInput;
  String: ResolverTypeWrapper<Scalars['String']>;
  StringOrFloat: ResolverTypeWrapper<Scalars['StringOrFloat']>;
  SubmitAppealDecisionInput: GQLSubmitAppealDecisionInput;
  SubmitDecisionInput: GQLSubmitDecisionInput;
  SubmitDecisionResponse:
    | GQLResolversTypes['JobHasAlreadyBeenSubmittedError']
    | GQLResolversTypes['NoJobWithIdInQueueError']
    | GQLResolversTypes['RecordingJobDecisionFailedError']
    | GQLResolversTypes['SubmitDecisionSuccessResponse']
    | GQLResolversTypes['SubmittedJobActionNotFoundError'];
  SubmitDecisionSuccessResponse: ResolverTypeWrapper<GQLSubmitDecisionSuccessResponse>;
  SubmitNCMECReportDecisionComponent: ResolverTypeWrapper<GQLSubmitNcmecReportDecisionComponent>;
  SubmitNcmecReportInput: GQLSubmitNcmecReportInput;
  SubmittedJobActionNotFoundError: ResolverTypeWrapper<GQLSubmittedJobActionNotFoundError>;
  SupportedLanguages:
    | GQLResolversTypes['AllLanguages']
    | GQLResolversTypes['Languages'];
  TableDecisionCount: ResolverTypeWrapper<GQLTableDecisionCount>;
  TextBank: ResolverTypeWrapper<GQLTextBank>;
  TextBankType: GQLTextBankType;
  ThreadAppealManualReviewJobPayload: ResolverTypeWrapper<ThreadAppealReviewJobPayload>;
  ThreadItem: ResolverTypeWrapper<
    Omit<GQLThreadItem, 'type'> & { type: GQLResolversTypes['ThreadItemType'] }
  >;
  ThreadItemType: ResolverTypeWrapper<ThreadItemTypeResolversParentType>;
  ThreadManualReviewJobPayload: ResolverTypeWrapper<ThreadManualReviewJobPayload>;
  ThreadSchemaFieldRoles: ResolverTypeWrapper<GQLThreadSchemaFieldRoles>;
  ThreadSchemaFieldRolesInput: GQLThreadSchemaFieldRolesInput;
  ThreadWithMessages: ResolverTypeWrapper<
    Omit<GQLThreadWithMessages, 'messages'> & {
      messages: ReadonlyArray<GQLResolversTypes['ItemSubmissions']>;
    }
  >;
  ThreadWithMessagesAndIpAddress: ResolverTypeWrapper<
    Omit<GQLThreadWithMessagesAndIpAddress, 'messages'> & {
      messages: ReadonlyArray<GQLResolversTypes['MessageWithIpAddress']>;
    }
  >;
  TimeToAction: ResolverTypeWrapper<GQLTimeToAction>;
  TimeToActionFilterByInput: GQLTimeToActionFilterByInput;
  TimeToActionGroupByColumns: GQLTimeToActionGroupByColumns;
  TimeToActionInput: GQLTimeToActionInput;
  TopPolicyViolationsInput: GQLTopPolicyViolationsInput;
  TransformJobAndRecreateInQueue: GQLTransformJobAndRecreateInQueue;
  TransformJobAndRecreateInQueueDecisionComponent: ResolverTypeWrapper<GQLTransformJobAndRecreateInQueueDecisionComponent>;
  UpdateActionInput: GQLUpdateActionInput;
  UpdateContentItemTypeInput: GQLUpdateContentItemTypeInput;
  UpdateContentRuleInput: GQLUpdateContentRuleInput;
  UpdateContentRuleResponse:
    | GQLResolversTypes['MutateContentRuleSuccessResponse']
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['RuleHasRunningBacktestsError']
    | GQLResolversTypes['RuleNameExistsError'];
  UpdateHashBankInput: GQLUpdateHashBankInput;
  UpdateLocationBankInput: GQLUpdateLocationBankInput;
  UpdateManualReviewQueueInput: GQLUpdateManualReviewQueueInput;
  UpdateManualReviewQueueQueueResponse:
    | GQLResolversTypes['ManualReviewQueueNameExistsError']
    | GQLResolversTypes['MutateManualReviewQueueSuccessResponse']
    | GQLResolversTypes['NotFoundError'];
  UpdateNcmecOrgSettingsResponse: ResolverTypeWrapper<GQLUpdateNcmecOrgSettingsResponse>;
  UpdateOrgInfoInput: GQLUpdateOrgInfoInput;
  UpdateOrgInfoSuccessResponse: ResolverTypeWrapper<GQLUpdateOrgInfoSuccessResponse>;
  UpdatePolicyInput: GQLUpdatePolicyInput;
  UpdatePolicyResponse:
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['Policy'];
  UpdateReportingRuleInput: GQLUpdateReportingRuleInput;
  UpdateReportingRuleResponse:
    | GQLResolversTypes['MutateReportingRuleSuccessResponse']
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['ReportingRuleNameExistsError'];
  UpdateRoleInput: GQLUpdateRoleInput;
  UpdateRoutingRuleInput: GQLUpdateRoutingRuleInput;
  UpdateRoutingRuleResponse:
    | GQLResolversTypes['MutateRoutingRuleSuccessResponse']
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['QueueDoesNotExistError']
    | GQLResolversTypes['RoutingRuleNameExistsError'];
  UpdateSSOCredentialsInput: GQLUpdateSsoCredentialsInput;
  UpdateTextBankInput: GQLUpdateTextBankInput;
  UpdateThreadItemTypeInput: GQLUpdateThreadItemTypeInput;
  UpdateUserItemTypeInput: GQLUpdateUserItemTypeInput;
  UpdateUserRuleInput: GQLUpdateUserRuleInput;
  UpdateUserRuleResponse:
    | GQLResolversTypes['MutateUserRuleSuccessResponse']
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['RuleHasRunningBacktestsError']
    | GQLResolversTypes['RuleNameExistsError'];
  UpdateUserStrikeTTLInput: GQLUpdateUserStrikeTtlInput;
  UpdateUserStrikeTTLSuccessResponse: ResolverTypeWrapper<GQLUpdateUserStrikeTtlSuccessResponse>;
  User: ResolverTypeWrapper<User>;
  UserActionDecisionAction: GQLUserActionDecisionAction;
  UserActionDecisionPolicy: GQLUserActionDecisionPolicy;
  UserActionsHistory: ResolverTypeWrapper<GQLUserActionsHistory>;
  UserAppealManualReviewJobPayload: ResolverTypeWrapper<UserAppealReviewJobPayload>;
  UserHistory: ResolverTypeWrapper<UserHistoryForGQL>;
  UserHistoryResponse:
    | GQLResolversTypes['NotFoundError']
    | GQLResolversTypes['UserHistory'];
  UserInterfacePreferences: ResolverTypeWrapper<
    Omit<GQLUserInterfacePreferences, 'mrtChartConfigurations'> & {
      mrtChartConfigurations: ReadonlyArray<
        GQLResolversTypes['ManualReviewChartSettings']
      >;
    }
  >;
  UserItem: ResolverTypeWrapper<ItemSubmissionForGQL>;
  UserItemType: ResolverTypeWrapper<UserItemTypeResolversParentType>;
  UserManualReviewJobPayload: ResolverTypeWrapper<UserManualReviewJobPayload>;
  UserNotificationEdge: ResolverTypeWrapper<
    Omit<GQLUserNotificationEdge, 'node'> & {
      node: GQLResolversTypes['Notification'];
    }
  >;
  UserNotifications: ResolverTypeWrapper<
    Omit<GQLUserNotifications, 'edges'> & {
      edges: ReadonlyArray<GQLResolversTypes['UserNotificationEdge']>;
    }
  >;
  UserOrRelatedActionDecisionComponent: ResolverTypeWrapper<GQLUserOrRelatedActionDecisionComponent>;
  UserPenaltySeverity: GQLUserPenaltySeverity;
  UserPermission: GQLUserPermission;
  UserRole: GQLUserRole;
  UserRule: ResolverTypeWrapper<Rule>;
  UserSchemaFieldRoles: ResolverTypeWrapper<GQLUserSchemaFieldRoles>;
  UserSchemaFieldRolesInput: GQLUserSchemaFieldRolesInput;
  UserStrikeBucket: ResolverTypeWrapper<GQLUserStrikeBucket>;
  UserStrikeThreshold: ResolverTypeWrapper<GQLUserStrikeThreshold>;
  UserSubmissionCount: ResolverTypeWrapper<GQLUserSubmissionCount>;
  UserSubmissionsHistory: ResolverTypeWrapper<GQLUserSubmissionsHistory>;
  ValueComparator: GQLValueComparator;
  WindowConfiguration: ResolverTypeWrapper<GQLWindowConfiguration>;
  WindowConfigurationInput: GQLWindowConfigurationInput;
  ZentropiIntegrationApiCredential: ResolverTypeWrapper<GQLZentropiIntegrationApiCredential>;
  ZentropiIntegrationApiCredentialInput: GQLZentropiIntegrationApiCredentialInput;
  ZentropiLabelerVersion: ResolverTypeWrapper<GQLZentropiLabelerVersion>;
  ZentropiLabelerVersionInput: GQLZentropiLabelerVersionInput;
};

/** Mapping between all available schema types and the resolvers parents */
export type GQLResolversParentTypes = {
  AcceptAppealDecisionComponent: GQLAcceptAppealDecisionComponent;
  Action:
    | GQLResolversParentTypes['CustomAction']
    | GQLResolversParentTypes['EnqueueAuthorToMrtAction']
    | GQLResolversParentTypes['EnqueueToMrtAction']
    | GQLResolversParentTypes['EnqueueToNcmecAction'];
  ActionBase:
    | GQLResolversParentTypes['CustomAction']
    | GQLResolversParentTypes['EnqueueAuthorToMrtAction']
    | GQLResolversParentTypes['EnqueueToMrtAction']
    | GQLResolversParentTypes['EnqueueToNcmecAction'];
  ActionData: GQLActionData;
  ActionNameExistsError: GQLActionNameExistsError;
  ActionStatisticsFilters: GQLActionStatisticsFilters;
  ActionStatisticsInput: GQLActionStatisticsInput;
  AddAccessibleQueuesToUserInput: GQLAddAccessibleQueuesToUserInput;
  AddAccessibleQueuesToUserResponse: GQLResolversParentTypes['MutateAccessibleQueuesForUserSuccessResponse'];
  AddCommentFailedError: GQLAddCommentFailedError;
  AddFavoriteMRTQueueSuccessResponse: GQLAddFavoriteMrtQueueSuccessResponse;
  AddFavoriteRuleResponse: GQLResolversParentTypes['AddFavoriteRuleSuccessResponse'];
  AddFavoriteRuleSuccessResponse: GQLAddFavoriteRuleSuccessResponse;
  AddManualReviewJobCommentResponse:
    | GQLResolversParentTypes['AddManualReviewJobCommentSuccessResponse']
    | GQLResolversParentTypes['NotFoundError'];
  AddManualReviewJobCommentSuccessResponse: Omit<
    GQLAddManualReviewJobCommentSuccessResponse,
    'comment'
  > & { comment: GQLResolversParentTypes['ManualReviewJobComment'] };
  AddPoliciesResponse: GQLAddPoliciesResponse;
  AddPolicyInput: GQLAddPolicyInput;
  Aggregation: GQLAggregation;
  AggregationClause: Omit<GQLAggregationClause, 'conditionSet' | 'groupBy'> & {
    conditionSet?: Maybe<GQLResolversParentTypes['ConditionSet']>;
    groupBy: ReadonlyArray<GQLResolversParentTypes['ConditionInputField']>;
  };
  AggregationClauseInput: GQLAggregationClauseInput;
  AggregationInput: GQLAggregationInput;
  AggregationSignalArgs: Omit<GQLAggregationSignalArgs, 'aggregationClause'> & {
    aggregationClause?: Maybe<GQLResolversParentTypes['AggregationClause']>;
  };
  AggregationSignalArgsInput: GQLAggregationSignalArgsInput;
  AllLanguages: GQLAllLanguages;
  AllRuleInsights: GQLAllRuleInsights;
  ApiKey: GQLApiKey;
  AppealEnqueueSourceInfo: GQLAppealEnqueueSourceInfo;
  AppealSettings: GQLAppealSettings;
  AppealSettingsInput: GQLAppealSettingsInput;
  AutomaticCloseDecisionComponent: GQLAutomaticCloseDecisionComponent;
  Backtest: Backtest;
  BaseField: GQLBaseField;
  Boolean: Scalars['Boolean'];
  CannotDeleteDefaultUserError: GQLCannotDeleteDefaultUserError;
  ChangePasswordError: GQLChangePasswordError;
  ChangePasswordInput: GQLChangePasswordInput;
  ChangePasswordResponse:
    | GQLResolversParentTypes['ChangePasswordError']
    | GQLResolversParentTypes['ChangePasswordSuccessResponse'];
  ChangePasswordSuccessResponse: GQLChangePasswordSuccessResponse;
  Condition: Condition;
  ConditionInput: GQLConditionInput;
  ConditionInputField: Omit<GQLConditionInputField, 'spec'> & {
    spec?: Maybe<GQLResolversParentTypes['DerivedFieldSpec']>;
  };
  ConditionInputFieldInput: GQLConditionInputFieldInput;
  ConditionInputSignalInput: GQLConditionInputSignalInput;
  ConditionMatchingValuesInput: GQLConditionMatchingValuesInput;
  ConditionResult: GQLConditionResult;
  ConditionSet: ConditionSet;
  ConditionSetInput: GQLConditionSetInput;
  ConditionSetWithResult: ConditionSetWithResult;
  ConditionWithResult: ConditionWithResult;
  Container: GQLContainer;
  ContainerInput: GQLContainerInput;
  ContentAppealManualReviewJobPayload: ContentAppealReviewJobPayload;
  ContentItem: Omit<GQLContentItem, 'type'> & {
    type: GQLResolversParentTypes['ContentItemType'];
  };
  ContentItemType: ContentItemTypeResolversParentType;
  ContentManualReviewJobPayload: ContentManualReviewJobPayload;
  ContentRule: Rule;
  ContentSchemaFieldRoles: GQLContentSchemaFieldRoles;
  ContentSchemaFieldRolesInput: GQLContentSchemaFieldRolesInput;
  ContentType: ItemType;
  CoopActionDecisionInput: GQLCoopActionDecisionInput;
  CoopInputOrString: Scalars['CoopInputOrString'];
  CountByActionByDay: GQLCountByActionByDay;
  CountByActionByDayAction: GQLCountByActionByDayAction;
  CountByDay: GQLCountByDay;
  CountByDecisionTypeByDay: GQLCountByDecisionTypeByDay;
  CountByPolicyByDay: GQLCountByPolicyByDay;
  CountByPolicyByDayPolicy: GQLCountByPolicyByDayPolicy;
  CountByTagByDay: GQLCountByTagByDay;
  CreateActionInput: GQLCreateActionInput;
  CreateBacktestInput: GQLCreateBacktestInput;
  CreateBacktestResponse: Omit<GQLCreateBacktestResponse, 'backtest'> & {
    backtest: GQLResolversParentTypes['Backtest'];
  };
  CreateContentItemTypeInput: GQLCreateContentItemTypeInput;
  CreateContentRuleInput: GQLCreateContentRuleInput;
  CreateContentRuleResponse:
    | GQLResolversParentTypes['MutateContentRuleSuccessResponse']
    | GQLResolversParentTypes['RuleNameExistsError'];
  CreateHashBankInput: GQLCreateHashBankInput;
  CreateLocationBankInput: GQLCreateLocationBankInput;
  CreateManualReviewJobCommentInput: GQLCreateManualReviewJobCommentInput;
  CreateManualReviewQueueInput: GQLCreateManualReviewQueueInput;
  CreateManualReviewQueueResponse:
    | GQLResolversParentTypes['ManualReviewQueueNameExistsError']
    | GQLResolversParentTypes['MutateManualReviewQueueSuccessResponse'];
  CreateOrgInput: GQLCreateOrgInput;
  CreateOrgResponse:
    | GQLResolversParentTypes['CreateOrgSuccessResponse']
    | GQLResolversParentTypes['OrgWithEmailExistsError']
    | GQLResolversParentTypes['OrgWithNameExistsError'];
  CreateOrgSuccessResponse: GQLCreateOrgSuccessResponse;
  CreateReportingRuleInput: GQLCreateReportingRuleInput;
  CreateReportingRuleResponse:
    | GQLResolversParentTypes['MutateReportingRuleSuccessResponse']
    | GQLResolversParentTypes['ReportingRuleNameExistsError'];
  CreateRoutingRuleInput: GQLCreateRoutingRuleInput;
  CreateRoutingRuleResponse:
    | GQLResolversParentTypes['MutateRoutingRuleSuccessResponse']
    | GQLResolversParentTypes['QueueDoesNotExistError']
    | GQLResolversParentTypes['RoutingRuleNameExistsError'];
  CreateTextBankInput: GQLCreateTextBankInput;
  CreateThreadItemTypeInput: GQLCreateThreadItemTypeInput;
  CreateUserItemTypeInput: GQLCreateUserItemTypeInput;
  CreateUserRuleInput: GQLCreateUserRuleInput;
  CreateUserRuleResponse:
    | GQLResolversParentTypes['MutateUserRuleSuccessResponse']
    | GQLResolversParentTypes['RuleNameExistsError'];
  Cursor: Scalars['Cursor'];
  CustomAction: CustomAction;
  CustomMrtApiParamSpec: GQLCustomMrtApiParamSpec;
  Date: Scalars['Date'];
  DateTime: Scalars['DateTime'];
  DecisionCount: GQLDecisionCount;
  DecisionCountFilterBy: GQLDecisionCountFilterBy;
  DecisionCountFilterByInput: GQLDecisionCountFilterByInput;
  DecisionCountSettingsInput: GQLDecisionCountSettingsInput;
  DecisionCountTableFilterByInput: GQLDecisionCountTableFilterByInput;
  DecisionSubmission: GQLDecisionSubmission;
  DeleteAllJobsFromQueueResponse:
    | GQLResolversParentTypes['DeleteAllJobsFromQueueSuccessResponse']
    | GQLResolversParentTypes['DeleteAllJobsUnauthorizedError'];
  DeleteAllJobsFromQueueSuccessResponse: GQLDeleteAllJobsFromQueueSuccessResponse;
  DeleteAllJobsUnauthorizedError: GQLDeleteAllJobsUnauthorizedError;
  DeleteItemTypeResponse:
    | GQLResolversParentTypes['CannotDeleteDefaultUserError']
    | GQLResolversParentTypes['DeleteItemTypeSuccessResponse'];
  DeleteItemTypeSuccessResponse: GQLDeleteItemTypeSuccessResponse;
  DeleteManualReviewJobCommentInput: GQLDeleteManualReviewJobCommentInput;
  DeleteRoutingRuleInput: GQLDeleteRoutingRuleInput;
  DequeueManualReviewJobResponse: GQLResolversParentTypes['DequeueManualReviewJobSuccessResponse'];
  DequeueManualReviewJobSuccessResponse: Omit<
    GQLDequeueManualReviewJobSuccessResponse,
    'job'
  > & { job: GQLResolversParentTypes['ManualReviewJob'] };
  DerivedField: Omit<GQLDerivedField, 'spec'> & {
    spec: GQLResolversParentTypes['DerivedFieldSpec'];
  };
  DerivedFieldCoopInputSource: GQLDerivedFieldCoopInputSource;
  DerivedFieldCoopInputSourceInput: GQLDerivedFieldCoopInputSourceInput;
  DerivedFieldFieldSource: GQLDerivedFieldFieldSource;
  DerivedFieldFieldSourceInput: GQLDerivedFieldFieldSourceInput;
  DerivedFieldFullItemSource: GQLDerivedFieldFullItemSource;
  DerivedFieldFullItemSourceInput: GQLDerivedFieldFullItemSourceInput;
  DerivedFieldSource: DerivedFieldSpecSource;
  DerivedFieldSourceInput: GQLDerivedFieldSourceInput;
  DerivedFieldSpec: Omit<GQLDerivedFieldSpec, 'source'> & {
    source: GQLResolversParentTypes['DerivedFieldSource'];
  };
  DerivedFieldSpecInput: GQLDerivedFieldSpecInput;
  DisabledInfo: GQLDisabledInfo;
  DisabledInfoInput: GQLDisabledInfoInput;
  EnqueueAuthorToMrtAction: EnqueueAuthorToMrtAction;
  EnqueueToMrtAction: EnqueueToMrtAction;
  EnqueueToNcmecAction: EnqueueToNcmecAction;
  EnumSignalOutputType: GQLEnumSignalOutputType;
  Error:
    | GQLResolversParentTypes['ActionNameExistsError']
    | GQLResolversParentTypes['AddCommentFailedError']
    | GQLResolversParentTypes['CannotDeleteDefaultUserError']
    | GQLResolversParentTypes['ChangePasswordError']
    | GQLResolversParentTypes['DeleteAllJobsUnauthorizedError']
    | GQLResolversParentTypes['IntegrationConfigTooManyCredentialsError']
    | GQLResolversParentTypes['IntegrationConfigUnsupportedIntegrationError']
    | GQLResolversParentTypes['IntegrationEmptyInputCredentialsError']
    | GQLResolversParentTypes['IntegrationNoInputCredentialsError']
    | GQLResolversParentTypes['InviteUserTokenExpiredError']
    | GQLResolversParentTypes['InviteUserTokenMissingError']
    | GQLResolversParentTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversParentTypes['JobHasAlreadyBeenSubmittedError']
    | GQLResolversParentTypes['LocationBankNameExistsError']
    | GQLResolversParentTypes['LoginIncorrectPasswordError']
    | GQLResolversParentTypes['LoginSsoRequiredError']
    | GQLResolversParentTypes['LoginUserDoesNotExistError']
    | GQLResolversParentTypes['ManualReviewQueueNameExistsError']
    | GQLResolversParentTypes['MatchingBankNameExistsError']
    | GQLResolversParentTypes['NoJobWithIdInQueueError']
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['OrgWithEmailExistsError']
    | GQLResolversParentTypes['OrgWithNameExistsError']
    | GQLResolversParentTypes['PartialItemsEndpointResponseError']
    | GQLResolversParentTypes['PartialItemsInvalidResponseError']
    | GQLResolversParentTypes['PartialItemsMissingEndpointError']
    | GQLResolversParentTypes['PolicyNameExistsError']
    | GQLResolversParentTypes['QueueDoesNotExistError']
    | GQLResolversParentTypes['RecordingJobDecisionFailedError']
    | GQLResolversParentTypes['ReportingRuleNameExistsError']
    | GQLResolversParentTypes['RotateApiKeyError']
    | GQLResolversParentTypes['RoutingRuleNameExistsError']
    | GQLResolversParentTypes['RuleHasRunningBacktestsError']
    | GQLResolversParentTypes['RuleNameExistsError']
    | GQLResolversParentTypes['SignUpUserExistsError']
    | GQLResolversParentTypes['SubmittedJobActionNotFoundError'];
  ExecuteActionResponse: GQLExecuteActionResponse;
  ExecuteBulkActionInput: GQLExecuteBulkActionInput;
  ExecuteBulkActionResponse: GQLExecuteBulkActionResponse;
  ExecuteBulkActionsInput: GQLExecuteBulkActionsInput;
  Field:
    | GQLResolversParentTypes['BaseField']
    | GQLResolversParentTypes['DerivedField'];
  FieldInput: GQLFieldInput;
  Float: Scalars['Float'];
  GetDecisionCountInput: GQLGetDecisionCountInput;
  GetDecisionCountSettings: GQLGetDecisionCountSettings;
  GetDecisionCountsTableInput: GQLGetDecisionCountsTableInput;
  GetFullReportingRuleResultForItemResponse:
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['ReportingRuleExecutionResult'];
  GetFullResultForItemInput: GQLGetFullResultForItemInput;
  GetFullResultForItemResponse:
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['RuleExecutionResult'];
  GetJobCreationCountInput: GQLGetJobCreationCountInput;
  GetJobCreationCountSettings: GQLGetJobCreationCountSettings;
  GetResolvedJobCountInput: GQLGetResolvedJobCountInput;
  GetSkippedJobCountInput: GQLGetSkippedJobCountInput;
  GoogleContentSafetyApiIntegrationApiCredential: GQLGoogleContentSafetyApiIntegrationApiCredential;
  GoogleContentSafetyApiIntegrationApiCredentialInput: GQLGoogleContentSafetyApiIntegrationApiCredentialInput;
  GooglePlaceLocationInfo: GQLGooglePlaceLocationInfo;
  HashBank: HashBank;
  ID: Scalars['ID'];
  IgnoreDecisionComponent: GQLIgnoreDecisionComponent;
  Int: Scalars['Int'];
  IntegrationApiCredential:
    | GQLResolversParentTypes['GoogleContentSafetyApiIntegrationApiCredential']
    | GQLResolversParentTypes['OpenAiIntegrationApiCredential']
    | GQLResolversParentTypes['ZentropiIntegrationApiCredential'];
  IntegrationApiCredentialInput: GQLIntegrationApiCredentialInput;
  IntegrationConfig: Omit<GQLIntegrationConfig, 'apiCredential'> & {
    apiCredential: GQLResolversParentTypes['IntegrationApiCredential'];
  };
  IntegrationConfigQueryResponse:
    | GQLResolversParentTypes['IntegrationConfigSuccessResult']
    | GQLResolversParentTypes['IntegrationConfigUnsupportedIntegrationError'];
  IntegrationConfigSuccessResult: GQLIntegrationConfigSuccessResult;
  IntegrationConfigTooManyCredentialsError: GQLIntegrationConfigTooManyCredentialsError;
  IntegrationConfigUnsupportedIntegrationError: GQLIntegrationConfigUnsupportedIntegrationError;
  IntegrationEmptyInputCredentialsError: GQLIntegrationEmptyInputCredentialsError;
  IntegrationNoInputCredentialsError: GQLIntegrationNoInputCredentialsError;
  InviteUserInput: GQLInviteUserInput;
  InviteUserToken: GQLInviteUserToken;
  InviteUserTokenExpiredError: GQLInviteUserTokenExpiredError;
  InviteUserTokenMissingError: GQLInviteUserTokenMissingError;
  InviteUserTokenResponse:
    | GQLResolversParentTypes['InviteUserTokenExpiredError']
    | GQLResolversParentTypes['InviteUserTokenMissingError']
    | GQLResolversParentTypes['InviteUserTokenSuccessResponse'];
  InviteUserTokenSuccessResponse: GQLInviteUserTokenSuccessResponse;
  IpAddress: GQLIpAddress;
  IpAddressInput: GQLIpAddressInput;
  Item: ItemSubmissionForGQL;
  ItemAction: GQLItemAction;
  ItemBase: ItemSubmissionForGQL;
  ItemHistoryResponse:
    | GQLResolversParentTypes['ItemHistoryResult']
    | GQLResolversParentTypes['NotFoundError'];
  ItemHistoryResult: Omit<GQLItemHistoryResult, 'executions' | 'item'> & {
    executions: ReadonlyArray<GQLResolversParentTypes['RuleExecutionResult']>;
    item: GQLResolversParentTypes['Item'];
  };
  ItemIdentifier: GQLItemIdentifier;
  ItemIdentifierInput: GQLItemIdentifierInput;
  ItemInput: GQLItemInput;
  ItemSubmissions: Omit<GQLItemSubmissions, 'latest' | 'prior'> & {
    latest: GQLResolversParentTypes['Item'];
    prior?: Maybe<ReadonlyArray<GQLResolversParentTypes['Item']>>;
  };
  ItemType: ItemTypeResolversParentType;
  ItemTypeBase: ItemTypeResolversParentType;
  ItemTypeIdentifier: Omit<GQLItemTypeIdentifier, 'version'> & {
    version: GQLResolversParentTypes['NonEmptyString'];
  };
  ItemTypeIdentifierInput: GQLItemTypeIdentifierInput;
  ItemTypeNameAlreadyExistsError: GQLItemTypeNameAlreadyExistsError;
  ItemWithParents: Omit<GQLItemWithParents, 'item' | 'parents'> & {
    item: GQLResolversParentTypes['ItemSubmissions'];
    parents: ReadonlyArray<GQLResolversParentTypes['ItemSubmissions']>;
  };
  JSONObject: Scalars['JSONObject'];
  JobCountFilterByInput: GQLJobCountFilterByInput;
  JobCreationCount: GQLJobCreationCount;
  JobCreationFilterBy: GQLJobCreationFilterBy;
  JobCreationFilterByInput: GQLJobCreationFilterByInput;
  JobCreationSettingsInput: GQLJobCreationSettingsInput;
  JobHasAlreadyBeenSubmittedError: GQLJobHasAlreadyBeenSubmittedError;
  Languages: GQLLanguages;
  LatLng: GQLLatLng;
  LatLngInput: GQLLatLngInput;
  LeafCondition: LeafCondition;
  LeafConditionWithResult: LeafConditionWithResult;
  LocationArea: GQLLocationArea;
  LocationAreaInput: GQLLocationAreaInput;
  LocationBank: LocationBankWithoutFullPlacesAPIResponse;
  LocationBankNameExistsError: GQLLocationBankNameExistsError;
  LocationGeometry: GQLLocationGeometry;
  LocationGeometryInput: GQLLocationGeometryInput;
  LogSkipInput: GQLLogSkipInput;
  LoginIncorrectPasswordError: GQLLoginIncorrectPasswordError;
  LoginInput: GQLLoginInput;
  LoginResponse:
    | GQLResolversParentTypes['LoginIncorrectPasswordError']
    | GQLResolversParentTypes['LoginSsoRequiredError']
    | GQLResolversParentTypes['LoginSuccessResponse']
    | GQLResolversParentTypes['LoginUserDoesNotExistError'];
  LoginSsoRequiredError: GQLLoginSsoRequiredError;
  LoginSuccessResponse: Omit<GQLLoginSuccessResponse, 'user'> & {
    user: GQLResolversParentTypes['User'];
  };
  LoginUserDoesNotExistError: GQLLoginUserDoesNotExistError;
  ManualReviewChartConfigurationsInput: GQLManualReviewChartConfigurationsInput;
  ManualReviewChartSettings:
    | GQLResolversParentTypes['GetDecisionCountSettings']
    | GQLResolversParentTypes['GetJobCreationCountSettings'];
  ManualReviewChartSettingsInput: GQLManualReviewChartSettingsInput;
  ManualReviewDecision: Omit<
    GQLManualReviewDecision,
    'decisions' | 'relatedActions'
  > & {
    decisions: ReadonlyArray<
      GQLResolversParentTypes['ManualReviewDecisionComponent']
    >;
    relatedActions: ReadonlyArray<
      GQLResolversParentTypes['ManualReviewDecisionComponent']
    >;
  };
  ManualReviewDecisionComponent:
    | GQLResolversParentTypes['AcceptAppealDecisionComponent']
    | GQLResolversParentTypes['AutomaticCloseDecisionComponent']
    | GQLResolversParentTypes['IgnoreDecisionComponent']
    | GQLResolversParentTypes['RejectAppealDecisionComponent']
    | GQLResolversParentTypes['SubmitNCMECReportDecisionComponent']
    | GQLResolversParentTypes['TransformJobAndRecreateInQueueDecisionComponent']
    | GQLResolversParentTypes['UserOrRelatedActionDecisionComponent'];
  ManualReviewDecisionComponentBase:
    | GQLResolversParentTypes['AcceptAppealDecisionComponent']
    | GQLResolversParentTypes['AutomaticCloseDecisionComponent']
    | GQLResolversParentTypes['IgnoreDecisionComponent']
    | GQLResolversParentTypes['RejectAppealDecisionComponent']
    | GQLResolversParentTypes['SubmitNCMECReportDecisionComponent']
    | GQLResolversParentTypes['TransformJobAndRecreateInQueueDecisionComponent']
    | GQLResolversParentTypes['UserOrRelatedActionDecisionComponent'];
  ManualReviewExistingJob: Omit<GQLManualReviewExistingJob, 'job'> & {
    job: GQLResolversParentTypes['ManualReviewJob'];
  };
  ManualReviewJob: ManualReviewJobOrAppeal;
  ManualReviewJobComment: ManualReviewJobComment;
  ManualReviewJobEnqueueSourceInfo:
    | GQLResolversParentTypes['AppealEnqueueSourceInfo']
    | GQLResolversParentTypes['MrtJobEnqueueSourceInfo']
    | GQLResolversParentTypes['PostActionsEnqueueSourceInfo']
    | GQLResolversParentTypes['ReportEnqueueSourceInfo']
    | GQLResolversParentTypes['RuleExecutionEnqueueSourceInfo'];
  ManualReviewJobPayload: ManualReviewJobPayload;
  ManualReviewJobWithDecisions: Omit<GQLManualReviewJobWithDecisions, 'job'> & {
    job: GQLResolversParentTypes['ManualReviewJob'];
  };
  ManualReviewQueue: ManualReviewQueue;
  ManualReviewQueueNameExistsError: GQLManualReviewQueueNameExistsError;
  MatchingBankNameExistsError: GQLMatchingBankNameExistsError;
  MatchingBanks: Org;
  MatchingValues: GQLMatchingValues;
  MessageWithIpAddress: Omit<GQLMessageWithIpAddress, 'message'> & {
    message: GQLResolversParentTypes['ContentItem'];
  };
  ModeratorSafetySettingsInput: GQLModeratorSafetySettingsInput;
  MrtJobEnqueueSourceInfo: GQLMrtJobEnqueueSourceInfo;
  MutateAccessibleQueuesForUserSuccessResponse: GQLMutateAccessibleQueuesForUserSuccessResponse;
  MutateActionResponse:
    | GQLResolversParentTypes['ActionNameExistsError']
    | GQLResolversParentTypes['MutateActionSuccessResponse'];
  MutateActionSuccessResponse: Omit<GQLMutateActionSuccessResponse, 'data'> & {
    data: GQLResolversParentTypes['CustomAction'];
  };
  MutateBankResponse: GQLMutateBankResponse;
  MutateContentItemTypeResponse:
    | GQLResolversParentTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversParentTypes['MutateContentTypeSuccessResponse'];
  MutateContentRuleSuccessResponse: Omit<
    GQLMutateContentRuleSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['ContentRule'] };
  MutateContentTypeSuccessResponse: Omit<
    GQLMutateContentTypeSuccessResponse,
    'data'
  > & { data?: Maybe<GQLResolversParentTypes['ContentItemType']> };
  MutateHashBankResponse:
    | GQLResolversParentTypes['MatchingBankNameExistsError']
    | GQLResolversParentTypes['MutateHashBankSuccessResponse'];
  MutateHashBankSuccessResponse: Omit<
    GQLMutateHashBankSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['HashBank'] };
  MutateLocationBankResponse:
    | GQLResolversParentTypes['LocationBankNameExistsError']
    | GQLResolversParentTypes['MutateLocationBankSuccessResponse'];
  MutateLocationBankSuccessResponse: Omit<
    GQLMutateLocationBankSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['LocationBank'] };
  MutateManualReviewQueueSuccessResponse: Omit<
    GQLMutateManualReviewQueueSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['ManualReviewQueue'] };
  MutateReportingRuleSuccessResponse: Omit<
    GQLMutateReportingRuleSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['ReportingRule'] };
  MutateRoutingRuleSuccessResponse: Omit<
    GQLMutateRoutingRuleSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['RoutingRule'] };
  MutateRoutingRulesOrderSuccessResponse: Omit<
    GQLMutateRoutingRulesOrderSuccessResponse,
    'data'
  > & { data: ReadonlyArray<GQLResolversParentTypes['RoutingRule']> };
  MutateThreadItemTypeResponse:
    | GQLResolversParentTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversParentTypes['MutateThreadTypeSuccessResponse'];
  MutateThreadTypeSuccessResponse: Omit<
    GQLMutateThreadTypeSuccessResponse,
    'data'
  > & { data?: Maybe<GQLResolversParentTypes['ThreadItemType']> };
  MutateUserItemTypeResponse:
    | GQLResolversParentTypes['ItemTypeNameAlreadyExistsError']
    | GQLResolversParentTypes['MutateUserTypeSuccessResponse'];
  MutateUserRuleSuccessResponse: Omit<
    GQLMutateUserRuleSuccessResponse,
    'data'
  > & { data: GQLResolversParentTypes['UserRule'] };
  MutateUserTypeSuccessResponse: Omit<
    GQLMutateUserTypeSuccessResponse,
    'data'
  > & { data?: Maybe<GQLResolversParentTypes['UserItemType']> };
  Mutation: {};
  NCMECReport: Omit<GQLNcmecReport, 'userItemType'> & {
    userItemType: GQLResolversParentTypes['UserItemType'];
  };
  NCMECReportedMedia: GQLNcmecReportedMedia;
  NCMECReportedThread: GQLNcmecReportedThread;
  NcmecAdditionalFile: GQLNcmecAdditionalFile;
  NcmecContentInThreadReport: GQLNcmecContentInThreadReport;
  NcmecContentItem: Omit<GQLNcmecContentItem, 'contentItem'> & {
    contentItem: GQLResolversParentTypes['Item'];
  };
  NcmecManualReviewJobPayload: NcmecManualReviewJobPayload;
  NcmecMediaInput: GQLNcmecMediaInput;
  NcmecOrgSettings: GQLNcmecOrgSettings;
  NcmecOrgSettingsInput: GQLNcmecOrgSettingsInput;
  NcmecReportedMediaDetails: GQLNcmecReportedMediaDetails;
  NcmecThreadInput: GQLNcmecThreadInput;
  NoJobWithIdInQueueError: GQLNoJobWithIdInQueueError;
  NonEmptyString: NonEmptyString;
  NotFoundError: GQLNotFoundError;
  Notification: Notification;
  OpenAiIntegrationApiCredential: GQLOpenAiIntegrationApiCredential;
  OpenAiIntegrationApiCredentialInput: GQLOpenAiIntegrationApiCredentialInput;
  Org: Org;
  OrgWithEmailExistsError: GQLOrgWithEmailExistsError;
  OrgWithNameExistsError: GQLOrgWithNameExistsError;
  PageInfo: GQLPageInfo;
  PartialItemsEndpointResponseError: GQLPartialItemsEndpointResponseError;
  PartialItemsInvalidResponseError: GQLPartialItemsInvalidResponseError;
  PartialItemsMissingEndpointError: GQLPartialItemsMissingEndpointError;
  PartialItemsResponse:
    | GQLResolversParentTypes['PartialItemsEndpointResponseError']
    | GQLResolversParentTypes['PartialItemsInvalidResponseError']
    | GQLResolversParentTypes['PartialItemsMissingEndpointError']
    | GQLResolversParentTypes['PartialItemsSuccessResponse'];
  PartialItemsSuccessResponse: Omit<GQLPartialItemsSuccessResponse, 'items'> & {
    items: ReadonlyArray<GQLResolversParentTypes['Item']>;
  };
  PendingInvite: GQLPendingInvite;
  PlaceBounds: GQLPlaceBounds;
  PlaceBoundsInput: GQLPlaceBoundsInput;
  Policy: GQLPolicy;
  PolicyActionCount: GQLPolicyActionCount;
  PolicyNameExistsError: GQLPolicyNameExistsError;
  PolicyViolationsCount: GQLPolicyViolationsCount;
  PostActionsEnqueueSourceInfo: GQLPostActionsEnqueueSourceInfo;
  Query: {};
  QueueDoesNotExistError: GQLQueueDoesNotExistError;
  RecentDecisionsFilterInput: GQLRecentDecisionsFilterInput;
  RecentDecisionsForUser: GQLRecentDecisionsForUser;
  RecentDecisionsInput: GQLRecentDecisionsInput;
  RecentManualReviewAcceptAppealDecision: GQLRecentManualReviewAcceptAppealDecision;
  RecentManualReviewAutomaticCloseDecision: GQLRecentManualReviewAutomaticCloseDecision;
  RecentManualReviewDecisionType: GQLRecentManualReviewDecisionType;
  RecentManualReviewIgnoreDecision: GQLRecentManualReviewIgnoreDecision;
  RecentManualReviewRejectAppealDecision: GQLRecentManualReviewRejectAppealDecision;
  RecentManualReviewSubmitNCMECReportDecision: GQLRecentManualReviewSubmitNcmecReportDecision;
  RecentManualReviewTransformJobAndRecreateInQueueDecision: GQLRecentManualReviewTransformJobAndRecreateInQueueDecision;
  RecentManualReviewUserOrRelatedActionDecision: GQLRecentManualReviewUserOrRelatedActionDecision;
  RecentUserStrikeActions: GQLRecentUserStrikeActions;
  RecentUserStrikeActionsInput: GQLRecentUserStrikeActionsInput;
  RecommendedThresholds: GQLRecommendedThresholds;
  RecordingJobDecisionFailedError: GQLRecordingJobDecisionFailedError;
  RejectAppealDecisionComponent: GQLRejectAppealDecisionComponent;
  ReleaseJobLockInput: GQLReleaseJobLockInput;
  RemoveAccessibleQueuesToUserInput: GQLRemoveAccessibleQueuesToUserInput;
  RemoveAccessibleQueuesToUserResponse:
    | GQLResolversParentTypes['MutateAccessibleQueuesForUserSuccessResponse']
    | GQLResolversParentTypes['NotFoundError'];
  RemoveFavoriteMRTQueueSuccessResponse: GQLRemoveFavoriteMrtQueueSuccessResponse;
  RemoveFavoriteRuleResponse: GQLResolversParentTypes['RemoveFavoriteRuleSuccessResponse'];
  RemoveFavoriteRuleSuccessResponse: GQLRemoveFavoriteRuleSuccessResponse;
  ReorderRoutingRulesInput: GQLReorderRoutingRulesInput;
  ReorderRoutingRulesResponse: GQLResolversParentTypes['MutateRoutingRulesOrderSuccessResponse'];
  ReportEnqueueSourceInfo: GQLReportEnqueueSourceInfo;
  ReportHistoryEntry: GQLReportHistoryEntry;
  ReportHistoryEntryInput: GQLReportHistoryEntryInput;
  ReportedForReason: GQLReportedForReason;
  ReporterIdInput: GQLReporterIdInput;
  ReportingInsights: ReportingInsights;
  ReportingRule: ReportingRuleWithoutVersion;
  ReportingRuleExecutionResult: Omit<
    GQLReportingRuleExecutionResult,
    'result' | 'signalResults'
  > & {
    result?: Maybe<GQLResolversParentTypes['ConditionSetWithResult']>;
    signalResults?: Maybe<
      ReadonlyArray<GQLResolversParentTypes['SignalWithScore']>
    >;
  };
  ReportingRuleInsights: ReportingRuleWithoutVersion;
  ReportingRuleNameExistsError: GQLReportingRuleNameExistsError;
  ReportingRulePassRateData: GQLReportingRulePassRateData;
  RequestDemoInput: GQLRequestDemoInput;
  ResetPasswordInput: GQLResetPasswordInput;
  ResolvedJobCount: GQLResolvedJobCount;
  RotateApiKeyError: GQLRotateApiKeyError;
  RotateApiKeyInput: GQLRotateApiKeyInput;
  RotateApiKeyResponse:
    | GQLResolversParentTypes['RotateApiKeyError']
    | GQLResolversParentTypes['RotateApiKeySuccessResponse'];
  RotateApiKeySuccessResponse: GQLRotateApiKeySuccessResponse;
  RoutingRule: RoutingRuleWithoutVersion;
  RoutingRuleNameExistsError: GQLRoutingRuleNameExistsError;
  Rule: Rule;
  RuleExecutionEnqueueSourceInfo: Omit<
    GQLRuleExecutionEnqueueSourceInfo,
    'rules'
  > & { rules: ReadonlyArray<GQLResolversParentTypes['Rule']> };
  RuleExecutionResult: Omit<
    GQLRuleExecutionResult,
    'result' | 'signalResults'
  > & {
    result?: Maybe<GQLResolversParentTypes['ConditionSetWithResult']>;
    signalResults?: Maybe<
      ReadonlyArray<GQLResolversParentTypes['SignalWithScore']>
    >;
  };
  RuleExecutionResultEdge: Omit<GQLRuleExecutionResultEdge, 'node'> & {
    node: GQLResolversParentTypes['RuleExecutionResult'];
  };
  RuleExecutionResultsConnection: Omit<
    GQLRuleExecutionResultsConnection,
    'edges'
  > & {
    edges: ReadonlyArray<GQLResolversParentTypes['RuleExecutionResultEdge']>;
  };
  RuleHasRunningBacktestsError: GQLRuleHasRunningBacktestsError;
  RuleInsights: Rule;
  RuleNameExistsError: GQLRuleNameExistsError;
  RulePassRateData: GQLRulePassRateData;
  RunRetroactionInput: GQLRunRetroactionInput;
  RunRetroactionResponse: GQLResolversParentTypes['RunRetroactionSuccessResponse'];
  RunRetroactionSuccessResponse: GQLRunRetroactionSuccessResponse;
  ScalarSignalOutputType: GQLScalarSignalOutputType;
  SchemaFieldRoles:
    | GQLResolversParentTypes['ContentSchemaFieldRoles']
    | GQLResolversParentTypes['ThreadSchemaFieldRoles']
    | GQLResolversParentTypes['UserSchemaFieldRoles'];
  SendPasswordResetInput: GQLSendPasswordResetInput;
  SetAllUserStrikeThresholdsInput: GQLSetAllUserStrikeThresholdsInput;
  SetAllUserStrikeThresholdsSuccessResponse: GQLSetAllUserStrikeThresholdsSuccessResponse;
  SetIntegrationConfigInput: GQLSetIntegrationConfigInput;
  SetIntegrationConfigResponse:
    | GQLResolversParentTypes['IntegrationConfigTooManyCredentialsError']
    | GQLResolversParentTypes['IntegrationEmptyInputCredentialsError']
    | GQLResolversParentTypes['IntegrationNoInputCredentialsError']
    | GQLResolversParentTypes['SetIntegrationConfigSuccessResponse'];
  SetIntegrationConfigSuccessResponse: GQLSetIntegrationConfigSuccessResponse;
  SetModeratorSafetySettingsSuccessResponse: GQLSetModeratorSafetySettingsSuccessResponse;
  SetMrtChartConfigurationSettingsSuccessResponse: GQLSetMrtChartConfigurationSettingsSuccessResponse;
  SetUserStrikeThresholdInput: GQLSetUserStrikeThresholdInput;
  SignUpInput: GQLSignUpInput;
  SignUpResponse:
    | GQLResolversParentTypes['SignUpSuccessResponse']
    | GQLResolversParentTypes['SignUpUserExistsError'];
  SignUpSuccessResponse: Omit<GQLSignUpSuccessResponse, 'data'> & {
    data?: Maybe<GQLResolversParentTypes['User']>;
  };
  SignUpUserExistsError: GQLSignUpUserExistsError;
  Signal: Signal;
  SignalArgs: GQLResolversParentTypes['AggregationSignalArgs'];
  SignalArgsInput: GQLSignalArgsInput;
  SignalOutputType:
    | GQLResolversParentTypes['EnumSignalOutputType']
    | GQLResolversParentTypes['ScalarSignalOutputType'];
  SignalPricingStructure: GQLSignalPricingStructure;
  SignalSubcategory: GQLSignalSubcategory;
  SignalSubcategoryInput: GQLSignalSubcategoryInput;
  SignalSubcategoryOptionInput: GQLSignalSubcategoryOptionInput;
  SignalWithScore: SignalWithScore;
  SkippedJob: GQLSkippedJob;
  SkippedJobCount: GQLSkippedJobCount;
  SkippedJobFilterByInput: GQLSkippedJobFilterByInput;
  SpotTestItemInput: GQLSpotTestItemInput;
  StartAndEndDateFilterByInput: GQLStartAndEndDateFilterByInput;
  String: Scalars['String'];
  StringOrFloat: Scalars['StringOrFloat'];
  SubmitAppealDecisionInput: GQLSubmitAppealDecisionInput;
  SubmitDecisionInput: GQLSubmitDecisionInput;
  SubmitDecisionResponse:
    | GQLResolversParentTypes['JobHasAlreadyBeenSubmittedError']
    | GQLResolversParentTypes['NoJobWithIdInQueueError']
    | GQLResolversParentTypes['RecordingJobDecisionFailedError']
    | GQLResolversParentTypes['SubmitDecisionSuccessResponse']
    | GQLResolversParentTypes['SubmittedJobActionNotFoundError'];
  SubmitDecisionSuccessResponse: GQLSubmitDecisionSuccessResponse;
  SubmitNCMECReportDecisionComponent: GQLSubmitNcmecReportDecisionComponent;
  SubmitNcmecReportInput: GQLSubmitNcmecReportInput;
  SubmittedJobActionNotFoundError: GQLSubmittedJobActionNotFoundError;
  SupportedLanguages:
    | GQLResolversParentTypes['AllLanguages']
    | GQLResolversParentTypes['Languages'];
  TableDecisionCount: GQLTableDecisionCount;
  TextBank: GQLTextBank;
  ThreadAppealManualReviewJobPayload: ThreadAppealReviewJobPayload;
  ThreadItem: Omit<GQLThreadItem, 'type'> & {
    type: GQLResolversParentTypes['ThreadItemType'];
  };
  ThreadItemType: ThreadItemTypeResolversParentType;
  ThreadManualReviewJobPayload: ThreadManualReviewJobPayload;
  ThreadSchemaFieldRoles: GQLThreadSchemaFieldRoles;
  ThreadSchemaFieldRolesInput: GQLThreadSchemaFieldRolesInput;
  ThreadWithMessages: Omit<GQLThreadWithMessages, 'messages'> & {
    messages: ReadonlyArray<GQLResolversParentTypes['ItemSubmissions']>;
  };
  ThreadWithMessagesAndIpAddress: Omit<
    GQLThreadWithMessagesAndIpAddress,
    'messages'
  > & {
    messages: ReadonlyArray<GQLResolversParentTypes['MessageWithIpAddress']>;
  };
  TimeToAction: GQLTimeToAction;
  TimeToActionFilterByInput: GQLTimeToActionFilterByInput;
  TimeToActionInput: GQLTimeToActionInput;
  TopPolicyViolationsInput: GQLTopPolicyViolationsInput;
  TransformJobAndRecreateInQueue: GQLTransformJobAndRecreateInQueue;
  TransformJobAndRecreateInQueueDecisionComponent: GQLTransformJobAndRecreateInQueueDecisionComponent;
  UpdateActionInput: GQLUpdateActionInput;
  UpdateContentItemTypeInput: GQLUpdateContentItemTypeInput;
  UpdateContentRuleInput: GQLUpdateContentRuleInput;
  UpdateContentRuleResponse:
    | GQLResolversParentTypes['MutateContentRuleSuccessResponse']
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['RuleHasRunningBacktestsError']
    | GQLResolversParentTypes['RuleNameExistsError'];
  UpdateHashBankInput: GQLUpdateHashBankInput;
  UpdateLocationBankInput: GQLUpdateLocationBankInput;
  UpdateManualReviewQueueInput: GQLUpdateManualReviewQueueInput;
  UpdateManualReviewQueueQueueResponse:
    | GQLResolversParentTypes['ManualReviewQueueNameExistsError']
    | GQLResolversParentTypes['MutateManualReviewQueueSuccessResponse']
    | GQLResolversParentTypes['NotFoundError'];
  UpdateNcmecOrgSettingsResponse: GQLUpdateNcmecOrgSettingsResponse;
  UpdateOrgInfoInput: GQLUpdateOrgInfoInput;
  UpdateOrgInfoSuccessResponse: GQLUpdateOrgInfoSuccessResponse;
  UpdatePolicyInput: GQLUpdatePolicyInput;
  UpdatePolicyResponse:
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['Policy'];
  UpdateReportingRuleInput: GQLUpdateReportingRuleInput;
  UpdateReportingRuleResponse:
    | GQLResolversParentTypes['MutateReportingRuleSuccessResponse']
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['ReportingRuleNameExistsError'];
  UpdateRoleInput: GQLUpdateRoleInput;
  UpdateRoutingRuleInput: GQLUpdateRoutingRuleInput;
  UpdateRoutingRuleResponse:
    | GQLResolversParentTypes['MutateRoutingRuleSuccessResponse']
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['QueueDoesNotExistError']
    | GQLResolversParentTypes['RoutingRuleNameExistsError'];
  UpdateSSOCredentialsInput: GQLUpdateSsoCredentialsInput;
  UpdateTextBankInput: GQLUpdateTextBankInput;
  UpdateThreadItemTypeInput: GQLUpdateThreadItemTypeInput;
  UpdateUserItemTypeInput: GQLUpdateUserItemTypeInput;
  UpdateUserRuleInput: GQLUpdateUserRuleInput;
  UpdateUserRuleResponse:
    | GQLResolversParentTypes['MutateUserRuleSuccessResponse']
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['RuleHasRunningBacktestsError']
    | GQLResolversParentTypes['RuleNameExistsError'];
  UpdateUserStrikeTTLInput: GQLUpdateUserStrikeTtlInput;
  UpdateUserStrikeTTLSuccessResponse: GQLUpdateUserStrikeTtlSuccessResponse;
  User: User;
  UserActionDecisionAction: GQLUserActionDecisionAction;
  UserActionDecisionPolicy: GQLUserActionDecisionPolicy;
  UserActionsHistory: GQLUserActionsHistory;
  UserAppealManualReviewJobPayload: UserAppealReviewJobPayload;
  UserHistory: UserHistoryForGQL;
  UserHistoryResponse:
    | GQLResolversParentTypes['NotFoundError']
    | GQLResolversParentTypes['UserHistory'];
  UserInterfacePreferences: Omit<
    GQLUserInterfacePreferences,
    'mrtChartConfigurations'
  > & {
    mrtChartConfigurations: ReadonlyArray<
      GQLResolversParentTypes['ManualReviewChartSettings']
    >;
  };
  UserItem: ItemSubmissionForGQL;
  UserItemType: UserItemTypeResolversParentType;
  UserManualReviewJobPayload: UserManualReviewJobPayload;
  UserNotificationEdge: Omit<GQLUserNotificationEdge, 'node'> & {
    node: GQLResolversParentTypes['Notification'];
  };
  UserNotifications: Omit<GQLUserNotifications, 'edges'> & {
    edges: ReadonlyArray<GQLResolversParentTypes['UserNotificationEdge']>;
  };
  UserOrRelatedActionDecisionComponent: GQLUserOrRelatedActionDecisionComponent;
  UserRule: Rule;
  UserSchemaFieldRoles: GQLUserSchemaFieldRoles;
  UserSchemaFieldRolesInput: GQLUserSchemaFieldRolesInput;
  UserStrikeBucket: GQLUserStrikeBucket;
  UserStrikeThreshold: GQLUserStrikeThreshold;
  UserSubmissionCount: GQLUserSubmissionCount;
  UserSubmissionsHistory: GQLUserSubmissionsHistory;
  WindowConfiguration: GQLWindowConfiguration;
  WindowConfigurationInput: GQLWindowConfigurationInput;
  ZentropiIntegrationApiCredential: GQLZentropiIntegrationApiCredential;
  ZentropiIntegrationApiCredentialInput: GQLZentropiIntegrationApiCredentialInput;
  ZentropiLabelerVersion: GQLZentropiLabelerVersion;
  ZentropiLabelerVersionInput: GQLZentropiLabelerVersionInput;
};

export type GQLPublicResolverDirectiveArgs = {};

export type GQLPublicResolverDirectiveResolver<
  Result,
  Parent,
  ContextType = Context,
  Args = GQLPublicResolverDirectiveArgs,
> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type GQLAcceptAppealDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AcceptAppealDecisionComponent'] = GQLResolversParentTypes['AcceptAppealDecisionComponent'],
> = {
  actionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Action'] = GQLResolversParentTypes['Action'],
> = {
  __resolveType: TypeResolveFn<
    | 'CustomAction'
    | 'EnqueueAuthorToMrtAction'
    | 'EnqueueToMrtAction'
    | 'EnqueueToNcmecAction',
    ParentType,
    ContextType
  >;
};

export type GQLActionBaseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ActionBase'] = GQLResolversParentTypes['ActionBase'],
> = {
  __resolveType: TypeResolveFn<
    | 'CustomAction'
    | 'EnqueueAuthorToMrtAction'
    | 'EnqueueToMrtAction'
    | 'EnqueueToNcmecAction',
    ParentType,
    ContextType
  >;
  applyUserStrikes?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  penalty?: Resolver<
    GQLResolversTypes['UserPenaltySeverity'],
    ParentType,
    ContextType
  >;
};

export type GQLActionDataResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ActionData'] = GQLResolversParentTypes['ActionData'],
> = {
  action_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  item_type_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policy_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  rule_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  source?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  time?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLActionNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ActionNameExistsError'] = GQLResolversParentTypes['ActionNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAddAccessibleQueuesToUserResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddAccessibleQueuesToUserResponse'] = GQLResolversParentTypes['AddAccessibleQueuesToUserResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateAccessibleQueuesForUserSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLAddCommentFailedErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddCommentFailedError'] = GQLResolversParentTypes['AddCommentFailedError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAddFavoriteMrtQueueSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddFavoriteMRTQueueSuccessResponse'] = GQLResolversParentTypes['AddFavoriteMRTQueueSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAddFavoriteRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddFavoriteRuleResponse'] = GQLResolversParentTypes['AddFavoriteRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    'AddFavoriteRuleSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLAddFavoriteRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddFavoriteRuleSuccessResponse'] = GQLResolversParentTypes['AddFavoriteRuleSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAddManualReviewJobCommentResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddManualReviewJobCommentResponse'] = GQLResolversParentTypes['AddManualReviewJobCommentResponse'],
> = {
  __resolveType: TypeResolveFn<
    'AddManualReviewJobCommentSuccessResponse' | 'NotFoundError',
    ParentType,
    ContextType
  >;
};

export type GQLAddManualReviewJobCommentSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddManualReviewJobCommentSuccessResponse'] = GQLResolversParentTypes['AddManualReviewJobCommentSuccessResponse'],
> = {
  comment?: Resolver<
    GQLResolversTypes['ManualReviewJobComment'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAddPoliciesResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AddPoliciesResponse'] = GQLResolversParentTypes['AddPoliciesResponse'],
> = {
  failures?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAggregationResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Aggregation'] = GQLResolversParentTypes['Aggregation'],
> = {
  type?: Resolver<
    GQLResolversTypes['AggregationType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAggregationClauseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AggregationClause'] = GQLResolversParentTypes['AggregationClause'],
> = {
  aggregation?: Resolver<
    Maybe<GQLResolversTypes['Aggregation']>,
    ParentType,
    ContextType
  >;
  conditionSet?: Resolver<
    Maybe<GQLResolversTypes['ConditionSet']>,
    ParentType,
    ContextType
  >;
  groupBy?: Resolver<
    ReadonlyArray<GQLResolversTypes['ConditionInputField']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  window?: Resolver<
    GQLResolversTypes['WindowConfiguration'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAggregationSignalArgsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AggregationSignalArgs'] = GQLResolversParentTypes['AggregationSignalArgs'],
> = {
  aggregationClause?: Resolver<
    Maybe<GQLResolversTypes['AggregationClause']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAllLanguagesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AllLanguages'] = GQLResolversParentTypes['AllLanguages'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAllRuleInsightsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AllRuleInsights'] = GQLResolversParentTypes['AllRuleInsights'],
> = {
  actionedSubmissionsByActionByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByActionByDay']>,
    ParentType,
    ContextType
  >;
  actionedSubmissionsByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByDay']>,
    ParentType,
    ContextType
  >;
  actionedSubmissionsByPolicyByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByPolicyByDay']>,
    ParentType,
    ContextType
  >;
  actionedSubmissionsByTagByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByTagByDay']>,
    ParentType,
    ContextType
  >;
  totalSubmissionsByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByDay']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLApiKeyResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ApiKey'] = GQLResolversParentTypes['ApiKey'],
> = {
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  createdBy?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  lastUsedAt?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAppealEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AppealEnqueueSourceInfo'] = GQLResolversParentTypes['AppealEnqueueSourceInfo'],
> = {
  kind?: Resolver<
    GQLResolversTypes['JobCreationSourceOptions'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAppealSettingsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AppealSettings'] = GQLResolversParentTypes['AppealSettings'],
> = {
  appealsCallbackBody?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  appealsCallbackHeaders?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  appealsCallbackUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLAutomaticCloseDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['AutomaticCloseDecisionComponent'] = GQLResolversParentTypes['AutomaticCloseDecisionComponent'],
> = {
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLBacktestResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Backtest'] = GQLResolversParentTypes['Backtest'],
> = {
  contentItemsMatched?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  contentItemsProcessed?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  results?: Resolver<
    Maybe<GQLResolversTypes['RuleExecutionResultsConnection']>,
    ParentType,
    ContextType,
    Partial<GQLBacktestResultsArgs>
  >;
  sampleActualSize?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  sampleDesiredSize?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  sampleEndAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  sampleStartAt?: Resolver<
    GQLResolversTypes['String'],
    ParentType,
    ContextType
  >;
  samplingComplete?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  status?: Resolver<
    GQLResolversTypes['BacktestStatus'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLBaseFieldResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['BaseField'] = GQLResolversParentTypes['BaseField'],
> = {
  container?: Resolver<
    Maybe<GQLResolversTypes['Container']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  required?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  type?: Resolver<GQLResolversTypes['FieldType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCannotDeleteDefaultUserErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CannotDeleteDefaultUserError'] = GQLResolversParentTypes['CannotDeleteDefaultUserError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLChangePasswordErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ChangePasswordError'] = GQLResolversParentTypes['ChangePasswordError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLChangePasswordResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ChangePasswordResponse'] = GQLResolversParentTypes['ChangePasswordResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ChangePasswordError' | 'ChangePasswordSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLChangePasswordSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ChangePasswordSuccessResponse'] = GQLResolversParentTypes['ChangePasswordSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLConditionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Condition'] = GQLResolversParentTypes['Condition'],
> = {
  __resolveType: TypeResolveFn<
    'ConditionSet' | 'LeafCondition',
    ParentType,
    ContextType
  >;
};

export type GQLConditionInputFieldResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ConditionInputField'] = GQLResolversParentTypes['ConditionInputField'],
> = {
  contentTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  contentTypeIds?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  name?: Resolver<
    Maybe<GQLResolversTypes['CoopInputOrString']>,
    ParentType,
    ContextType
  >;
  spec?: Resolver<
    Maybe<GQLResolversTypes['DerivedFieldSpec']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ConditionInputInputType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLConditionResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ConditionResult'] = GQLResolversParentTypes['ConditionResult'],
> = {
  matchedValue?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  outcome?: Resolver<
    GQLResolversTypes['ConditionOutcome'],
    ParentType,
    ContextType
  >;
  score?: Resolver<Maybe<GQLResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLConditionSetResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ConditionSet'] = GQLResolversParentTypes['ConditionSet'],
> = {
  conditions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Condition']>,
    ParentType,
    ContextType
  >;
  conjunction?: Resolver<
    GQLResolversTypes['ConditionConjunction'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLConditionSetWithResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ConditionSetWithResult'] = GQLResolversParentTypes['ConditionSetWithResult'],
> = {
  conditions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ConditionWithResult']>,
    ParentType,
    ContextType
  >;
  conjunction?: Resolver<
    Maybe<GQLResolversTypes['ConditionConjunction']>,
    ParentType,
    ContextType
  >;
  result?: Resolver<
    Maybe<GQLResolversTypes['ConditionResult']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLConditionWithResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ConditionWithResult'] = GQLResolversParentTypes['ConditionWithResult'],
> = {
  __resolveType: TypeResolveFn<
    'ConditionSetWithResult' | 'LeafConditionWithResult',
    ParentType,
    ContextType
  >;
};

export type GQLContainerResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Container'] = GQLResolversParentTypes['Container'],
> = {
  containerType?: Resolver<
    GQLResolversTypes['ContainerType'],
    ParentType,
    ContextType
  >;
  keyScalarType?: Resolver<
    Maybe<GQLResolversTypes['ScalarType']>,
    ParentType,
    ContextType
  >;
  valueScalarType?: Resolver<
    GQLResolversTypes['ScalarType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentAppealManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentAppealManualReviewJobPayload'] = GQLResolversParentTypes['ContentAppealManualReviewJobPayload'],
> = {
  actionsTaken?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  additionalContentItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ContentItem']>,
    ParentType,
    ContextType
  >;
  appealId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  appealReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealerIdentifier?: Resolver<
    Maybe<GQLResolversTypes['ItemIdentifier']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['AppealEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['ContentItem'], ParentType, ContextType>;
  userScore?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentItemResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentItem'] = GQLResolversParentTypes['ContentItem'],
> = {
  data?: Resolver<GQLResolversTypes['JSONObject'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionTime?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ContentItemType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentItemTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentItemType'] = GQLResolversParentTypes['ContentItemType'],
> = {
  baseFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['BaseField']>,
    ParentType,
    ContextType
  >;
  derivedFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['DerivedField']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  hiddenFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  schemaFieldRoles?: Resolver<
    GQLResolversTypes['ContentSchemaFieldRoles'],
    ParentType,
    ContextType
  >;
  schemaVariant?: Resolver<
    GQLResolversTypes['ItemTypeSchemaVariant'],
    ParentType,
    ContextType
  >;
  version?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentManualReviewJobPayload'] = GQLResolversParentTypes['ContentManualReviewJobPayload'],
> = {
  additionalContentItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ContentItem']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJobEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['ContentItem'], ParentType, ContextType>;
  itemThreadContentItems?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['ContentItem']>>,
    ParentType,
    ContextType
  >;
  reportHistory?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportHistoryEntry']>,
    ParentType,
    ContextType
  >;
  reportedForReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reportedForReasons?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportedForReason']>,
    ParentType,
    ContextType
  >;
  userScore?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentRuleResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentRule'] = GQLResolversParentTypes['ContentRule'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  backtests?: Resolver<
    ReadonlyArray<GQLResolversTypes['Backtest']>,
    ParentType,
    ContextType,
    Partial<GQLContentRuleBacktestsArgs>
  >;
  conditionSet?: Resolver<
    GQLResolversTypes['ConditionSet'],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  creator?: Resolver<GQLResolversTypes['User'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  expirationTime?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  insights?: Resolver<
    GQLResolversTypes['RuleInsights'],
    ParentType,
    ContextType
  >;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  maxDailyActions?: Resolver<
    Maybe<GQLResolversTypes['Float']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['RuleStatus'], ParentType, ContextType>;
  tags?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['String']>>>,
    ParentType,
    ContextType
  >;
  updatedAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentSchemaFieldRolesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentSchemaFieldRoles'] = GQLResolversParentTypes['ContentSchemaFieldRoles'],
> = {
  createdAt?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  creatorId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  displayName?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  isDeleted?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  parentId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  threadId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLContentTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ContentType'] = GQLResolversParentTypes['ContentType'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  baseFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['BaseField']>,
    ParentType,
    ContextType
  >;
  derivedFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['DerivedField']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface GQLCoopInputOrStringScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['CoopInputOrString'], any> {
  name: 'CoopInputOrString';
}

export type GQLCountByActionByDayResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByActionByDay'] = GQLResolversParentTypes['CountByActionByDay'],
> = {
  action?: Resolver<
    GQLResolversTypes['CountByActionByDayAction'],
    ParentType,
    ContextType
  >;
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByActionByDayActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByActionByDayAction'] = GQLResolversParentTypes['CountByActionByDayAction'],
> = {
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByDayResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByDay'] = GQLResolversParentTypes['CountByDay'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByDecisionTypeByDayResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByDecisionTypeByDay'] = GQLResolversParentTypes['CountByDecisionTypeByDay'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  decisionType?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByPolicyByDayResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByPolicyByDay'] = GQLResolversParentTypes['CountByPolicyByDay'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  policy?: Resolver<
    GQLResolversTypes['CountByPolicyByDayPolicy'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByPolicyByDayPolicyResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByPolicyByDayPolicy'] = GQLResolversParentTypes['CountByPolicyByDayPolicy'],
> = {
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCountByTagByDayResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CountByTagByDay'] = GQLResolversParentTypes['CountByTagByDay'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  tag?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCreateBacktestResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateBacktestResponse'] = GQLResolversParentTypes['CreateBacktestResponse'],
> = {
  backtest?: Resolver<GQLResolversTypes['Backtest'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCreateContentRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateContentRuleResponse'] = GQLResolversParentTypes['CreateContentRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateContentRuleSuccessResponse' | 'RuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLCreateManualReviewQueueResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateManualReviewQueueResponse'] = GQLResolversParentTypes['CreateManualReviewQueueResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'ManualReviewQueueNameExistsError'
    | 'MutateManualReviewQueueSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLCreateOrgResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateOrgResponse'] = GQLResolversParentTypes['CreateOrgResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'CreateOrgSuccessResponse'
    | 'OrgWithEmailExistsError'
    | 'OrgWithNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLCreateOrgSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateOrgSuccessResponse'] = GQLResolversParentTypes['CreateOrgSuccessResponse'],
> = {
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCreateReportingRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateReportingRuleResponse'] = GQLResolversParentTypes['CreateReportingRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateReportingRuleSuccessResponse' | 'ReportingRuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLCreateRoutingRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateRoutingRuleResponse'] = GQLResolversParentTypes['CreateRoutingRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'MutateRoutingRuleSuccessResponse'
    | 'QueueDoesNotExistError'
    | 'RoutingRuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLCreateUserRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CreateUserRuleResponse'] = GQLResolversParentTypes['CreateUserRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateUserRuleSuccessResponse' | 'RuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export interface GQLCursorScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['Cursor'], any> {
  name: 'Cursor';
}

export type GQLCustomActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CustomAction'] = GQLResolversParentTypes['CustomAction'],
> = {
  applyUserStrikes?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  callbackUrl?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  callbackUrlBody?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  callbackUrlHeaders?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  customMrtApiParams?: Resolver<
    ReadonlyArray<Maybe<GQLResolversTypes['CustomMrtApiParamSpec']>>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  penalty?: Resolver<
    GQLResolversTypes['UserPenaltySeverity'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLCustomMrtApiParamSpecResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['CustomMrtApiParamSpec'] = GQLResolversParentTypes['CustomMrtApiParamSpec'],
> = {
  displayName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface GQLDateScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['Date'], any> {
  name: 'Date';
}

export interface GQLDateTimeScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type GQLDecisionCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DecisionCount'] = GQLResolversParentTypes['DecisionCount'],
> = {
  action_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  policy_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  queue_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reviewer_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  time?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewDecisionType']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDecisionCountFilterByResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DecisionCountFilterBy'] = GQLResolversParentTypes['DecisionCountFilterBy'],
> = {
  actionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  endDate?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  filteredDecisionActionType?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['DecisionActionType']>>,
    ParentType,
    ContextType
  >;
  itemTypeIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  queueIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reviewerIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  startDate?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewDecisionType']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDeleteAllJobsFromQueueResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DeleteAllJobsFromQueueResponse'] = GQLResolversParentTypes['DeleteAllJobsFromQueueResponse'],
> = {
  __resolveType: TypeResolveFn<
    'DeleteAllJobsFromQueueSuccessResponse' | 'DeleteAllJobsUnauthorizedError',
    ParentType,
    ContextType
  >;
};

export type GQLDeleteAllJobsFromQueueSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DeleteAllJobsFromQueueSuccessResponse'] = GQLResolversParentTypes['DeleteAllJobsFromQueueSuccessResponse'],
> = {
  _?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDeleteAllJobsUnauthorizedErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DeleteAllJobsUnauthorizedError'] = GQLResolversParentTypes['DeleteAllJobsUnauthorizedError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDeleteItemTypeResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DeleteItemTypeResponse'] = GQLResolversParentTypes['DeleteItemTypeResponse'],
> = {
  __resolveType: TypeResolveFn<
    'CannotDeleteDefaultUserError' | 'DeleteItemTypeSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLDeleteItemTypeSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DeleteItemTypeSuccessResponse'] = GQLResolversParentTypes['DeleteItemTypeSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDequeueManualReviewJobResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DequeueManualReviewJobResponse'] = GQLResolversParentTypes['DequeueManualReviewJobResponse'],
> = {
  __resolveType: TypeResolveFn<
    'DequeueManualReviewJobSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLDequeueManualReviewJobSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DequeueManualReviewJobSuccessResponse'] = GQLResolversParentTypes['DequeueManualReviewJobSuccessResponse'],
> = {
  job?: Resolver<GQLResolversTypes['ManualReviewJob'], ParentType, ContextType>;
  lockToken?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  numPendingJobs?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDerivedFieldResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedField'] = GQLResolversParentTypes['DerivedField'],
> = {
  container?: Resolver<
    Maybe<GQLResolversTypes['Container']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  spec?: Resolver<
    GQLResolversTypes['DerivedFieldSpec'],
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['FieldType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDerivedFieldCoopInputSourceResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedFieldCoopInputSource'] = GQLResolversParentTypes['DerivedFieldCoopInputSource'],
> = {
  name?: Resolver<GQLResolversTypes['CoopInput'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDerivedFieldFieldSourceResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedFieldFieldSource'] = GQLResolversParentTypes['DerivedFieldFieldSource'],
> = {
  contentTypeId?: Resolver<
    GQLResolversTypes['String'],
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDerivedFieldFullItemSourceResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedFieldFullItemSource'] = GQLResolversParentTypes['DerivedFieldFullItemSource'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDerivedFieldSourceResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedFieldSource'] = GQLResolversParentTypes['DerivedFieldSource'],
> = {
  __resolveType: TypeResolveFn<
    | 'DerivedFieldCoopInputSource'
    | 'DerivedFieldFieldSource'
    | 'DerivedFieldFullItemSource',
    ParentType,
    ContextType
  >;
};

export type GQLDerivedFieldSpecResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DerivedFieldSpec'] = GQLResolversParentTypes['DerivedFieldSpec'],
> = {
  derivationType?: Resolver<
    GQLResolversTypes['DerivedFieldDerivationType'],
    ParentType,
    ContextType
  >;
  source?: Resolver<
    GQLResolversTypes['DerivedFieldSource'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLDisabledInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['DisabledInfo'] = GQLResolversParentTypes['DisabledInfo'],
> = {
  disabled?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  disabledMessage?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLEnqueueAuthorToMrtActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['EnqueueAuthorToMrtAction'] = GQLResolversParentTypes['EnqueueAuthorToMrtAction'],
> = {
  applyUserStrikes?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  penalty?: Resolver<
    GQLResolversTypes['UserPenaltySeverity'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLEnqueueToMrtActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['EnqueueToMrtAction'] = GQLResolversParentTypes['EnqueueToMrtAction'],
> = {
  applyUserStrikes?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  penalty?: Resolver<
    GQLResolversTypes['UserPenaltySeverity'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLEnqueueToNcmecActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['EnqueueToNcmecAction'] = GQLResolversParentTypes['EnqueueToNcmecAction'],
> = {
  applyUserStrikes?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  penalty?: Resolver<
    GQLResolversTypes['UserPenaltySeverity'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLEnumSignalOutputTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['EnumSignalOutputType'] = GQLResolversParentTypes['EnumSignalOutputType'],
> = {
  enum?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ordered?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  scalarType?: Resolver<
    GQLResolversTypes['ScalarType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Error'] = GQLResolversParentTypes['Error'],
> = {
  __resolveType: TypeResolveFn<
    | 'ActionNameExistsError'
    | 'AddCommentFailedError'
    | 'CannotDeleteDefaultUserError'
    | 'ChangePasswordError'
    | 'DeleteAllJobsUnauthorizedError'
    | 'IntegrationConfigTooManyCredentialsError'
    | 'IntegrationConfigUnsupportedIntegrationError'
    | 'IntegrationEmptyInputCredentialsError'
    | 'IntegrationNoInputCredentialsError'
    | 'InviteUserTokenExpiredError'
    | 'InviteUserTokenMissingError'
    | 'ItemTypeNameAlreadyExistsError'
    | 'JobHasAlreadyBeenSubmittedError'
    | 'LocationBankNameExistsError'
    | 'LoginIncorrectPasswordError'
    | 'LoginSsoRequiredError'
    | 'LoginUserDoesNotExistError'
    | 'ManualReviewQueueNameExistsError'
    | 'MatchingBankNameExistsError'
    | 'NoJobWithIdInQueueError'
    | 'NotFoundError'
    | 'OrgWithEmailExistsError'
    | 'OrgWithNameExistsError'
    | 'PartialItemsEndpointResponseError'
    | 'PartialItemsInvalidResponseError'
    | 'PartialItemsMissingEndpointError'
    | 'PolicyNameExistsError'
    | 'QueueDoesNotExistError'
    | 'RecordingJobDecisionFailedError'
    | 'ReportingRuleNameExistsError'
    | 'RotateApiKeyError'
    | 'RoutingRuleNameExistsError'
    | 'RuleHasRunningBacktestsError'
    | 'RuleNameExistsError'
    | 'SignUpUserExistsError'
    | 'SubmittedJobActionNotFoundError',
    ParentType,
    ContextType
  >;
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
};

export type GQLExecuteActionResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ExecuteActionResponse'] = GQLResolversParentTypes['ExecuteActionResponse'],
> = {
  actionId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  itemId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLExecuteBulkActionResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ExecuteBulkActionResponse'] = GQLResolversParentTypes['ExecuteBulkActionResponse'],
> = {
  results?: Resolver<
    ReadonlyArray<GQLResolversTypes['ExecuteActionResponse']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLFieldResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Field'] = GQLResolversParentTypes['Field'],
> = {
  __resolveType: TypeResolveFn<
    'BaseField' | 'DerivedField',
    ParentType,
    ContextType
  >;
  container?: Resolver<
    Maybe<GQLResolversTypes['Container']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<GQLResolversTypes['FieldType'], ParentType, ContextType>;
};

export type GQLGetDecisionCountSettingsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GetDecisionCountSettings'] = GQLResolversParentTypes['GetDecisionCountSettings'],
> = {
  filterBy?: Resolver<
    GQLResolversTypes['DecisionCountFilterBy'],
    ParentType,
    ContextType
  >;
  groupBy?: Resolver<
    ReadonlyArray<GQLResolversTypes['DecisionCountGroupByColumns']>,
    ParentType,
    ContextType
  >;
  metric?: Resolver<
    GQLResolversTypes['ManualReviewChartMetric'],
    ParentType,
    ContextType
  >;
  timeDivision?: Resolver<
    GQLResolversTypes['MetricsTimeDivisionOptions'],
    ParentType,
    ContextType
  >;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLGetFullReportingRuleResultForItemResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GetFullReportingRuleResultForItemResponse'] = GQLResolversParentTypes['GetFullReportingRuleResultForItemResponse'],
> = {
  __resolveType: TypeResolveFn<
    'NotFoundError' | 'ReportingRuleExecutionResult',
    ParentType,
    ContextType
  >;
};

export type GQLGetFullResultForItemResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GetFullResultForItemResponse'] = GQLResolversParentTypes['GetFullResultForItemResponse'],
> = {
  __resolveType: TypeResolveFn<
    'NotFoundError' | 'RuleExecutionResult',
    ParentType,
    ContextType
  >;
};

export type GQLGetJobCreationCountSettingsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GetJobCreationCountSettings'] = GQLResolversParentTypes['GetJobCreationCountSettings'],
> = {
  filterBy?: Resolver<
    GQLResolversTypes['JobCreationFilterBy'],
    ParentType,
    ContextType
  >;
  groupBy?: Resolver<
    ReadonlyArray<GQLResolversTypes['JobCreationGroupByColumns']>,
    ParentType,
    ContextType
  >;
  metric?: Resolver<
    GQLResolversTypes['ManualReviewChartMetric'],
    ParentType,
    ContextType
  >;
  timeDivision?: Resolver<
    GQLResolversTypes['MetricsTimeDivisionOptions'],
    ParentType,
    ContextType
  >;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLGoogleContentSafetyApiIntegrationApiCredentialResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GoogleContentSafetyApiIntegrationApiCredential'] = GQLResolversParentTypes['GoogleContentSafetyApiIntegrationApiCredential'],
> = {
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLGooglePlaceLocationInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['GooglePlaceLocationInfo'] = GQLResolversParentTypes['GooglePlaceLocationInfo'],
> = {
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLHashBankResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['HashBank'] = GQLResolversParentTypes['HashBank'],
> = {
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  enabled_ratio?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  hma_name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  org_id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIgnoreDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IgnoreDecisionComponent'] = GQLResolversParentTypes['IgnoreDecisionComponent'],
> = {
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationApiCredentialResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationApiCredential'] = GQLResolversParentTypes['IntegrationApiCredential'],
> = {
  __resolveType: TypeResolveFn<
    | 'GoogleContentSafetyApiIntegrationApiCredential'
    | 'OpenAiIntegrationApiCredential'
    | 'ZentropiIntegrationApiCredential',
    ParentType,
    ContextType
  >;
};

export type GQLIntegrationConfigResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationConfig'] = GQLResolversParentTypes['IntegrationConfig'],
> = {
  apiCredential?: Resolver<
    GQLResolversTypes['IntegrationApiCredential'],
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['Integration'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationConfigQueryResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationConfigQueryResponse'] = GQLResolversParentTypes['IntegrationConfigQueryResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'IntegrationConfigSuccessResult'
    | 'IntegrationConfigUnsupportedIntegrationError',
    ParentType,
    ContextType
  >;
};

export type GQLIntegrationConfigSuccessResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationConfigSuccessResult'] = GQLResolversParentTypes['IntegrationConfigSuccessResult'],
> = {
  config?: Resolver<
    Maybe<GQLResolversTypes['IntegrationConfig']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationConfigTooManyCredentialsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationConfigTooManyCredentialsError'] = GQLResolversParentTypes['IntegrationConfigTooManyCredentialsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationConfigUnsupportedIntegrationErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationConfigUnsupportedIntegrationError'] = GQLResolversParentTypes['IntegrationConfigUnsupportedIntegrationError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationEmptyInputCredentialsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationEmptyInputCredentialsError'] = GQLResolversParentTypes['IntegrationEmptyInputCredentialsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIntegrationNoInputCredentialsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IntegrationNoInputCredentialsError'] = GQLResolversParentTypes['IntegrationNoInputCredentialsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLInviteUserTokenResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['InviteUserToken'] = GQLResolversParentTypes['InviteUserToken'],
> = {
  email?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<GQLResolversTypes['UserRole'], ParentType, ContextType>;
  samlEnabled?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  token?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLInviteUserTokenExpiredErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['InviteUserTokenExpiredError'] = GQLResolversParentTypes['InviteUserTokenExpiredError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLInviteUserTokenMissingErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['InviteUserTokenMissingError'] = GQLResolversParentTypes['InviteUserTokenMissingError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLInviteUserTokenResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['InviteUserTokenResponse'] = GQLResolversParentTypes['InviteUserTokenResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'InviteUserTokenExpiredError'
    | 'InviteUserTokenMissingError'
    | 'InviteUserTokenSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLInviteUserTokenSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['InviteUserTokenSuccessResponse'] = GQLResolversParentTypes['InviteUserTokenSuccessResponse'],
> = {
  tokenData?: Resolver<
    GQLResolversTypes['InviteUserToken'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLIpAddressResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['IpAddress'] = GQLResolversParentTypes['IpAddress'],
> = {
  ip?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  port?: Resolver<Maybe<GQLResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Item'] = GQLResolversParentTypes['Item'],
> = {
  __resolveType: TypeResolveFn<
    'ContentItem' | 'ThreadItem' | 'UserItem',
    ParentType,
    ContextType
  >;
};

export type GQLItemActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemAction'] = GQLResolversParentTypes['ItemAction'],
> = {
  actionId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  actorId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  itemCreatorId?: Resolver<
    Maybe<GQLResolversTypes['ID']>,
    ParentType,
    ContextType
  >;
  itemCreatorTypeId?: Resolver<
    Maybe<GQLResolversTypes['ID']>,
    ParentType,
    ContextType
  >;
  itemId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  jobId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ruleIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['ID']>,
    ParentType,
    ContextType
  >;
  ts?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemBaseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemBase'] = GQLResolversParentTypes['ItemBase'],
> = {
  __resolveType: TypeResolveFn<
    'ContentItem' | 'ThreadItem' | 'UserItem',
    ParentType,
    ContextType
  >;
  data?: Resolver<GQLResolversTypes['JSONObject'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionTime?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['ItemTypeBase'], ParentType, ContextType>;
};

export type GQLItemHistoryResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemHistoryResponse'] = GQLResolversParentTypes['ItemHistoryResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ItemHistoryResult' | 'NotFoundError',
    ParentType,
    ContextType
  >;
};

export type GQLItemHistoryResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemHistoryResult'] = GQLResolversParentTypes['ItemHistoryResult'],
> = {
  executions?: Resolver<
    ReadonlyArray<GQLResolversTypes['RuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['Item'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemIdentifierResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemIdentifier'] = GQLResolversParentTypes['ItemIdentifier'],
> = {
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  typeId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemSubmissionsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemSubmissions'] = GQLResolversParentTypes['ItemSubmissions'],
> = {
  latest?: Resolver<GQLResolversTypes['Item'], ParentType, ContextType>;
  prior?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['Item']>>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemType'] = GQLResolversParentTypes['ItemType'],
> = {
  __resolveType: TypeResolveFn<
    'ContentItemType' | 'ThreadItemType' | 'UserItemType',
    ParentType,
    ContextType
  >;
};

export type GQLItemTypeBaseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemTypeBase'] = GQLResolversParentTypes['ItemTypeBase'],
> = {
  __resolveType: TypeResolveFn<
    'ContentItemType' | 'ThreadItemType' | 'UserItemType',
    ParentType,
    ContextType
  >;
  baseFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['BaseField']>,
    ParentType,
    ContextType
  >;
  derivedFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['DerivedField']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  hiddenFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  schemaVariant?: Resolver<
    GQLResolversTypes['ItemTypeSchemaVariant'],
    ParentType,
    ContextType
  >;
  version?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
};

export type GQLItemTypeIdentifierResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemTypeIdentifier'] = GQLResolversParentTypes['ItemTypeIdentifier'],
> = {
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  schemaVariant?: Resolver<
    GQLResolversTypes['ItemTypeSchemaVariant'],
    ParentType,
    ContextType
  >;
  version?: Resolver<
    GQLResolversTypes['NonEmptyString'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemTypeNameAlreadyExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemTypeNameAlreadyExistsError'] = GQLResolversParentTypes['ItemTypeNameAlreadyExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLItemTypeSchemaVariantResolvers = EnumResolverSignature<
  { ORIGINAL?: any; PARTIAL?: any },
  GQLResolversTypes['ItemTypeSchemaVariant']
>;

export type GQLItemTypeSchemaVariantInputResolvers = EnumResolverSignature<
  { ORIGINAL?: any },
  GQLResolversTypes['ItemTypeSchemaVariantInput']
>;

export type GQLItemWithParentsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ItemWithParents'] = GQLResolversParentTypes['ItemWithParents'],
> = {
  item?: Resolver<
    GQLResolversTypes['ItemSubmissions'],
    ParentType,
    ContextType
  >;
  parents?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface GQLJsonObjectScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type GQLJobCreationCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['JobCreationCount'] = GQLResolversParentTypes['JobCreationCount'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  itemTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  queueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ruleId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  source?: Resolver<
    Maybe<GQLResolversTypes['JobCreationSourceOptions']>,
    ParentType,
    ContextType
  >;
  time?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLJobCreationFilterByResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['JobCreationFilterBy'] = GQLResolversParentTypes['JobCreationFilterBy'],
> = {
  endDate?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  itemTypeIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  queueIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ruleIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  sources?: Resolver<
    ReadonlyArray<GQLResolversTypes['JobCreationSourceOptions']>,
    ParentType,
    ContextType
  >;
  startDate?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLJobHasAlreadyBeenSubmittedErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['JobHasAlreadyBeenSubmittedError'] = GQLResolversParentTypes['JobHasAlreadyBeenSubmittedError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLanguagesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Languages'] = GQLResolversParentTypes['Languages'],
> = {
  languages?: Resolver<
    ReadonlyArray<GQLResolversTypes['Language']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLatLngResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LatLng'] = GQLResolversParentTypes['LatLng'],
> = {
  lat?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  lng?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLeafConditionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LeafCondition'] = GQLResolversParentTypes['LeafCondition'],
> = {
  comparator?: Resolver<
    Maybe<GQLResolversTypes['ValueComparator']>,
    ParentType,
    ContextType
  >;
  input?: Resolver<
    GQLResolversTypes['ConditionInputField'],
    ParentType,
    ContextType
  >;
  matchingValues?: Resolver<
    Maybe<GQLResolversTypes['MatchingValues']>,
    ParentType,
    ContextType
  >;
  signal?: Resolver<
    Maybe<GQLResolversTypes['Signal']>,
    ParentType,
    ContextType
  >;
  threshold?: Resolver<
    Maybe<GQLResolversTypes['StringOrFloat']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLeafConditionWithResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LeafConditionWithResult'] = GQLResolversParentTypes['LeafConditionWithResult'],
> = {
  comparator?: Resolver<
    Maybe<GQLResolversTypes['ValueComparator']>,
    ParentType,
    ContextType
  >;
  input?: Resolver<
    GQLResolversTypes['ConditionInputField'],
    ParentType,
    ContextType
  >;
  matchingValues?: Resolver<
    Maybe<GQLResolversTypes['MatchingValues']>,
    ParentType,
    ContextType
  >;
  result?: Resolver<
    Maybe<GQLResolversTypes['ConditionResult']>,
    ParentType,
    ContextType
  >;
  signal?: Resolver<
    Maybe<GQLResolversTypes['Signal']>,
    ParentType,
    ContextType
  >;
  threshold?: Resolver<
    Maybe<GQLResolversTypes['StringOrFloat']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLocationAreaResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LocationArea'] = GQLResolversParentTypes['LocationArea'],
> = {
  bounds?: Resolver<
    Maybe<GQLResolversTypes['PlaceBounds']>,
    ParentType,
    ContextType
  >;
  geometry?: Resolver<
    GQLResolversTypes['LocationGeometry'],
    ParentType,
    ContextType
  >;
  googlePlaceInfo?: Resolver<
    Maybe<GQLResolversTypes['GooglePlaceLocationInfo']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<Maybe<GQLResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLocationBankResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LocationBank'] = GQLResolversParentTypes['LocationBank'],
> = {
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  locations?: Resolver<
    ReadonlyArray<GQLResolversTypes['LocationArea']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLocationBankNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LocationBankNameExistsError'] = GQLResolversParentTypes['LocationBankNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLocationGeometryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LocationGeometry'] = GQLResolversParentTypes['LocationGeometry'],
> = {
  center?: Resolver<GQLResolversTypes['LatLng'], ParentType, ContextType>;
  radius?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLoginIncorrectPasswordErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LoginIncorrectPasswordError'] = GQLResolversParentTypes['LoginIncorrectPasswordError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLoginResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LoginResponse'] = GQLResolversParentTypes['LoginResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'LoginIncorrectPasswordError'
    | 'LoginSsoRequiredError'
    | 'LoginSuccessResponse'
    | 'LoginUserDoesNotExistError',
    ParentType,
    ContextType
  >;
};

export type GQLLoginSsoRequiredErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LoginSsoRequiredError'] = GQLResolversParentTypes['LoginSsoRequiredError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLoginSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LoginSuccessResponse'] = GQLResolversParentTypes['LoginSuccessResponse'],
> = {
  user?: Resolver<GQLResolversTypes['User'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLLoginUserDoesNotExistErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['LoginUserDoesNotExistError'] = GQLResolversParentTypes['LoginUserDoesNotExistError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewChartSettingsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewChartSettings'] = GQLResolversParentTypes['ManualReviewChartSettings'],
> = {
  __resolveType: TypeResolveFn<
    'GetDecisionCountSettings' | 'GetJobCreationCountSettings',
    ParentType,
    ContextType
  >;
};

export type GQLManualReviewDecisionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewDecision'] = GQLResolversParentTypes['ManualReviewDecision'],
> = {
  createdAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  decisionReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  decisions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewDecisionComponent']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  itemId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  itemTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  jobId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  queueId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  relatedActions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewDecisionComponent']>,
    ParentType,
    ContextType
  >;
  reviewerId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewDecisionComponent'] = GQLResolversParentTypes['ManualReviewDecisionComponent'],
> = {
  __resolveType: TypeResolveFn<
    | 'AcceptAppealDecisionComponent'
    | 'AutomaticCloseDecisionComponent'
    | 'IgnoreDecisionComponent'
    | 'RejectAppealDecisionComponent'
    | 'SubmitNCMECReportDecisionComponent'
    | 'TransformJobAndRecreateInQueueDecisionComponent'
    | 'UserOrRelatedActionDecisionComponent',
    ParentType,
    ContextType
  >;
};

export type GQLManualReviewDecisionComponentBaseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewDecisionComponentBase'] = GQLResolversParentTypes['ManualReviewDecisionComponentBase'],
> = {
  __resolveType: TypeResolveFn<
    | 'AcceptAppealDecisionComponent'
    | 'AutomaticCloseDecisionComponent'
    | 'IgnoreDecisionComponent'
    | 'RejectAppealDecisionComponent'
    | 'SubmitNCMECReportDecisionComponent'
    | 'TransformJobAndRecreateInQueueDecisionComponent'
    | 'UserOrRelatedActionDecisionComponent',
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
};

export type GQLManualReviewExistingJobResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewExistingJob'] = GQLResolversParentTypes['ManualReviewExistingJob'],
> = {
  job?: Resolver<GQLResolversTypes['ManualReviewJob'], ParentType, ContextType>;
  queueId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewJobResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewJob'] = GQLResolversParentTypes['ManualReviewJob'],
> = {
  comments?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewJobComment']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  numTimesReported?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  payload?: Resolver<
    GQLResolversTypes['ManualReviewJobPayload'],
    ParentType,
    ContextType
  >;
  policyIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewJobCommentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewJobComment'] = GQLResolversParentTypes['ManualReviewJobComment'],
> = {
  author?: Resolver<GQLResolversTypes['User'], ParentType, ContextType>;
  commentText?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewJobEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewJobEnqueueSourceInfo'] = GQLResolversParentTypes['ManualReviewJobEnqueueSourceInfo'],
> = {
  __resolveType: TypeResolveFn<
    | 'AppealEnqueueSourceInfo'
    | 'MrtJobEnqueueSourceInfo'
    | 'PostActionsEnqueueSourceInfo'
    | 'ReportEnqueueSourceInfo'
    | 'RuleExecutionEnqueueSourceInfo',
    ParentType,
    ContextType
  >;
};

export type GQLManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewJobPayload'] = GQLResolversParentTypes['ManualReviewJobPayload'],
> = {
  __resolveType: TypeResolveFn<
    | 'ContentAppealManualReviewJobPayload'
    | 'ContentManualReviewJobPayload'
    | 'NcmecManualReviewJobPayload'
    | 'ThreadAppealManualReviewJobPayload'
    | 'ThreadManualReviewJobPayload'
    | 'UserAppealManualReviewJobPayload'
    | 'UserManualReviewJobPayload',
    ParentType,
    ContextType
  >;
};

export type GQLManualReviewJobWithDecisionsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewJobWithDecisions'] = GQLResolversParentTypes['ManualReviewJobWithDecisions'],
> = {
  decision?: Resolver<
    GQLResolversTypes['ManualReviewDecision'],
    ParentType,
    ContextType
  >;
  job?: Resolver<GQLResolversTypes['ManualReviewJob'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewQueueResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewQueue'] = GQLResolversParentTypes['ManualReviewQueue'],
> = {
  autoCloseJobs?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  explicitlyAssignedReviewers?: Resolver<
    ReadonlyArray<GQLResolversTypes['User']>,
    ParentType,
    ContextType
  >;
  hiddenActionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['ID']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  isAppealsQueue?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  isDefaultQueue?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  jobs?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewJob']>,
    ParentType,
    ContextType,
    Partial<GQLManualReviewQueueJobsArgs>
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  oldestJobCreatedAt?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  orgId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  pendingJobCount?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLManualReviewQueueNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ManualReviewQueueNameExistsError'] = GQLResolversParentTypes['ManualReviewQueueNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMatchingBankNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MatchingBankNameExistsError'] = GQLResolversParentTypes['MatchingBankNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMatchingBanksResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MatchingBanks'] = GQLResolversParentTypes['MatchingBanks'],
> = {
  hashBanks?: Resolver<
    ReadonlyArray<GQLResolversTypes['HashBank']>,
    ParentType,
    ContextType
  >;
  locationBanks?: Resolver<
    ReadonlyArray<GQLResolversTypes['LocationBank']>,
    ParentType,
    ContextType
  >;
  textBanks?: Resolver<
    ReadonlyArray<GQLResolversTypes['TextBank']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMatchingValuesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MatchingValues'] = GQLResolversParentTypes['MatchingValues'],
> = {
  imageBankIds?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  locationBankIds?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  locations?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['LocationArea']>>,
    ParentType,
    ContextType
  >;
  strings?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  textBankIds?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMessageWithIpAddressResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MessageWithIpAddress'] = GQLResolversParentTypes['MessageWithIpAddress'],
> = {
  ipAddress?: Resolver<GQLResolversTypes['IpAddress'], ParentType, ContextType>;
  message?: Resolver<GQLResolversTypes['ContentItem'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMrtJobEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MrtJobEnqueueSourceInfo'] = GQLResolversParentTypes['MrtJobEnqueueSourceInfo'],
> = {
  kind?: Resolver<
    GQLResolversTypes['JobCreationSourceOptions'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateAccessibleQueuesForUserSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateAccessibleQueuesForUserSuccessResponse'] = GQLResolversParentTypes['MutateAccessibleQueuesForUserSuccessResponse'],
> = {
  _?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateActionResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateActionResponse'] = GQLResolversParentTypes['MutateActionResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ActionNameExistsError' | 'MutateActionSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateActionSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateActionSuccessResponse'] = GQLResolversParentTypes['MutateActionSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['CustomAction'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateBankResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateBankResponse'] = GQLResolversParentTypes['MutateBankResponse'],
> = {
  error?: Resolver<Maybe<GQLResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateContentItemTypeResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateContentItemTypeResponse'] = GQLResolversParentTypes['MutateContentItemTypeResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ItemTypeNameAlreadyExistsError' | 'MutateContentTypeSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateContentRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateContentRuleSuccessResponse'] = GQLResolversParentTypes['MutateContentRuleSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['ContentRule'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateContentTypeSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateContentTypeSuccessResponse'] = GQLResolversParentTypes['MutateContentTypeSuccessResponse'],
> = {
  data?: Resolver<
    Maybe<GQLResolversTypes['ContentItemType']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateHashBankResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateHashBankResponse'] = GQLResolversParentTypes['MutateHashBankResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MatchingBankNameExistsError' | 'MutateHashBankSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateHashBankSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateHashBankSuccessResponse'] = GQLResolversParentTypes['MutateHashBankSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['HashBank'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateLocationBankResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateLocationBankResponse'] = GQLResolversParentTypes['MutateLocationBankResponse'],
> = {
  __resolveType: TypeResolveFn<
    'LocationBankNameExistsError' | 'MutateLocationBankSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateLocationBankSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateLocationBankSuccessResponse'] = GQLResolversParentTypes['MutateLocationBankSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['LocationBank'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateManualReviewQueueSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateManualReviewQueueSuccessResponse'] = GQLResolversParentTypes['MutateManualReviewQueueSuccessResponse'],
> = {
  data?: Resolver<
    GQLResolversTypes['ManualReviewQueue'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateReportingRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateReportingRuleSuccessResponse'] = GQLResolversParentTypes['MutateReportingRuleSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['ReportingRule'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateRoutingRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateRoutingRuleSuccessResponse'] = GQLResolversParentTypes['MutateRoutingRuleSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['RoutingRule'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateRoutingRulesOrderSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateRoutingRulesOrderSuccessResponse'] = GQLResolversParentTypes['MutateRoutingRulesOrderSuccessResponse'],
> = {
  data?: Resolver<
    ReadonlyArray<GQLResolversTypes['RoutingRule']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateThreadItemTypeResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateThreadItemTypeResponse'] = GQLResolversParentTypes['MutateThreadItemTypeResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ItemTypeNameAlreadyExistsError' | 'MutateThreadTypeSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateThreadTypeSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateThreadTypeSuccessResponse'] = GQLResolversParentTypes['MutateThreadTypeSuccessResponse'],
> = {
  data?: Resolver<
    Maybe<GQLResolversTypes['ThreadItemType']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateUserItemTypeResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateUserItemTypeResponse'] = GQLResolversParentTypes['MutateUserItemTypeResponse'],
> = {
  __resolveType: TypeResolveFn<
    'ItemTypeNameAlreadyExistsError' | 'MutateUserTypeSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLMutateUserRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateUserRuleSuccessResponse'] = GQLResolversParentTypes['MutateUserRuleSuccessResponse'],
> = {
  data?: Resolver<GQLResolversTypes['UserRule'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutateUserTypeSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['MutateUserTypeSuccessResponse'] = GQLResolversParentTypes['MutateUserTypeSuccessResponse'],
> = {
  data?: Resolver<
    Maybe<GQLResolversTypes['UserItemType']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLMutationResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Mutation'] = GQLResolversParentTypes['Mutation'],
> = {
  addAccessibleQueuesToUser?: Resolver<
    GQLResolversTypes['AddAccessibleQueuesToUserResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationAddAccessibleQueuesToUserArgs, 'input'>
  >;
  addFavoriteMRTQueue?: Resolver<
    GQLResolversTypes['AddFavoriteMRTQueueSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationAddFavoriteMrtQueueArgs, 'queueId'>
  >;
  addFavoriteRule?: Resolver<
    GQLResolversTypes['AddFavoriteRuleSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationAddFavoriteRuleArgs, 'ruleId'>
  >;
  addPolicies?: Resolver<
    GQLResolversTypes['AddPoliciesResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationAddPoliciesArgs, 'policies'>
  >;
  approveUser?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationApproveUserArgs, 'id'>
  >;
  bulkExecuteActions?: Resolver<
    GQLResolversTypes['ExecuteBulkActionResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationBulkExecuteActionsArgs, 'input'>
  >;
  changePassword?: Resolver<
    GQLResolversTypes['ChangePasswordResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationChangePasswordArgs, 'input'>
  >;
  createAction?: Resolver<
    GQLResolversTypes['MutateActionResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateActionArgs, 'input'>
  >;
  createBacktest?: Resolver<
    Maybe<GQLResolversTypes['CreateBacktestResponse']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateBacktestArgs, 'input'>
  >;
  createContentItemType?: Resolver<
    GQLResolversTypes['MutateContentItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateContentItemTypeArgs, 'input'>
  >;
  createContentRule?: Resolver<
    GQLResolversTypes['CreateContentRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateContentRuleArgs, 'input'>
  >;
  createHashBank?: Resolver<
    GQLResolversTypes['MutateHashBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateHashBankArgs, 'input'>
  >;
  createLocationBank?: Resolver<
    GQLResolversTypes['MutateLocationBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateLocationBankArgs, 'input'>
  >;
  createManualReviewJobComment?: Resolver<
    GQLResolversTypes['AddManualReviewJobCommentResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateManualReviewJobCommentArgs, 'input'>
  >;
  createManualReviewQueue?: Resolver<
    GQLResolversTypes['CreateManualReviewQueueResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateManualReviewQueueArgs, 'input'>
  >;
  createOrg?: Resolver<
    GQLResolversTypes['CreateOrgResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateOrgArgs, 'input'>
  >;
  createReportingRule?: Resolver<
    GQLResolversTypes['CreateReportingRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateReportingRuleArgs, 'input'>
  >;
  createRoutingRule?: Resolver<
    GQLResolversTypes['CreateRoutingRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateRoutingRuleArgs, 'input'>
  >;
  createTextBank?: Resolver<
    GQLResolversTypes['MutateBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateTextBankArgs, 'input'>
  >;
  createThreadItemType?: Resolver<
    GQLResolversTypes['MutateThreadItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateThreadItemTypeArgs, 'input'>
  >;
  createUserItemType?: Resolver<
    GQLResolversTypes['MutateUserItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateUserItemTypeArgs, 'input'>
  >;
  createUserRule?: Resolver<
    GQLResolversTypes['CreateUserRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateUserRuleArgs, 'input'>
  >;
  deleteAction?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteActionArgs, 'id'>
  >;
  deleteAllJobsFromQueue?: Resolver<
    GQLResolversTypes['DeleteAllJobsFromQueueResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteAllJobsFromQueueArgs, 'queueId'>
  >;
  deleteHashBank?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteHashBankArgs, 'id'>
  >;
  deleteInvite?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteInviteArgs, 'id'>
  >;
  deleteItemType?: Resolver<
    GQLResolversTypes['DeleteItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteItemTypeArgs, 'id'>
  >;
  deleteLocationBank?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteLocationBankArgs, 'id'>
  >;
  deleteManualReviewJobComment?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteManualReviewJobCommentArgs, 'input'>
  >;
  deleteManualReviewQueue?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteManualReviewQueueArgs, 'id'>
  >;
  deletePolicy?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeletePolicyArgs, 'id'>
  >;
  deleteReportingRule?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteReportingRuleArgs, 'id'>
  >;
  deleteRoutingRule?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteRoutingRuleArgs, 'input'>
  >;
  deleteRule?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteRuleArgs, 'id'>
  >;
  deleteTextBank?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteTextBankArgs, 'id'>
  >;
  deleteUser?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteUserArgs, 'id'>
  >;
  dequeueManualReviewJob?: Resolver<
    Maybe<GQLResolversTypes['DequeueManualReviewJobResponse']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationDequeueManualReviewJobArgs, 'queueId'>
  >;
  generatePasswordResetToken?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationGeneratePasswordResetTokenArgs, 'userId'>
  >;
  inviteUser?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationInviteUserArgs, 'input'>
  >;
  logSkip?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationLogSkipArgs, 'input'>
  >;
  login?: Resolver<
    GQLResolversTypes['LoginResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationLoginArgs, 'input'>
  >;
  logout?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  rejectUser?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationRejectUserArgs, 'id'>
  >;
  releaseJobLock?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationReleaseJobLockArgs, 'input'>
  >;
  removeAccessibleQueuesToUser?: Resolver<
    GQLResolversTypes['RemoveAccessibleQueuesToUserResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationRemoveAccessibleQueuesToUserArgs, 'input'>
  >;
  removeFavoriteMRTQueue?: Resolver<
    GQLResolversTypes['RemoveFavoriteMRTQueueSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationRemoveFavoriteMrtQueueArgs, 'queueId'>
  >;
  removeFavoriteRule?: Resolver<
    GQLResolversTypes['RemoveFavoriteRuleSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationRemoveFavoriteRuleArgs, 'ruleId'>
  >;
  reorderRoutingRules?: Resolver<
    GQLResolversTypes['ReorderRoutingRulesResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationReorderRoutingRulesArgs, 'input'>
  >;
  requestDemo?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationRequestDemoArgs, 'input'>
  >;
  resetPassword?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationResetPasswordArgs, 'input'>
  >;
  rotateApiKey?: Resolver<
    GQLResolversTypes['RotateApiKeyResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationRotateApiKeyArgs, 'input'>
  >;
  runRetroaction?: Resolver<
    Maybe<GQLResolversTypes['RunRetroactionResponse']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationRunRetroactionArgs, 'input'>
  >;
  sendPasswordReset?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSendPasswordResetArgs, 'input'>
  >;
  setAllUserStrikeThresholds?: Resolver<
    GQLResolversTypes['SetAllUserStrikeThresholdsSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSetAllUserStrikeThresholdsArgs, 'input'>
  >;
  setIntegrationConfig?: Resolver<
    GQLResolversTypes['SetIntegrationConfigResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSetIntegrationConfigArgs, 'input'>
  >;
  setModeratorSafetySettings?: Resolver<
    Maybe<GQLResolversTypes['SetModeratorSafetySettingsSuccessResponse']>,
    ParentType,
    ContextType,
    RequireFields<
      GQLMutationSetModeratorSafetySettingsArgs,
      'moderatorSafetySettings'
    >
  >;
  setMrtChartConfigurationSettings?: Resolver<
    Maybe<GQLResolversTypes['SetMrtChartConfigurationSettingsSuccessResponse']>,
    ParentType,
    ContextType,
    RequireFields<
      GQLMutationSetMrtChartConfigurationSettingsArgs,
      'mrtChartConfigurationSettings'
    >
  >;
  setOrgDefaultSafetySettings?: Resolver<
    Maybe<GQLResolversTypes['SetModeratorSafetySettingsSuccessResponse']>,
    ParentType,
    ContextType,
    RequireFields<
      GQLMutationSetOrgDefaultSafetySettingsArgs,
      'orgDefaultSafetySettings'
    >
  >;
  signUp?: Resolver<
    GQLResolversTypes['SignUpResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSignUpArgs, 'input'>
  >;
  submitManualReviewDecision?: Resolver<
    GQLResolversTypes['SubmitDecisionResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSubmitManualReviewDecisionArgs, 'input'>
  >;
  updateAccountInfo?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    Partial<GQLMutationUpdateAccountInfoArgs>
  >;
  updateAction?: Resolver<
    GQLResolversTypes['MutateActionResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateActionArgs, 'input'>
  >;
  updateAppealSettings?: Resolver<
    GQLResolversTypes['AppealSettings'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateAppealSettingsArgs, 'input'>
  >;
  updateContentItemType?: Resolver<
    GQLResolversTypes['MutateContentItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateContentItemTypeArgs, 'input'>
  >;
  updateContentRule?: Resolver<
    GQLResolversTypes['UpdateContentRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateContentRuleArgs, 'input'>
  >;
  updateHashBank?: Resolver<
    GQLResolversTypes['MutateHashBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateHashBankArgs, 'input'>
  >;
  updateLocationBank?: Resolver<
    GQLResolversTypes['MutateLocationBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateLocationBankArgs, 'input'>
  >;
  updateManualReviewQueue?: Resolver<
    GQLResolversTypes['UpdateManualReviewQueueQueueResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateManualReviewQueueArgs, 'input'>
  >;
  updateNcmecOrgSettings?: Resolver<
    GQLResolversTypes['UpdateNcmecOrgSettingsResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateNcmecOrgSettingsArgs, 'input'>
  >;
  updateOrgInfo?: Resolver<
    GQLResolversTypes['UpdateOrgInfoSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateOrgInfoArgs, 'input'>
  >;
  updatePolicy?: Resolver<
    GQLResolversTypes['UpdatePolicyResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdatePolicyArgs, 'input'>
  >;
  updateReportingRule?: Resolver<
    GQLResolversTypes['UpdateReportingRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateReportingRuleArgs, 'input'>
  >;
  updateRole?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateRoleArgs, 'input'>
  >;
  updateRoutingRule?: Resolver<
    GQLResolversTypes['UpdateRoutingRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateRoutingRuleArgs, 'input'>
  >;
  updateSSOCredentials?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateSsoCredentialsArgs, 'input'>
  >;
  updateTextBank?: Resolver<
    GQLResolversTypes['MutateBankResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateTextBankArgs, 'input'>
  >;
  updateThreadItemType?: Resolver<
    GQLResolversTypes['MutateThreadItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateThreadItemTypeArgs, 'input'>
  >;
  updateUserItemType?: Resolver<
    GQLResolversTypes['MutateUserItemTypeResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateUserItemTypeArgs, 'input'>
  >;
  updateUserRule?: Resolver<
    GQLResolversTypes['UpdateUserRuleResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateUserRuleArgs, 'input'>
  >;
  updateUserStrikeTTL?: Resolver<
    GQLResolversTypes['UpdateUserStrikeTTLSuccessResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLMutationUpdateUserStrikeTtlArgs, 'input'>
  >;
};

export type GQLNcmecReportResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NCMECReport'] = GQLResolversParentTypes['NCMECReport'],
> = {
  additionalFiles?: Resolver<
    ReadonlyArray<GQLResolversTypes['NcmecAdditionalFile']>,
    ParentType,
    ContextType
  >;
  isTest?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  reportId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  reportXml?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  reportedMedia?: Resolver<
    ReadonlyArray<GQLResolversTypes['NCMECReportedMedia']>,
    ParentType,
    ContextType
  >;
  reportedMessages?: Resolver<
    ReadonlyArray<GQLResolversTypes['NCMECReportedThread']>,
    ParentType,
    ContextType
  >;
  reviewerId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ts?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  userId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  userItemType?: Resolver<
    GQLResolversTypes['UserItemType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecReportedMediaResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NCMECReportedMedia'] = GQLResolversParentTypes['NCMECReportedMedia'],
> = {
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  xml?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecReportedThreadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NCMECReportedThread'] = GQLResolversParentTypes['NCMECReportedThread'],
> = {
  csv?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  fileName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  ncmecFileId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecAdditionalFileResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NcmecAdditionalFile'] = GQLResolversParentTypes['NcmecAdditionalFile'],
> = {
  ncmecFileId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  xml?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecContentItemResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NcmecContentItem'] = GQLResolversParentTypes['NcmecContentItem'],
> = {
  contentItem?: Resolver<GQLResolversTypes['Item'], ParentType, ContextType>;
  isConfirmedCSAM?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  isReported?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NcmecManualReviewJobPayload'] = GQLResolversParentTypes['NcmecManualReviewJobPayload'],
> = {
  allMediaItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['NcmecContentItem']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJobEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['UserItem'], ParentType, ContextType>;
  userScore?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecOrgSettingsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NcmecOrgSettings'] = GQLResolversParentTypes['NcmecOrgSettings'],
> = {
  companyTemplate?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  contactEmail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  defaultNcmecQueueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  legalUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  moreInfoUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ncmecAdditionalInfoEndpoint?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ncmecPreservationEndpoint?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  password?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNcmecReportedMediaDetailsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NcmecReportedMediaDetails'] = GQLResolversParentTypes['NcmecReportedMediaDetails'],
> = {
  fileAnnotations?: Resolver<
    ReadonlyArray<GQLResolversTypes['NcmecFileAnnotation']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  industryClassification?: Resolver<
    GQLResolversTypes['NcmecIndustryClassification'],
    ParentType,
    ContextType
  >;
  typeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  url?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNoJobWithIdInQueueErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NoJobWithIdInQueueError'] = GQLResolversParentTypes['NoJobWithIdInQueueError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface GQLNonEmptyStringScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['NonEmptyString'], any> {
  name: 'NonEmptyString';
}

export type GQLNotFoundErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['NotFoundError'] = GQLResolversParentTypes['NotFoundError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLNotificationResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Notification'] = GQLResolversParentTypes['Notification'],
> = {
  createdAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  data?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  readAt?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['NotificationType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLOpenAiIntegrationApiCredentialResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['OpenAiIntegrationApiCredential'] = GQLResolversParentTypes['OpenAiIntegrationApiCredential'],
> = {
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLOrgResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Org'] = GQLResolversParentTypes['Org'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  allowMultiplePoliciesPerAction?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  appealsRoutingRules?: Resolver<
    ReadonlyArray<GQLResolversTypes['RoutingRule']>,
    ParentType,
    ContextType
  >;
  banks?: Resolver<
    Maybe<GQLResolversTypes['MatchingBanks']>,
    ParentType,
    ContextType
  >;
  contentTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ContentType']>,
    ParentType,
    ContextType
  >;
  defaultInterfacePreferences?: Resolver<
    GQLResolversTypes['UserInterfacePreferences'],
    ParentType,
    ContextType
  >;
  email?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  hasAppealsEnabled?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  hasNCMECReportingEnabled?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  hasPartialItemsEndpoint?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  hasReportingRulesEnabled?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  hideSkipButtonForNonAdmins?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  integrationConfigs?: Resolver<
    ReadonlyArray<GQLResolversTypes['IntegrationConfig']>,
    ParentType,
    ContextType
  >;
  isDemoOrg?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  mrtQueues?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewQueue']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  ncmecReports?: Resolver<
    ReadonlyArray<GQLResolversTypes['NCMECReport']>,
    ParentType,
    ContextType
  >;
  onCallAlertEmail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pendingInvites?: Resolver<
    ReadonlyArray<GQLResolversTypes['PendingInvite']>,
    ParentType,
    ContextType
  >;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  previewJobsViewEnabled?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  publicSigningKey?: Resolver<
    GQLResolversTypes['String'],
    ParentType,
    ContextType
  >;
  reportingRules?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportingRule']>,
    ParentType,
    ContextType
  >;
  requiresDecisionReasonInMrt?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  requiresPolicyForDecisionsInMrt?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  routingRules?: Resolver<
    ReadonlyArray<GQLResolversTypes['RoutingRule']>,
    ParentType,
    ContextType
  >;
  rules?: Resolver<
    ReadonlyArray<GQLResolversTypes['Rule']>,
    ParentType,
    ContextType
  >;
  signals?: Resolver<
    ReadonlyArray<GQLResolversTypes['Signal']>,
    ParentType,
    ContextType,
    RequireFields<GQLOrgSignalsArgs, 'customOnly'>
  >;
  ssoCert?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ssoUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  userStrikeTTL?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  userStrikeThresholds?: Resolver<
    ReadonlyArray<GQLResolversTypes['UserStrikeThreshold']>,
    ParentType,
    ContextType
  >;
  users?: Resolver<
    ReadonlyArray<GQLResolversTypes['User']>,
    ParentType,
    ContextType
  >;
  usersWhoCanReviewEveryQueue?: Resolver<
    ReadonlyArray<GQLResolversTypes['User']>,
    ParentType,
    ContextType
  >;
  websiteUrl?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLOrgWithEmailExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['OrgWithEmailExistsError'] = GQLResolversParentTypes['OrgWithEmailExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLOrgWithNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['OrgWithNameExistsError'] = GQLResolversParentTypes['OrgWithNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPageInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PageInfo'] = GQLResolversParentTypes['PageInfo'],
> = {
  endCursor?: Resolver<GQLResolversTypes['Cursor'], ParentType, ContextType>;
  hasNextPage?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  startCursor?: Resolver<GQLResolversTypes['Cursor'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPartialItemsEndpointResponseErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PartialItemsEndpointResponseError'] = GQLResolversParentTypes['PartialItemsEndpointResponseError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPartialItemsInvalidResponseErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PartialItemsInvalidResponseError'] = GQLResolversParentTypes['PartialItemsInvalidResponseError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPartialItemsMissingEndpointErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PartialItemsMissingEndpointError'] = GQLResolversParentTypes['PartialItemsMissingEndpointError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPartialItemsResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PartialItemsResponse'] = GQLResolversParentTypes['PartialItemsResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'PartialItemsEndpointResponseError'
    | 'PartialItemsInvalidResponseError'
    | 'PartialItemsMissingEndpointError'
    | 'PartialItemsSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLPartialItemsSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PartialItemsSuccessResponse'] = GQLResolversParentTypes['PartialItemsSuccessResponse'],
> = {
  items?: Resolver<
    ReadonlyArray<GQLResolversTypes['Item']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPendingInviteResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PendingInvite'] = GQLResolversParentTypes['PendingInvite'],
> = {
  createdAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  email?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<GQLResolversTypes['UserRole'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPlaceBoundsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PlaceBounds'] = GQLResolversParentTypes['PlaceBounds'],
> = {
  northeastCorner?: Resolver<
    GQLResolversTypes['LatLng'],
    ParentType,
    ContextType
  >;
  southwestCorner?: Resolver<
    GQLResolversTypes['LatLng'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPolicyResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Policy'] = GQLResolversParentTypes['Policy'],
> = {
  applyUserStrikeCountConfigToChildren?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  enforcementGuidelines?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  policyText?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyType?: Resolver<
    Maybe<GQLResolversTypes['PolicyType']>,
    ParentType,
    ContextType
  >;
  userStrikeCount?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPolicyActionCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PolicyActionCount'] = GQLResolversParentTypes['PolicyActionCount'],
> = {
  actionId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  actorId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  itemSubmissionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPolicyNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PolicyNameExistsError'] = GQLResolversParentTypes['PolicyNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPolicyViolationsCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PolicyViolationsCount'] = GQLResolversParentTypes['PolicyViolationsCount'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  policyId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLPostActionsEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['PostActionsEnqueueSourceInfo'] = GQLResolversParentTypes['PostActionsEnqueueSourceInfo'],
> = {
  kind?: Resolver<
    GQLResolversTypes['JobCreationSourceOptions'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLQueryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Query'] = GQLResolversParentTypes['Query'],
> = {
  action?: Resolver<
    Maybe<GQLResolversTypes['Action']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryActionArgs, 'id'>
  >;
  actionStatistics?: Resolver<
    ReadonlyArray<GQLResolversTypes['ActionData']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryActionStatisticsArgs, 'input'>
  >;
  allOrgs?: Resolver<
    ReadonlyArray<GQLResolversTypes['Org']>,
    ParentType,
    ContextType
  >;
  allRuleInsights?: Resolver<
    GQLResolversTypes['AllRuleInsights'],
    ParentType,
    ContextType
  >;
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  appealSettings?: Resolver<
    Maybe<GQLResolversTypes['AppealSettings']>,
    ParentType,
    ContextType
  >;
  getCommentsForJob?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewJobComment']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetCommentsForJobArgs, 'jobId'>
  >;
  getDecidedJob?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJob']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetDecidedJobArgs, 'id'>
  >;
  getDecidedJobFromJobId?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJobWithDecisions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetDecidedJobFromJobIdArgs, 'id'>
  >;
  getDecisionCounts?: Resolver<
    ReadonlyArray<GQLResolversTypes['DecisionCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetDecisionCountsArgs, 'input'>
  >;
  getDecisionsTable?: Resolver<
    ReadonlyArray<GQLResolversTypes['TableDecisionCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetDecisionsTableArgs, 'input'>
  >;
  getExistingJobsForItem?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewExistingJob']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetExistingJobsForItemArgs, 'itemId' | 'itemTypeId'>
  >;
  getFullReportingRuleResultForItem?: Resolver<
    GQLResolversTypes['GetFullReportingRuleResultForItemResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetFullReportingRuleResultForItemArgs, 'input'>
  >;
  getFullRuleResultForItem?: Resolver<
    GQLResolversTypes['GetFullResultForItemResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetFullRuleResultForItemArgs, 'input'>
  >;
  getJobCreationCounts?: Resolver<
    ReadonlyArray<GQLResolversTypes['JobCreationCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetJobCreationCountsArgs, 'input'>
  >;
  getRecentDecisions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewDecision']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetRecentDecisionsArgs, 'input'>
  >;
  getResolvedJobCounts?: Resolver<
    ReadonlyArray<GQLResolversTypes['ResolvedJobCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetResolvedJobCountsArgs, 'input'>
  >;
  getResolvedJobsForUser?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetResolvedJobsForUserArgs, 'timeZone'>
  >;
  getSSORedirectUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetSsoRedirectUrlArgs, 'emailAddress'>
  >;
  getSkippedJobCounts?: Resolver<
    ReadonlyArray<GQLResolversTypes['SkippedJobCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetSkippedJobCountsArgs, 'input'>
  >;
  getSkippedJobsForUser?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetSkippedJobsForUserArgs, 'timeZone'>
  >;
  getSkipsForRecentDecisions?: Resolver<
    ReadonlyArray<GQLResolversTypes['SkippedJob']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetSkipsForRecentDecisionsArgs, 'input'>
  >;
  getTimeToAction?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['TimeToAction']>>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryGetTimeToActionArgs, 'input'>
  >;
  getTotalPendingJobsCount?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  getUserStrikeCountDistribution?: Resolver<
    ReadonlyArray<GQLResolversTypes['UserStrikeBucket']>,
    ParentType,
    ContextType
  >;
  hashBank?: Resolver<
    Maybe<GQLResolversTypes['HashBank']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryHashBankArgs, 'name'>
  >;
  hashBankById?: Resolver<
    Maybe<GQLResolversTypes['HashBank']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryHashBankByIdArgs, 'id'>
  >;
  hashBanks?: Resolver<
    ReadonlyArray<GQLResolversTypes['HashBank']>,
    ParentType,
    ContextType
  >;
  integrationConfig?: Resolver<
    GQLResolversTypes['IntegrationConfigQueryResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryIntegrationConfigArgs, 'name'>
  >;
  inviteUserToken?: Resolver<
    GQLResolversTypes['InviteUserTokenResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryInviteUserTokenArgs, 'token'>
  >;
  itemActionHistory?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemAction']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemActionHistoryArgs, 'itemIdentifier'>
  >;
  itemSubmissions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemSubmissionsArgs, 'itemIdentifiers'>
  >;
  itemType?: Resolver<
    Maybe<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemTypeArgs, 'id'>
  >;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemTypesArgs, 'identifiers'>
  >;
  itemWithHistory?: Resolver<
    GQLResolversTypes['ItemHistoryResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemWithHistoryArgs, 'itemIdentifier'>
  >;
  itemsWithId?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryItemsWithIdArgs, 'itemId'>
  >;
  latestItemSubmissions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Item']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryLatestItemSubmissionsArgs, 'itemIdentifiers'>
  >;
  latestItemsCreatedBy?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryLatestItemsCreatedByArgs, 'itemIdentifier'>
  >;
  latestItemsCreatedByWithThread?: Resolver<
    ReadonlyArray<GQLResolversTypes['ThreadWithMessages']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryLatestItemsCreatedByWithThreadArgs, 'itemIdentifier'>
  >;
  locationBank?: Resolver<
    Maybe<GQLResolversTypes['LocationBank']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryLocationBankArgs, 'id'>
  >;
  manualReviewQueue?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewQueue']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryManualReviewQueueArgs, 'id'>
  >;
  me?: Resolver<Maybe<GQLResolversTypes['User']>, ParentType, ContextType>;
  myOrg?: Resolver<Maybe<GQLResolversTypes['Org']>, ParentType, ContextType>;
  ncmecOrgSettings?: Resolver<
    Maybe<GQLResolversTypes['NcmecOrgSettings']>,
    ParentType,
    ContextType
  >;
  ncmecReportById?: Resolver<
    Maybe<GQLResolversTypes['NCMECReport']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryNcmecReportByIdArgs, 'reportId'>
  >;
  ncmecThreads?: Resolver<
    ReadonlyArray<GQLResolversTypes['ThreadWithMessagesAndIpAddress']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryNcmecThreadsArgs, 'reportedMessages' | 'userId'>
  >;
  org?: Resolver<
    Maybe<GQLResolversTypes['Org']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryOrgArgs, 'id'>
  >;
  partialItems?: Resolver<
    GQLResolversTypes['PartialItemsResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryPartialItemsArgs, 'input'>
  >;
  policy?: Resolver<
    Maybe<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryPolicyArgs, 'id'>
  >;
  recentUserStrikeActions?: Resolver<
    ReadonlyArray<GQLResolversTypes['RecentUserStrikeActions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryRecentUserStrikeActionsArgs, 'input'>
  >;
  reportingInsights?: Resolver<
    GQLResolversTypes['ReportingInsights'],
    ParentType,
    ContextType
  >;
  reportingRule?: Resolver<
    Maybe<GQLResolversTypes['ReportingRule']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryReportingRuleArgs, 'id'>
  >;
  rule?: Resolver<
    Maybe<GQLResolversTypes['Rule']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryRuleArgs, 'id'>
  >;
  spotTestRule?: Resolver<
    GQLResolversTypes['RuleExecutionResult'],
    ParentType,
    ContextType,
    RequireFields<GQLQuerySpotTestRuleArgs, 'item' | 'ruleId'>
  >;
  textBank?: Resolver<
    Maybe<GQLResolversTypes['TextBank']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryTextBankArgs, 'id'>
  >;
  threadHistory?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryThreadHistoryArgs, 'threadIdentifier'>
  >;
  topPolicyViolations?: Resolver<
    ReadonlyArray<GQLResolversTypes['PolicyViolationsCount']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryTopPolicyViolationsArgs, 'input'>
  >;
  user?: Resolver<
    Maybe<GQLResolversTypes['User']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryUserArgs, 'id'>
  >;
  userFromToken?: Resolver<
    Maybe<GQLResolversTypes['ID']>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryUserFromTokenArgs, 'token'>
  >;
  userHistory?: Resolver<
    GQLResolversTypes['UserHistoryResponse'],
    ParentType,
    ContextType,
    RequireFields<GQLQueryUserHistoryArgs, 'itemIdentifier'>
  >;
};

export type GQLQueueDoesNotExistErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['QueueDoesNotExistError'] = GQLResolversParentTypes['QueueDoesNotExistError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRecentDecisionsForUserResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RecentDecisionsForUser'] = GQLResolversParentTypes['RecentDecisionsForUser'],
> = {
  recentDecisions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewDecision']>,
    ParentType,
    ContextType
  >;
  userSearchString?: Resolver<
    GQLResolversTypes['String'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRecentUserStrikeActionsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RecentUserStrikeActions'] = GQLResolversParentTypes['RecentUserStrikeActions'],
> = {
  actionId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  itemId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  itemTypeId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  source?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  time?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRecommendedThresholdsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RecommendedThresholds'] = GQLResolversParentTypes['RecommendedThresholds'],
> = {
  highPrecisionThreshold?: Resolver<
    GQLResolversTypes['StringOrFloat'],
    ParentType,
    ContextType
  >;
  highRecallThreshold?: Resolver<
    GQLResolversTypes['StringOrFloat'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRecordingJobDecisionFailedErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RecordingJobDecisionFailedError'] = GQLResolversParentTypes['RecordingJobDecisionFailedError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRejectAppealDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RejectAppealDecisionComponent'] = GQLResolversParentTypes['RejectAppealDecisionComponent'],
> = {
  actionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRemoveAccessibleQueuesToUserResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RemoveAccessibleQueuesToUserResponse'] = GQLResolversParentTypes['RemoveAccessibleQueuesToUserResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateAccessibleQueuesForUserSuccessResponse' | 'NotFoundError',
    ParentType,
    ContextType
  >;
};

export type GQLRemoveFavoriteMrtQueueSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RemoveFavoriteMRTQueueSuccessResponse'] = GQLResolversParentTypes['RemoveFavoriteMRTQueueSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRemoveFavoriteRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RemoveFavoriteRuleResponse'] = GQLResolversParentTypes['RemoveFavoriteRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    'RemoveFavoriteRuleSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLRemoveFavoriteRuleSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RemoveFavoriteRuleSuccessResponse'] = GQLResolversParentTypes['RemoveFavoriteRuleSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReorderRoutingRulesResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReorderRoutingRulesResponse'] = GQLResolversParentTypes['ReorderRoutingRulesResponse'],
> = {
  __resolveType: TypeResolveFn<
    'MutateRoutingRulesOrderSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLReportEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportEnqueueSourceInfo'] = GQLResolversParentTypes['ReportEnqueueSourceInfo'],
> = {
  kind?: Resolver<
    GQLResolversTypes['JobCreationSourceOptions'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportHistoryEntryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportHistoryEntry'] = GQLResolversParentTypes['ReportHistoryEntry'],
> = {
  policyId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  reason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reportId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  reportedAt?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  reporterId?: Resolver<
    Maybe<GQLResolversTypes['ItemIdentifier']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportedForReasonResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportedForReason'] = GQLResolversParentTypes['ReportedForReason'],
> = {
  reason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reporterId?: Resolver<
    Maybe<GQLResolversTypes['ItemIdentifier']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingInsightsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingInsights'] = GQLResolversParentTypes['ReportingInsights'],
> = {
  totalIngestedReportsByDay?: Resolver<
    ReadonlyArray<GQLResolversTypes['CountByDay']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingRuleResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingRule'] = GQLResolversParentTypes['ReportingRule'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  conditionSet?: Resolver<
    GQLResolversTypes['ConditionSet'],
    ParentType,
    ContextType
  >;
  creator?: Resolver<Maybe<GQLResolversTypes['User']>, ParentType, ContextType>;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  insights?: Resolver<
    GQLResolversTypes['ReportingRuleInsights'],
    ParentType,
    ContextType
  >;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  orgId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<
    GQLResolversTypes['ReportingRuleStatus'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingRuleExecutionResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingRuleExecutionResult'] = GQLResolversParentTypes['ReportingRuleExecutionResult'],
> = {
  creatorId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  creatorTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  environment?: Resolver<
    GQLResolversTypes['RuleEnvironment'],
    ParentType,
    ContextType
  >;
  itemData?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  itemId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypeName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  passed?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  policyIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  result?: Resolver<
    Maybe<GQLResolversTypes['ConditionSetWithResult']>,
    ParentType,
    ContextType
  >;
  ruleId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  ruleName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  signalResults?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['SignalWithScore']>>,
    ParentType,
    ContextType
  >;
  ts?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingRuleInsightsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingRuleInsights'] = GQLResolversParentTypes['ReportingRuleInsights'],
> = {
  latestVersionSamples?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportingRuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  passRateData?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportingRulePassRateData']>,
    ParentType,
    ContextType,
    Partial<GQLReportingRuleInsightsPassRateDataArgs>
  >;
  priorVersionSamples?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportingRuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingRuleNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingRuleNameExistsError'] = GQLResolversParentTypes['ReportingRuleNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLReportingRulePassRateDataResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ReportingRulePassRateData'] = GQLResolversParentTypes['ReportingRulePassRateData'],
> = {
  date?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  totalMatches?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  totalRequests?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLResolvedJobCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ResolvedJobCount'] = GQLResolversParentTypes['ResolvedJobCount'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  queueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reviewerId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  time?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRotateApiKeyErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RotateApiKeyError'] = GQLResolversParentTypes['RotateApiKeyError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRotateApiKeyResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RotateApiKeyResponse'] = GQLResolversParentTypes['RotateApiKeyResponse'],
> = {
  __resolveType: TypeResolveFn<
    'RotateApiKeyError' | 'RotateApiKeySuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLRotateApiKeySuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RotateApiKeySuccessResponse'] = GQLResolversParentTypes['RotateApiKeySuccessResponse'],
> = {
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  record?: Resolver<GQLResolversTypes['ApiKey'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRoutingRuleResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RoutingRule'] = GQLResolversParentTypes['RoutingRule'],
> = {
  conditionSet?: Resolver<
    GQLResolversTypes['ConditionSet'],
    ParentType,
    ContextType
  >;
  creatorId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  destinationQueue?: Resolver<
    GQLResolversTypes['ManualReviewQueue'],
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypes?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemType']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<
    GQLResolversTypes['RoutingRuleStatus'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRoutingRuleNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RoutingRuleNameExistsError'] = GQLResolversParentTypes['RoutingRuleNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Rule'] = GQLResolversParentTypes['Rule'],
> = {
  __resolveType: TypeResolveFn<
    'ContentRule' | 'UserRule',
    ParentType,
    ContextType
  >;
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  backtests?: Resolver<
    ReadonlyArray<GQLResolversTypes['Backtest']>,
    ParentType,
    ContextType,
    Partial<GQLRuleBacktestsArgs>
  >;
  conditionSet?: Resolver<
    GQLResolversTypes['ConditionSet'],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  creator?: Resolver<GQLResolversTypes['User'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  expirationTime?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  insights?: Resolver<
    GQLResolversTypes['RuleInsights'],
    ParentType,
    ContextType
  >;
  maxDailyActions?: Resolver<
    Maybe<GQLResolversTypes['Float']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['RuleStatus'], ParentType, ContextType>;
  tags?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['String']>>>,
    ParentType,
    ContextType
  >;
  updatedAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
};

export type GQLRuleExecutionEnqueueSourceInfoResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleExecutionEnqueueSourceInfo'] = GQLResolversParentTypes['RuleExecutionEnqueueSourceInfo'],
> = {
  kind?: Resolver<
    GQLResolversTypes['JobCreationSourceOptions'],
    ParentType,
    ContextType
  >;
  rules?: Resolver<
    ReadonlyArray<GQLResolversTypes['Rule']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleExecutionResultResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleExecutionResult'] = GQLResolversParentTypes['RuleExecutionResult'],
> = {
  content?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  contentId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  date?: Resolver<GQLResolversTypes['Date'], ParentType, ContextType>;
  environment?: Resolver<
    GQLResolversTypes['RuleEnvironment'],
    ParentType,
    ContextType
  >;
  itemTypeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  itemTypeName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  passed?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  result?: Resolver<
    Maybe<GQLResolversTypes['ConditionSetWithResult']>,
    ParentType,
    ContextType
  >;
  ruleId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  ruleName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  signalResults?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['SignalWithScore']>>,
    ParentType,
    ContextType
  >;
  tags?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  ts?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  userId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  userTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleExecutionResultEdgeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleExecutionResultEdge'] = GQLResolversParentTypes['RuleExecutionResultEdge'],
> = {
  cursor?: Resolver<GQLResolversTypes['Cursor'], ParentType, ContextType>;
  node?: Resolver<
    GQLResolversTypes['RuleExecutionResult'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleExecutionResultsConnectionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleExecutionResultsConnection'] = GQLResolversParentTypes['RuleExecutionResultsConnection'],
> = {
  edges?: Resolver<
    ReadonlyArray<GQLResolversTypes['RuleExecutionResultEdge']>,
    ParentType,
    ContextType
  >;
  pageInfo?: Resolver<GQLResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleHasRunningBacktestsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleHasRunningBacktestsError'] = GQLResolversParentTypes['RuleHasRunningBacktestsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleInsightsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleInsights'] = GQLResolversParentTypes['RuleInsights'],
> = {
  latestVersionSamples?: Resolver<
    ReadonlyArray<GQLResolversTypes['RuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  passRateData?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['RulePassRateData']>>>,
    ParentType,
    ContextType,
    Partial<GQLRuleInsightsPassRateDataArgs>
  >;
  priorVersionSamples?: Resolver<
    ReadonlyArray<GQLResolversTypes['RuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRuleNameExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RuleNameExistsError'] = GQLResolversParentTypes['RuleNameExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRulePassRateDataResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RulePassRateData'] = GQLResolversParentTypes['RulePassRateData'],
> = {
  date?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  totalMatches?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  totalRequests?: Resolver<GQLResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLRunRetroactionResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RunRetroactionResponse'] = GQLResolversParentTypes['RunRetroactionResponse'],
> = {
  __resolveType: TypeResolveFn<
    'RunRetroactionSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLRunRetroactionSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['RunRetroactionSuccessResponse'] = GQLResolversParentTypes['RunRetroactionSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLScalarSignalOutputTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ScalarSignalOutputType'] = GQLResolversParentTypes['ScalarSignalOutputType'],
> = {
  scalarType?: Resolver<
    GQLResolversTypes['ScalarType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSchemaFieldRolesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SchemaFieldRoles'] = GQLResolversParentTypes['SchemaFieldRoles'],
> = {
  __resolveType: TypeResolveFn<
    | 'ContentSchemaFieldRoles'
    | 'ThreadSchemaFieldRoles'
    | 'UserSchemaFieldRoles',
    ParentType,
    ContextType
  >;
};

export type GQLSetAllUserStrikeThresholdsSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SetAllUserStrikeThresholdsSuccessResponse'] = GQLResolversParentTypes['SetAllUserStrikeThresholdsSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSetIntegrationConfigResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SetIntegrationConfigResponse'] = GQLResolversParentTypes['SetIntegrationConfigResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'IntegrationConfigTooManyCredentialsError'
    | 'IntegrationEmptyInputCredentialsError'
    | 'IntegrationNoInputCredentialsError'
    | 'SetIntegrationConfigSuccessResponse',
    ParentType,
    ContextType
  >;
};

export type GQLSetIntegrationConfigSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SetIntegrationConfigSuccessResponse'] = GQLResolversParentTypes['SetIntegrationConfigSuccessResponse'],
> = {
  config?: Resolver<
    GQLResolversTypes['IntegrationConfig'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSetModeratorSafetySettingsSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SetModeratorSafetySettingsSuccessResponse'] = GQLResolversParentTypes['SetModeratorSafetySettingsSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSetMrtChartConfigurationSettingsSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SetMrtChartConfigurationSettingsSuccessResponse'] = GQLResolversParentTypes['SetMrtChartConfigurationSettingsSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignUpResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignUpResponse'] = GQLResolversParentTypes['SignUpResponse'],
> = {
  __resolveType: TypeResolveFn<
    'SignUpSuccessResponse' | 'SignUpUserExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLSignUpSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignUpSuccessResponse'] = GQLResolversParentTypes['SignUpSuccessResponse'],
> = {
  data?: Resolver<Maybe<GQLResolversTypes['User']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignUpUserExistsErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignUpUserExistsError'] = GQLResolversParentTypes['SignUpUserExistsError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignalResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['Signal'] = GQLResolversParentTypes['Signal'],
> = {
  allowedInAutomatedRules?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  args?: Resolver<
    Maybe<GQLResolversTypes['SignalArgs']>,
    ParentType,
    ContextType
  >;
  callbackUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  callbackUrlBody?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  callbackUrlHeaders?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  disabledInfo?: Resolver<
    GQLResolversTypes['DisabledInfo'],
    ParentType,
    ContextType
  >;
  docsUrl?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  eligibleInputs?: Resolver<
    ReadonlyArray<GQLResolversTypes['SignalInputType']>,
    ParentType,
    ContextType
  >;
  eligibleSubcategories?: Resolver<
    ReadonlyArray<GQLResolversTypes['SignalSubcategory']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  integration?: Resolver<
    Maybe<GQLResolversTypes['Integration']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  outputType?: Resolver<
    GQLResolversTypes['SignalOutputType'],
    ParentType,
    ContextType
  >;
  pricingStructure?: Resolver<
    GQLResolversTypes['SignalPricingStructure'],
    ParentType,
    ContextType
  >;
  recommendedThresholds?: Resolver<
    Maybe<GQLResolversTypes['RecommendedThresholds']>,
    ParentType,
    ContextType
  >;
  shouldPromptForMatchingValues?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  subcategory?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  supportedLanguages?: Resolver<
    GQLResolversTypes['SupportedLanguages'],
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['SignalType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignalArgsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignalArgs'] = GQLResolversParentTypes['SignalArgs'],
> = {
  __resolveType: TypeResolveFn<
    'AggregationSignalArgs',
    ParentType,
    ContextType
  >;
};

export type GQLSignalOutputTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignalOutputType'] = GQLResolversParentTypes['SignalOutputType'],
> = {
  __resolveType: TypeResolveFn<
    'EnumSignalOutputType' | 'ScalarSignalOutputType',
    ParentType,
    ContextType
  >;
};

export type GQLSignalPricingStructureResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignalPricingStructure'] = GQLResolversParentTypes['SignalPricingStructure'],
> = {
  type?: Resolver<
    GQLResolversTypes['SignalPricingStructureType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignalSubcategoryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignalSubcategory'] = GQLResolversParentTypes['SignalSubcategory'],
> = {
  childrenIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  label?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSignalWithScoreResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SignalWithScore'] = GQLResolversParentTypes['SignalWithScore'],
> = {
  integration?: Resolver<
    Maybe<GQLResolversTypes['Integration']>,
    ParentType,
    ContextType
  >;
  score?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  signalName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  subcategory?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSkippedJobResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SkippedJob'] = GQLResolversParentTypes['SkippedJob'],
> = {
  jobId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  queueId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  ts?: Resolver<GQLResolversTypes['DateTime'], ParentType, ContextType>;
  userId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSkippedJobCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SkippedJobCount'] = GQLResolversParentTypes['SkippedJobCount'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  queueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reviewerId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  time?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface GQLStringOrFloatScalarConfig
  extends GraphQLScalarTypeConfig<GQLResolversTypes['StringOrFloat'], any> {
  name: 'StringOrFloat';
}

export type GQLSubmitDecisionResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SubmitDecisionResponse'] = GQLResolversParentTypes['SubmitDecisionResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'JobHasAlreadyBeenSubmittedError'
    | 'NoJobWithIdInQueueError'
    | 'RecordingJobDecisionFailedError'
    | 'SubmitDecisionSuccessResponse'
    | 'SubmittedJobActionNotFoundError',
    ParentType,
    ContextType
  >;
};

export type GQLSubmitDecisionSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SubmitDecisionSuccessResponse'] = GQLResolversParentTypes['SubmitDecisionSuccessResponse'],
> = {
  success?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSubmitNcmecReportDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SubmitNCMECReportDecisionComponent'] = GQLResolversParentTypes['SubmitNCMECReportDecisionComponent'],
> = {
  reportedMedia?: Resolver<
    ReadonlyArray<GQLResolversTypes['NcmecReportedMediaDetails']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSubmittedJobActionNotFoundErrorResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SubmittedJobActionNotFoundError'] = GQLResolversParentTypes['SubmittedJobActionNotFoundError'],
> = {
  detail?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  pointer?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLSupportedLanguagesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['SupportedLanguages'] = GQLResolversParentTypes['SupportedLanguages'],
> = {
  __resolveType: TypeResolveFn<
    'AllLanguages' | 'Languages',
    ParentType,
    ContextType
  >;
};

export type GQLTableDecisionCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['TableDecisionCount'] = GQLResolversParentTypes['TableDecisionCount'],
> = {
  action_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  queue_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reviewer_id?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLTextBankResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['TextBank'] = GQLResolversParentTypes['TextBank'],
> = {
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  strings?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['TextBankType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadAppealManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadAppealManualReviewJobPayload'] = GQLResolversParentTypes['ThreadAppealManualReviewJobPayload'],
> = {
  actionsTaken?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  appealReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealerIdentifier?: Resolver<
    Maybe<GQLResolversTypes['ItemIdentifier']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['AppealEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['ThreadItem'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadItemResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadItem'] = GQLResolversParentTypes['ThreadItem'],
> = {
  data?: Resolver<GQLResolversTypes['JSONObject'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionTime?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['ThreadItemType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadItemTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadItemType'] = GQLResolversParentTypes['ThreadItemType'],
> = {
  baseFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['BaseField']>,
    ParentType,
    ContextType
  >;
  derivedFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['DerivedField']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  hiddenFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  schemaFieldRoles?: Resolver<
    GQLResolversTypes['ThreadSchemaFieldRoles'],
    ParentType,
    ContextType
  >;
  schemaVariant?: Resolver<
    GQLResolversTypes['ItemTypeSchemaVariant'],
    ParentType,
    ContextType
  >;
  version?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadManualReviewJobPayload'] = GQLResolversParentTypes['ThreadManualReviewJobPayload'],
> = {
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJobEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['ThreadItem'], ParentType, ContextType>;
  reportHistory?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportHistoryEntry']>,
    ParentType,
    ContextType
  >;
  reportedForReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  reportedForReasons?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportedForReason']>,
    ParentType,
    ContextType
  >;
  threadItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemWithParents']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadSchemaFieldRolesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadSchemaFieldRoles'] = GQLResolversParentTypes['ThreadSchemaFieldRoles'],
> = {
  createdAt?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  creatorId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  displayName?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  isDeleted?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadWithMessagesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadWithMessages'] = GQLResolversParentTypes['ThreadWithMessages'],
> = {
  messages?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType
  >;
  threadId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  threadTypeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLThreadWithMessagesAndIpAddressResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ThreadWithMessagesAndIpAddress'] = GQLResolversParentTypes['ThreadWithMessagesAndIpAddress'],
> = {
  messages?: Resolver<
    ReadonlyArray<GQLResolversTypes['MessageWithIpAddress']>,
    ParentType,
    ContextType
  >;
  threadId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  threadTypeId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLTimeToActionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['TimeToAction'] = GQLResolversParentTypes['TimeToAction'],
> = {
  itemTypeId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  queueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  timeToAction?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLTransformJobAndRecreateInQueueDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['TransformJobAndRecreateInQueueDecisionComponent'] = GQLResolversParentTypes['TransformJobAndRecreateInQueueDecisionComponent'],
> = {
  newJobKind?: Resolver<
    GQLResolversTypes['ManualReviewJobKind'],
    ParentType,
    ContextType
  >;
  newQueueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  originalQueueId?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  policyIds?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUpdateContentRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateContentRuleResponse'] = GQLResolversParentTypes['UpdateContentRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'MutateContentRuleSuccessResponse'
    | 'NotFoundError'
    | 'RuleHasRunningBacktestsError'
    | 'RuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateManualReviewQueueQueueResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateManualReviewQueueQueueResponse'] = GQLResolversParentTypes['UpdateManualReviewQueueQueueResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'ManualReviewQueueNameExistsError'
    | 'MutateManualReviewQueueSuccessResponse'
    | 'NotFoundError',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateNcmecOrgSettingsResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateNcmecOrgSettingsResponse'] = GQLResolversParentTypes['UpdateNcmecOrgSettingsResponse'],
> = {
  success?: Resolver<GQLResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUpdateOrgInfoSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateOrgInfoSuccessResponse'] = GQLResolversParentTypes['UpdateOrgInfoSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUpdatePolicyResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdatePolicyResponse'] = GQLResolversParentTypes['UpdatePolicyResponse'],
> = {
  __resolveType: TypeResolveFn<
    'NotFoundError' | 'Policy',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateReportingRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateReportingRuleResponse'] = GQLResolversParentTypes['UpdateReportingRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'MutateReportingRuleSuccessResponse'
    | 'NotFoundError'
    | 'ReportingRuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateRoutingRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateRoutingRuleResponse'] = GQLResolversParentTypes['UpdateRoutingRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'MutateRoutingRuleSuccessResponse'
    | 'NotFoundError'
    | 'QueueDoesNotExistError'
    | 'RoutingRuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateUserRuleResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateUserRuleResponse'] = GQLResolversParentTypes['UpdateUserRuleResponse'],
> = {
  __resolveType: TypeResolveFn<
    | 'MutateUserRuleSuccessResponse'
    | 'NotFoundError'
    | 'RuleHasRunningBacktestsError'
    | 'RuleNameExistsError',
    ParentType,
    ContextType
  >;
};

export type GQLUpdateUserStrikeTtlSuccessResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UpdateUserStrikeTTLSuccessResponse'] = GQLResolversParentTypes['UpdateUserStrikeTTLSuccessResponse'],
> = {
  _?: Resolver<Maybe<GQLResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['User'] = GQLResolversParentTypes['User'],
> = {
  approvedByAdmin?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  favoriteMRTQueues?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewQueue']>,
    ParentType,
    ContextType
  >;
  favoriteRules?: Resolver<
    ReadonlyArray<GQLResolversTypes['Rule']>,
    ParentType,
    ContextType
  >;
  firstName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  interfacePreferences?: Resolver<
    GQLResolversTypes['UserInterfacePreferences'],
    ParentType,
    ContextType
  >;
  lastName?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  loginMethods?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  notifications?: Resolver<
    GQLResolversTypes['UserNotifications'],
    ParentType,
    ContextType
  >;
  orgId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  permissions?: Resolver<
    ReadonlyArray<GQLResolversTypes['UserPermission']>,
    ParentType,
    ContextType
  >;
  readMeJWT?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  rejectedByAdmin?: Resolver<
    Maybe<GQLResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  reviewableQueues?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewQueue']>,
    ParentType,
    ContextType,
    Partial<GQLUserReviewableQueuesArgs>
  >;
  role?: Resolver<
    Maybe<GQLResolversTypes['UserRole']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserActionsHistoryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserActionsHistory'] = GQLResolversParentTypes['UserActionsHistory'],
> = {
  countsByPolicy?: Resolver<
    ReadonlyArray<GQLResolversTypes['PolicyActionCount']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserAppealManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserAppealManualReviewJobPayload'] = GQLResolversParentTypes['UserAppealManualReviewJobPayload'],
> = {
  actionsTaken?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  additionalContentItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ContentItem']>,
    ParentType,
    ContextType
  >;
  appealId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  appealReason?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  appealerIdentifier?: Resolver<
    Maybe<GQLResolversTypes['ItemIdentifier']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['AppealEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['UserItem'], ParentType, ContextType>;
  reportedItems?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['ItemIdentifier']>>>,
    ParentType,
    ContextType
  >;
  userScore?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserHistoryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserHistory'] = GQLResolversParentTypes['UserHistory'],
> = {
  actions?: Resolver<
    GQLResolversTypes['UserActionsHistory'],
    ParentType,
    ContextType
  >;
  executions?: Resolver<
    ReadonlyArray<GQLResolversTypes['RuleExecutionResult']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissions?: Resolver<
    GQLResolversTypes['UserSubmissionsHistory'],
    ParentType,
    ContextType
  >;
  user?: Resolver<
    Maybe<GQLResolversTypes['UserItem']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserHistoryResponseResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserHistoryResponse'] = GQLResolversParentTypes['UserHistoryResponse'],
> = {
  __resolveType: TypeResolveFn<
    'NotFoundError' | 'UserHistory',
    ParentType,
    ContextType
  >;
};

export type GQLUserInterfacePreferencesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserInterfacePreferences'] = GQLResolversParentTypes['UserInterfacePreferences'],
> = {
  moderatorSafetyBlurLevel?: Resolver<
    GQLResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  moderatorSafetyGrayscale?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  moderatorSafetyMuteVideo?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  moderatorSafetySepia?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  mrtChartConfigurations?: Resolver<
    ReadonlyArray<GQLResolversTypes['ManualReviewChartSettings']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserItemResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserItem'] = GQLResolversParentTypes['UserItem'],
> = {
  data?: Resolver<GQLResolversTypes['JSONObject'], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionId?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  submissionTime?: Resolver<
    Maybe<GQLResolversTypes['DateTime']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<GQLResolversTypes['UserItemType'], ParentType, ContextType>;
  userScore?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserItemTypeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserItemType'] = GQLResolversParentTypes['UserItemType'],
> = {
  baseFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['BaseField']>,
    ParentType,
    ContextType
  >;
  derivedFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['DerivedField']>,
    ParentType,
    ContextType
  >;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  hiddenFields?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  isDefaultUserType?: Resolver<
    GQLResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  schemaFieldRoles?: Resolver<
    GQLResolversTypes['UserSchemaFieldRoles'],
    ParentType,
    ContextType
  >;
  schemaVariant?: Resolver<
    GQLResolversTypes['ItemTypeSchemaVariant'],
    ParentType,
    ContextType
  >;
  version?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserManualReviewJobPayloadResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserManualReviewJobPayload'] = GQLResolversParentTypes['UserManualReviewJobPayload'],
> = {
  additionalContentItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ContentItem']>,
    ParentType,
    ContextType
  >;
  enqueueSourceInfo?: Resolver<
    Maybe<GQLResolversTypes['ManualReviewJobEnqueueSourceInfo']>,
    ParentType,
    ContextType
  >;
  item?: Resolver<GQLResolversTypes['UserItem'], ParentType, ContextType>;
  itemThreadContentItems?: Resolver<
    Maybe<ReadonlyArray<GQLResolversTypes['ContentItem']>>,
    ParentType,
    ContextType
  >;
  reportHistory?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportHistoryEntry']>,
    ParentType,
    ContextType
  >;
  reportedForReasons?: Resolver<
    ReadonlyArray<GQLResolversTypes['ReportedForReason']>,
    ParentType,
    ContextType
  >;
  reportedItems?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['ItemIdentifier']>>>,
    ParentType,
    ContextType
  >;
  userScore?: Resolver<
    Maybe<GQLResolversTypes['Int']>,
    ParentType,
    ContextType
  >;
  userSubmittedItems?: Resolver<
    ReadonlyArray<GQLResolversTypes['ItemSubmissions']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserNotificationEdgeResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserNotificationEdge'] = GQLResolversParentTypes['UserNotificationEdge'],
> = {
  node?: Resolver<GQLResolversTypes['Notification'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserNotificationsResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserNotifications'] = GQLResolversParentTypes['UserNotifications'],
> = {
  edges?: Resolver<
    ReadonlyArray<GQLResolversTypes['UserNotificationEdge']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserOrRelatedActionDecisionComponentResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserOrRelatedActionDecisionComponent'] = GQLResolversParentTypes['UserOrRelatedActionDecisionComponent'],
> = {
  actionIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  customMrtApiParams?: Resolver<
    Maybe<GQLResolversTypes['JSONObject']>,
    ParentType,
    ContextType
  >;
  itemIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  itemTypeId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  policyIds?: Resolver<
    ReadonlyArray<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  type?: Resolver<
    GQLResolversTypes['ManualReviewDecisionType'],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserRuleResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserRule'] = GQLResolversParentTypes['UserRule'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['Action']>,
    ParentType,
    ContextType
  >;
  backtests?: Resolver<
    ReadonlyArray<GQLResolversTypes['Backtest']>,
    ParentType,
    ContextType,
    Partial<GQLUserRuleBacktestsArgs>
  >;
  conditionSet?: Resolver<
    GQLResolversTypes['ConditionSet'],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  creator?: Resolver<GQLResolversTypes['User'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  expirationTime?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['ID'], ParentType, ContextType>;
  insights?: Resolver<
    GQLResolversTypes['RuleInsights'],
    ParentType,
    ContextType
  >;
  maxDailyActions?: Resolver<
    Maybe<GQLResolversTypes['Float']>,
    ParentType,
    ContextType
  >;
  name?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<GQLResolversTypes['ID']>, ParentType, ContextType>;
  policies?: Resolver<
    ReadonlyArray<GQLResolversTypes['Policy']>,
    ParentType,
    ContextType
  >;
  status?: Resolver<GQLResolversTypes['RuleStatus'], ParentType, ContextType>;
  tags?: Resolver<
    Maybe<ReadonlyArray<Maybe<GQLResolversTypes['String']>>>,
    ParentType,
    ContextType
  >;
  updatedAt?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserSchemaFieldRolesResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserSchemaFieldRoles'] = GQLResolversParentTypes['UserSchemaFieldRoles'],
> = {
  backgroundImage?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  displayName?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  isDeleted?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  profileIcon?: Resolver<
    Maybe<GQLResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserStrikeBucketResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserStrikeBucket'] = GQLResolversParentTypes['UserStrikeBucket'],
> = {
  numStrikes?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  numUsers?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserStrikeThresholdResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserStrikeThreshold'] = GQLResolversParentTypes['UserStrikeThreshold'],
> = {
  actions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ID']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  threshold?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserSubmissionCountResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserSubmissionCount'] = GQLResolversParentTypes['UserSubmissionCount'],
> = {
  count?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  itemTypeId?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLUserSubmissionsHistoryResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['UserSubmissionsHistory'] = GQLResolversParentTypes['UserSubmissionsHistory'],
> = {
  countsByItemType?: Resolver<
    ReadonlyArray<GQLResolversTypes['UserSubmissionCount']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLWindowConfigurationResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['WindowConfiguration'] = GQLResolversParentTypes['WindowConfiguration'],
> = {
  hopMs?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  sizeMs?: Resolver<GQLResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLZentropiIntegrationApiCredentialResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ZentropiIntegrationApiCredential'] = GQLResolversParentTypes['ZentropiIntegrationApiCredential'],
> = {
  apiKey?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  labelerVersions?: Resolver<
    ReadonlyArray<GQLResolversTypes['ZentropiLabelerVersion']>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLZentropiLabelerVersionResolvers<
  ContextType = Context,
  ParentType extends
    GQLResolversParentTypes['ZentropiLabelerVersion'] = GQLResolversParentTypes['ZentropiLabelerVersion'],
> = {
  id?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  label?: Resolver<GQLResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GQLResolvers<ContextType = Context> = {
  AcceptAppealDecisionComponent?: GQLAcceptAppealDecisionComponentResolvers<ContextType>;
  Action?: GQLActionResolvers<ContextType>;
  ActionBase?: GQLActionBaseResolvers<ContextType>;
  ActionData?: GQLActionDataResolvers<ContextType>;
  ActionNameExistsError?: GQLActionNameExistsErrorResolvers<ContextType>;
  AddAccessibleQueuesToUserResponse?: GQLAddAccessibleQueuesToUserResponseResolvers<ContextType>;
  AddCommentFailedError?: GQLAddCommentFailedErrorResolvers<ContextType>;
  AddFavoriteMRTQueueSuccessResponse?: GQLAddFavoriteMrtQueueSuccessResponseResolvers<ContextType>;
  AddFavoriteRuleResponse?: GQLAddFavoriteRuleResponseResolvers<ContextType>;
  AddFavoriteRuleSuccessResponse?: GQLAddFavoriteRuleSuccessResponseResolvers<ContextType>;
  AddManualReviewJobCommentResponse?: GQLAddManualReviewJobCommentResponseResolvers<ContextType>;
  AddManualReviewJobCommentSuccessResponse?: GQLAddManualReviewJobCommentSuccessResponseResolvers<ContextType>;
  AddPoliciesResponse?: GQLAddPoliciesResponseResolvers<ContextType>;
  Aggregation?: GQLAggregationResolvers<ContextType>;
  AggregationClause?: GQLAggregationClauseResolvers<ContextType>;
  AggregationSignalArgs?: GQLAggregationSignalArgsResolvers<ContextType>;
  AllLanguages?: GQLAllLanguagesResolvers<ContextType>;
  AllRuleInsights?: GQLAllRuleInsightsResolvers<ContextType>;
  ApiKey?: GQLApiKeyResolvers<ContextType>;
  AppealEnqueueSourceInfo?: GQLAppealEnqueueSourceInfoResolvers<ContextType>;
  AppealSettings?: GQLAppealSettingsResolvers<ContextType>;
  AutomaticCloseDecisionComponent?: GQLAutomaticCloseDecisionComponentResolvers<ContextType>;
  Backtest?: GQLBacktestResolvers<ContextType>;
  BaseField?: GQLBaseFieldResolvers<ContextType>;
  CannotDeleteDefaultUserError?: GQLCannotDeleteDefaultUserErrorResolvers<ContextType>;
  ChangePasswordError?: GQLChangePasswordErrorResolvers<ContextType>;
  ChangePasswordResponse?: GQLChangePasswordResponseResolvers<ContextType>;
  ChangePasswordSuccessResponse?: GQLChangePasswordSuccessResponseResolvers<ContextType>;
  Condition?: GQLConditionResolvers<ContextType>;
  ConditionInputField?: GQLConditionInputFieldResolvers<ContextType>;
  ConditionResult?: GQLConditionResultResolvers<ContextType>;
  ConditionSet?: GQLConditionSetResolvers<ContextType>;
  ConditionSetWithResult?: GQLConditionSetWithResultResolvers<ContextType>;
  ConditionWithResult?: GQLConditionWithResultResolvers<ContextType>;
  Container?: GQLContainerResolvers<ContextType>;
  ContentAppealManualReviewJobPayload?: GQLContentAppealManualReviewJobPayloadResolvers<ContextType>;
  ContentItem?: GQLContentItemResolvers<ContextType>;
  ContentItemType?: GQLContentItemTypeResolvers<ContextType>;
  ContentManualReviewJobPayload?: GQLContentManualReviewJobPayloadResolvers<ContextType>;
  ContentRule?: GQLContentRuleResolvers<ContextType>;
  ContentSchemaFieldRoles?: GQLContentSchemaFieldRolesResolvers<ContextType>;
  ContentType?: GQLContentTypeResolvers<ContextType>;
  CoopInputOrString?: GraphQLScalarType;
  CountByActionByDay?: GQLCountByActionByDayResolvers<ContextType>;
  CountByActionByDayAction?: GQLCountByActionByDayActionResolvers<ContextType>;
  CountByDay?: GQLCountByDayResolvers<ContextType>;
  CountByDecisionTypeByDay?: GQLCountByDecisionTypeByDayResolvers<ContextType>;
  CountByPolicyByDay?: GQLCountByPolicyByDayResolvers<ContextType>;
  CountByPolicyByDayPolicy?: GQLCountByPolicyByDayPolicyResolvers<ContextType>;
  CountByTagByDay?: GQLCountByTagByDayResolvers<ContextType>;
  CreateBacktestResponse?: GQLCreateBacktestResponseResolvers<ContextType>;
  CreateContentRuleResponse?: GQLCreateContentRuleResponseResolvers<ContextType>;
  CreateManualReviewQueueResponse?: GQLCreateManualReviewQueueResponseResolvers<ContextType>;
  CreateOrgResponse?: GQLCreateOrgResponseResolvers<ContextType>;
  CreateOrgSuccessResponse?: GQLCreateOrgSuccessResponseResolvers<ContextType>;
  CreateReportingRuleResponse?: GQLCreateReportingRuleResponseResolvers<ContextType>;
  CreateRoutingRuleResponse?: GQLCreateRoutingRuleResponseResolvers<ContextType>;
  CreateUserRuleResponse?: GQLCreateUserRuleResponseResolvers<ContextType>;
  Cursor?: GraphQLScalarType;
  CustomAction?: GQLCustomActionResolvers<ContextType>;
  CustomMrtApiParamSpec?: GQLCustomMrtApiParamSpecResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  DecisionCount?: GQLDecisionCountResolvers<ContextType>;
  DecisionCountFilterBy?: GQLDecisionCountFilterByResolvers<ContextType>;
  DeleteAllJobsFromQueueResponse?: GQLDeleteAllJobsFromQueueResponseResolvers<ContextType>;
  DeleteAllJobsFromQueueSuccessResponse?: GQLDeleteAllJobsFromQueueSuccessResponseResolvers<ContextType>;
  DeleteAllJobsUnauthorizedError?: GQLDeleteAllJobsUnauthorizedErrorResolvers<ContextType>;
  DeleteItemTypeResponse?: GQLDeleteItemTypeResponseResolvers<ContextType>;
  DeleteItemTypeSuccessResponse?: GQLDeleteItemTypeSuccessResponseResolvers<ContextType>;
  DequeueManualReviewJobResponse?: GQLDequeueManualReviewJobResponseResolvers<ContextType>;
  DequeueManualReviewJobSuccessResponse?: GQLDequeueManualReviewJobSuccessResponseResolvers<ContextType>;
  DerivedField?: GQLDerivedFieldResolvers<ContextType>;
  DerivedFieldCoopInputSource?: GQLDerivedFieldCoopInputSourceResolvers<ContextType>;
  DerivedFieldFieldSource?: GQLDerivedFieldFieldSourceResolvers<ContextType>;
  DerivedFieldFullItemSource?: GQLDerivedFieldFullItemSourceResolvers<ContextType>;
  DerivedFieldSource?: GQLDerivedFieldSourceResolvers<ContextType>;
  DerivedFieldSpec?: GQLDerivedFieldSpecResolvers<ContextType>;
  DisabledInfo?: GQLDisabledInfoResolvers<ContextType>;
  EnqueueAuthorToMrtAction?: GQLEnqueueAuthorToMrtActionResolvers<ContextType>;
  EnqueueToMrtAction?: GQLEnqueueToMrtActionResolvers<ContextType>;
  EnqueueToNcmecAction?: GQLEnqueueToNcmecActionResolvers<ContextType>;
  EnumSignalOutputType?: GQLEnumSignalOutputTypeResolvers<ContextType>;
  Error?: GQLErrorResolvers<ContextType>;
  ExecuteActionResponse?: GQLExecuteActionResponseResolvers<ContextType>;
  ExecuteBulkActionResponse?: GQLExecuteBulkActionResponseResolvers<ContextType>;
  Field?: GQLFieldResolvers<ContextType>;
  GetDecisionCountSettings?: GQLGetDecisionCountSettingsResolvers<ContextType>;
  GetFullReportingRuleResultForItemResponse?: GQLGetFullReportingRuleResultForItemResponseResolvers<ContextType>;
  GetFullResultForItemResponse?: GQLGetFullResultForItemResponseResolvers<ContextType>;
  GetJobCreationCountSettings?: GQLGetJobCreationCountSettingsResolvers<ContextType>;
  GoogleContentSafetyApiIntegrationApiCredential?: GQLGoogleContentSafetyApiIntegrationApiCredentialResolvers<ContextType>;
  GooglePlaceLocationInfo?: GQLGooglePlaceLocationInfoResolvers<ContextType>;
  HashBank?: GQLHashBankResolvers<ContextType>;
  IgnoreDecisionComponent?: GQLIgnoreDecisionComponentResolvers<ContextType>;
  IntegrationApiCredential?: GQLIntegrationApiCredentialResolvers<ContextType>;
  IntegrationConfig?: GQLIntegrationConfigResolvers<ContextType>;
  IntegrationConfigQueryResponse?: GQLIntegrationConfigQueryResponseResolvers<ContextType>;
  IntegrationConfigSuccessResult?: GQLIntegrationConfigSuccessResultResolvers<ContextType>;
  IntegrationConfigTooManyCredentialsError?: GQLIntegrationConfigTooManyCredentialsErrorResolvers<ContextType>;
  IntegrationConfigUnsupportedIntegrationError?: GQLIntegrationConfigUnsupportedIntegrationErrorResolvers<ContextType>;
  IntegrationEmptyInputCredentialsError?: GQLIntegrationEmptyInputCredentialsErrorResolvers<ContextType>;
  IntegrationNoInputCredentialsError?: GQLIntegrationNoInputCredentialsErrorResolvers<ContextType>;
  InviteUserToken?: GQLInviteUserTokenResolvers<ContextType>;
  InviteUserTokenExpiredError?: GQLInviteUserTokenExpiredErrorResolvers<ContextType>;
  InviteUserTokenMissingError?: GQLInviteUserTokenMissingErrorResolvers<ContextType>;
  InviteUserTokenResponse?: GQLInviteUserTokenResponseResolvers<ContextType>;
  InviteUserTokenSuccessResponse?: GQLInviteUserTokenSuccessResponseResolvers<ContextType>;
  IpAddress?: GQLIpAddressResolvers<ContextType>;
  Item?: GQLItemResolvers<ContextType>;
  ItemAction?: GQLItemActionResolvers<ContextType>;
  ItemBase?: GQLItemBaseResolvers<ContextType>;
  ItemHistoryResponse?: GQLItemHistoryResponseResolvers<ContextType>;
  ItemHistoryResult?: GQLItemHistoryResultResolvers<ContextType>;
  ItemIdentifier?: GQLItemIdentifierResolvers<ContextType>;
  ItemSubmissions?: GQLItemSubmissionsResolvers<ContextType>;
  ItemType?: GQLItemTypeResolvers<ContextType>;
  ItemTypeBase?: GQLItemTypeBaseResolvers<ContextType>;
  ItemTypeIdentifier?: GQLItemTypeIdentifierResolvers<ContextType>;
  ItemTypeNameAlreadyExistsError?: GQLItemTypeNameAlreadyExistsErrorResolvers<ContextType>;
  ItemTypeSchemaVariant?: GQLItemTypeSchemaVariantResolvers;
  ItemTypeSchemaVariantInput?: GQLItemTypeSchemaVariantInputResolvers;
  ItemWithParents?: GQLItemWithParentsResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  JobCreationCount?: GQLJobCreationCountResolvers<ContextType>;
  JobCreationFilterBy?: GQLJobCreationFilterByResolvers<ContextType>;
  JobHasAlreadyBeenSubmittedError?: GQLJobHasAlreadyBeenSubmittedErrorResolvers<ContextType>;
  Languages?: GQLLanguagesResolvers<ContextType>;
  LatLng?: GQLLatLngResolvers<ContextType>;
  LeafCondition?: GQLLeafConditionResolvers<ContextType>;
  LeafConditionWithResult?: GQLLeafConditionWithResultResolvers<ContextType>;
  LocationArea?: GQLLocationAreaResolvers<ContextType>;
  LocationBank?: GQLLocationBankResolvers<ContextType>;
  LocationBankNameExistsError?: GQLLocationBankNameExistsErrorResolvers<ContextType>;
  LocationGeometry?: GQLLocationGeometryResolvers<ContextType>;
  LoginIncorrectPasswordError?: GQLLoginIncorrectPasswordErrorResolvers<ContextType>;
  LoginResponse?: GQLLoginResponseResolvers<ContextType>;
  LoginSsoRequiredError?: GQLLoginSsoRequiredErrorResolvers<ContextType>;
  LoginSuccessResponse?: GQLLoginSuccessResponseResolvers<ContextType>;
  LoginUserDoesNotExistError?: GQLLoginUserDoesNotExistErrorResolvers<ContextType>;
  ManualReviewChartSettings?: GQLManualReviewChartSettingsResolvers<ContextType>;
  ManualReviewDecision?: GQLManualReviewDecisionResolvers<ContextType>;
  ManualReviewDecisionComponent?: GQLManualReviewDecisionComponentResolvers<ContextType>;
  ManualReviewDecisionComponentBase?: GQLManualReviewDecisionComponentBaseResolvers<ContextType>;
  ManualReviewExistingJob?: GQLManualReviewExistingJobResolvers<ContextType>;
  ManualReviewJob?: GQLManualReviewJobResolvers<ContextType>;
  ManualReviewJobComment?: GQLManualReviewJobCommentResolvers<ContextType>;
  ManualReviewJobEnqueueSourceInfo?: GQLManualReviewJobEnqueueSourceInfoResolvers<ContextType>;
  ManualReviewJobPayload?: GQLManualReviewJobPayloadResolvers<ContextType>;
  ManualReviewJobWithDecisions?: GQLManualReviewJobWithDecisionsResolvers<ContextType>;
  ManualReviewQueue?: GQLManualReviewQueueResolvers<ContextType>;
  ManualReviewQueueNameExistsError?: GQLManualReviewQueueNameExistsErrorResolvers<ContextType>;
  MatchingBankNameExistsError?: GQLMatchingBankNameExistsErrorResolvers<ContextType>;
  MatchingBanks?: GQLMatchingBanksResolvers<ContextType>;
  MatchingValues?: GQLMatchingValuesResolvers<ContextType>;
  MessageWithIpAddress?: GQLMessageWithIpAddressResolvers<ContextType>;
  MrtJobEnqueueSourceInfo?: GQLMrtJobEnqueueSourceInfoResolvers<ContextType>;
  MutateAccessibleQueuesForUserSuccessResponse?: GQLMutateAccessibleQueuesForUserSuccessResponseResolvers<ContextType>;
  MutateActionResponse?: GQLMutateActionResponseResolvers<ContextType>;
  MutateActionSuccessResponse?: GQLMutateActionSuccessResponseResolvers<ContextType>;
  MutateBankResponse?: GQLMutateBankResponseResolvers<ContextType>;
  MutateContentItemTypeResponse?: GQLMutateContentItemTypeResponseResolvers<ContextType>;
  MutateContentRuleSuccessResponse?: GQLMutateContentRuleSuccessResponseResolvers<ContextType>;
  MutateContentTypeSuccessResponse?: GQLMutateContentTypeSuccessResponseResolvers<ContextType>;
  MutateHashBankResponse?: GQLMutateHashBankResponseResolvers<ContextType>;
  MutateHashBankSuccessResponse?: GQLMutateHashBankSuccessResponseResolvers<ContextType>;
  MutateLocationBankResponse?: GQLMutateLocationBankResponseResolvers<ContextType>;
  MutateLocationBankSuccessResponse?: GQLMutateLocationBankSuccessResponseResolvers<ContextType>;
  MutateManualReviewQueueSuccessResponse?: GQLMutateManualReviewQueueSuccessResponseResolvers<ContextType>;
  MutateReportingRuleSuccessResponse?: GQLMutateReportingRuleSuccessResponseResolvers<ContextType>;
  MutateRoutingRuleSuccessResponse?: GQLMutateRoutingRuleSuccessResponseResolvers<ContextType>;
  MutateRoutingRulesOrderSuccessResponse?: GQLMutateRoutingRulesOrderSuccessResponseResolvers<ContextType>;
  MutateThreadItemTypeResponse?: GQLMutateThreadItemTypeResponseResolvers<ContextType>;
  MutateThreadTypeSuccessResponse?: GQLMutateThreadTypeSuccessResponseResolvers<ContextType>;
  MutateUserItemTypeResponse?: GQLMutateUserItemTypeResponseResolvers<ContextType>;
  MutateUserRuleSuccessResponse?: GQLMutateUserRuleSuccessResponseResolvers<ContextType>;
  MutateUserTypeSuccessResponse?: GQLMutateUserTypeSuccessResponseResolvers<ContextType>;
  Mutation?: GQLMutationResolvers<ContextType>;
  NCMECReport?: GQLNcmecReportResolvers<ContextType>;
  NCMECReportedMedia?: GQLNcmecReportedMediaResolvers<ContextType>;
  NCMECReportedThread?: GQLNcmecReportedThreadResolvers<ContextType>;
  NcmecAdditionalFile?: GQLNcmecAdditionalFileResolvers<ContextType>;
  NcmecContentItem?: GQLNcmecContentItemResolvers<ContextType>;
  NcmecManualReviewJobPayload?: GQLNcmecManualReviewJobPayloadResolvers<ContextType>;
  NcmecOrgSettings?: GQLNcmecOrgSettingsResolvers<ContextType>;
  NcmecReportedMediaDetails?: GQLNcmecReportedMediaDetailsResolvers<ContextType>;
  NoJobWithIdInQueueError?: GQLNoJobWithIdInQueueErrorResolvers<ContextType>;
  NonEmptyString?: GraphQLScalarType;
  NotFoundError?: GQLNotFoundErrorResolvers<ContextType>;
  Notification?: GQLNotificationResolvers<ContextType>;
  OpenAiIntegrationApiCredential?: GQLOpenAiIntegrationApiCredentialResolvers<ContextType>;
  Org?: GQLOrgResolvers<ContextType>;
  OrgWithEmailExistsError?: GQLOrgWithEmailExistsErrorResolvers<ContextType>;
  OrgWithNameExistsError?: GQLOrgWithNameExistsErrorResolvers<ContextType>;
  PageInfo?: GQLPageInfoResolvers<ContextType>;
  PartialItemsEndpointResponseError?: GQLPartialItemsEndpointResponseErrorResolvers<ContextType>;
  PartialItemsInvalidResponseError?: GQLPartialItemsInvalidResponseErrorResolvers<ContextType>;
  PartialItemsMissingEndpointError?: GQLPartialItemsMissingEndpointErrorResolvers<ContextType>;
  PartialItemsResponse?: GQLPartialItemsResponseResolvers<ContextType>;
  PartialItemsSuccessResponse?: GQLPartialItemsSuccessResponseResolvers<ContextType>;
  PendingInvite?: GQLPendingInviteResolvers<ContextType>;
  PlaceBounds?: GQLPlaceBoundsResolvers<ContextType>;
  Policy?: GQLPolicyResolvers<ContextType>;
  PolicyActionCount?: GQLPolicyActionCountResolvers<ContextType>;
  PolicyNameExistsError?: GQLPolicyNameExistsErrorResolvers<ContextType>;
  PolicyViolationsCount?: GQLPolicyViolationsCountResolvers<ContextType>;
  PostActionsEnqueueSourceInfo?: GQLPostActionsEnqueueSourceInfoResolvers<ContextType>;
  Query?: GQLQueryResolvers<ContextType>;
  QueueDoesNotExistError?: GQLQueueDoesNotExistErrorResolvers<ContextType>;
  RecentDecisionsForUser?: GQLRecentDecisionsForUserResolvers<ContextType>;
  RecentUserStrikeActions?: GQLRecentUserStrikeActionsResolvers<ContextType>;
  RecommendedThresholds?: GQLRecommendedThresholdsResolvers<ContextType>;
  RecordingJobDecisionFailedError?: GQLRecordingJobDecisionFailedErrorResolvers<ContextType>;
  RejectAppealDecisionComponent?: GQLRejectAppealDecisionComponentResolvers<ContextType>;
  RemoveAccessibleQueuesToUserResponse?: GQLRemoveAccessibleQueuesToUserResponseResolvers<ContextType>;
  RemoveFavoriteMRTQueueSuccessResponse?: GQLRemoveFavoriteMrtQueueSuccessResponseResolvers<ContextType>;
  RemoveFavoriteRuleResponse?: GQLRemoveFavoriteRuleResponseResolvers<ContextType>;
  RemoveFavoriteRuleSuccessResponse?: GQLRemoveFavoriteRuleSuccessResponseResolvers<ContextType>;
  ReorderRoutingRulesResponse?: GQLReorderRoutingRulesResponseResolvers<ContextType>;
  ReportEnqueueSourceInfo?: GQLReportEnqueueSourceInfoResolvers<ContextType>;
  ReportHistoryEntry?: GQLReportHistoryEntryResolvers<ContextType>;
  ReportedForReason?: GQLReportedForReasonResolvers<ContextType>;
  ReportingInsights?: GQLReportingInsightsResolvers<ContextType>;
  ReportingRule?: GQLReportingRuleResolvers<ContextType>;
  ReportingRuleExecutionResult?: GQLReportingRuleExecutionResultResolvers<ContextType>;
  ReportingRuleInsights?: GQLReportingRuleInsightsResolvers<ContextType>;
  ReportingRuleNameExistsError?: GQLReportingRuleNameExistsErrorResolvers<ContextType>;
  ReportingRulePassRateData?: GQLReportingRulePassRateDataResolvers<ContextType>;
  ResolvedJobCount?: GQLResolvedJobCountResolvers<ContextType>;
  RotateApiKeyError?: GQLRotateApiKeyErrorResolvers<ContextType>;
  RotateApiKeyResponse?: GQLRotateApiKeyResponseResolvers<ContextType>;
  RotateApiKeySuccessResponse?: GQLRotateApiKeySuccessResponseResolvers<ContextType>;
  RoutingRule?: GQLRoutingRuleResolvers<ContextType>;
  RoutingRuleNameExistsError?: GQLRoutingRuleNameExistsErrorResolvers<ContextType>;
  Rule?: GQLRuleResolvers<ContextType>;
  RuleExecutionEnqueueSourceInfo?: GQLRuleExecutionEnqueueSourceInfoResolvers<ContextType>;
  RuleExecutionResult?: GQLRuleExecutionResultResolvers<ContextType>;
  RuleExecutionResultEdge?: GQLRuleExecutionResultEdgeResolvers<ContextType>;
  RuleExecutionResultsConnection?: GQLRuleExecutionResultsConnectionResolvers<ContextType>;
  RuleHasRunningBacktestsError?: GQLRuleHasRunningBacktestsErrorResolvers<ContextType>;
  RuleInsights?: GQLRuleInsightsResolvers<ContextType>;
  RuleNameExistsError?: GQLRuleNameExistsErrorResolvers<ContextType>;
  RulePassRateData?: GQLRulePassRateDataResolvers<ContextType>;
  RunRetroactionResponse?: GQLRunRetroactionResponseResolvers<ContextType>;
  RunRetroactionSuccessResponse?: GQLRunRetroactionSuccessResponseResolvers<ContextType>;
  ScalarSignalOutputType?: GQLScalarSignalOutputTypeResolvers<ContextType>;
  SchemaFieldRoles?: GQLSchemaFieldRolesResolvers<ContextType>;
  SetAllUserStrikeThresholdsSuccessResponse?: GQLSetAllUserStrikeThresholdsSuccessResponseResolvers<ContextType>;
  SetIntegrationConfigResponse?: GQLSetIntegrationConfigResponseResolvers<ContextType>;
  SetIntegrationConfigSuccessResponse?: GQLSetIntegrationConfigSuccessResponseResolvers<ContextType>;
  SetModeratorSafetySettingsSuccessResponse?: GQLSetModeratorSafetySettingsSuccessResponseResolvers<ContextType>;
  SetMrtChartConfigurationSettingsSuccessResponse?: GQLSetMrtChartConfigurationSettingsSuccessResponseResolvers<ContextType>;
  SignUpResponse?: GQLSignUpResponseResolvers<ContextType>;
  SignUpSuccessResponse?: GQLSignUpSuccessResponseResolvers<ContextType>;
  SignUpUserExistsError?: GQLSignUpUserExistsErrorResolvers<ContextType>;
  Signal?: GQLSignalResolvers<ContextType>;
  SignalArgs?: GQLSignalArgsResolvers<ContextType>;
  SignalOutputType?: GQLSignalOutputTypeResolvers<ContextType>;
  SignalPricingStructure?: GQLSignalPricingStructureResolvers<ContextType>;
  SignalSubcategory?: GQLSignalSubcategoryResolvers<ContextType>;
  SignalWithScore?: GQLSignalWithScoreResolvers<ContextType>;
  SkippedJob?: GQLSkippedJobResolvers<ContextType>;
  SkippedJobCount?: GQLSkippedJobCountResolvers<ContextType>;
  StringOrFloat?: GraphQLScalarType;
  SubmitDecisionResponse?: GQLSubmitDecisionResponseResolvers<ContextType>;
  SubmitDecisionSuccessResponse?: GQLSubmitDecisionSuccessResponseResolvers<ContextType>;
  SubmitNCMECReportDecisionComponent?: GQLSubmitNcmecReportDecisionComponentResolvers<ContextType>;
  SubmittedJobActionNotFoundError?: GQLSubmittedJobActionNotFoundErrorResolvers<ContextType>;
  SupportedLanguages?: GQLSupportedLanguagesResolvers<ContextType>;
  TableDecisionCount?: GQLTableDecisionCountResolvers<ContextType>;
  TextBank?: GQLTextBankResolvers<ContextType>;
  ThreadAppealManualReviewJobPayload?: GQLThreadAppealManualReviewJobPayloadResolvers<ContextType>;
  ThreadItem?: GQLThreadItemResolvers<ContextType>;
  ThreadItemType?: GQLThreadItemTypeResolvers<ContextType>;
  ThreadManualReviewJobPayload?: GQLThreadManualReviewJobPayloadResolvers<ContextType>;
  ThreadSchemaFieldRoles?: GQLThreadSchemaFieldRolesResolvers<ContextType>;
  ThreadWithMessages?: GQLThreadWithMessagesResolvers<ContextType>;
  ThreadWithMessagesAndIpAddress?: GQLThreadWithMessagesAndIpAddressResolvers<ContextType>;
  TimeToAction?: GQLTimeToActionResolvers<ContextType>;
  TransformJobAndRecreateInQueueDecisionComponent?: GQLTransformJobAndRecreateInQueueDecisionComponentResolvers<ContextType>;
  UpdateContentRuleResponse?: GQLUpdateContentRuleResponseResolvers<ContextType>;
  UpdateManualReviewQueueQueueResponse?: GQLUpdateManualReviewQueueQueueResponseResolvers<ContextType>;
  UpdateNcmecOrgSettingsResponse?: GQLUpdateNcmecOrgSettingsResponseResolvers<ContextType>;
  UpdateOrgInfoSuccessResponse?: GQLUpdateOrgInfoSuccessResponseResolvers<ContextType>;
  UpdatePolicyResponse?: GQLUpdatePolicyResponseResolvers<ContextType>;
  UpdateReportingRuleResponse?: GQLUpdateReportingRuleResponseResolvers<ContextType>;
  UpdateRoutingRuleResponse?: GQLUpdateRoutingRuleResponseResolvers<ContextType>;
  UpdateUserRuleResponse?: GQLUpdateUserRuleResponseResolvers<ContextType>;
  UpdateUserStrikeTTLSuccessResponse?: GQLUpdateUserStrikeTtlSuccessResponseResolvers<ContextType>;
  User?: GQLUserResolvers<ContextType>;
  UserActionsHistory?: GQLUserActionsHistoryResolvers<ContextType>;
  UserAppealManualReviewJobPayload?: GQLUserAppealManualReviewJobPayloadResolvers<ContextType>;
  UserHistory?: GQLUserHistoryResolvers<ContextType>;
  UserHistoryResponse?: GQLUserHistoryResponseResolvers<ContextType>;
  UserInterfacePreferences?: GQLUserInterfacePreferencesResolvers<ContextType>;
  UserItem?: GQLUserItemResolvers<ContextType>;
  UserItemType?: GQLUserItemTypeResolvers<ContextType>;
  UserManualReviewJobPayload?: GQLUserManualReviewJobPayloadResolvers<ContextType>;
  UserNotificationEdge?: GQLUserNotificationEdgeResolvers<ContextType>;
  UserNotifications?: GQLUserNotificationsResolvers<ContextType>;
  UserOrRelatedActionDecisionComponent?: GQLUserOrRelatedActionDecisionComponentResolvers<ContextType>;
  UserRule?: GQLUserRuleResolvers<ContextType>;
  UserSchemaFieldRoles?: GQLUserSchemaFieldRolesResolvers<ContextType>;
  UserStrikeBucket?: GQLUserStrikeBucketResolvers<ContextType>;
  UserStrikeThreshold?: GQLUserStrikeThresholdResolvers<ContextType>;
  UserSubmissionCount?: GQLUserSubmissionCountResolvers<ContextType>;
  UserSubmissionsHistory?: GQLUserSubmissionsHistoryResolvers<ContextType>;
  WindowConfiguration?: GQLWindowConfigurationResolvers<ContextType>;
  ZentropiIntegrationApiCredential?: GQLZentropiIntegrationApiCredentialResolvers<ContextType>;
  ZentropiLabelerVersion?: GQLZentropiLabelerVersionResolvers<ContextType>;
};

export type GQLDirectiveResolvers<ContextType = Context> = {
  publicResolver?: GQLPublicResolverDirectiveResolver<any, any, ContextType>;
};
