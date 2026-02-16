/* eslint-disable max-lines */
import { AuthenticationError } from 'apollo-server-core';
import _ from 'lodash';

import {
  getPermissionsForRole,
  UserPermission,
} from '../../models/types/permissioning.js';
import { itemSubmissionWithTypeIdentifierToItemSubmission } from '../../services/itemProcessingService/index.js';
import { NCMECIncidentType as NCMECIncidentTypeValues } from '../../services/ncmecService/index.js';
import {
  asyncIterableToArray,
  filterNullOrUndefined,
} from '../../utils/collections.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  getEndOfDayInTimezone,
  getStartOfDayInTimezone,
} from '../../utils/time.js';
import {
  type GQLContentAppealManualReviewJobPayloadResolvers,
  type GQLContentManualReviewJobPayloadResolvers,
  type GQLDequeueManualReviewJobResponseResolvers,
  type GQLManualReviewChartSettingsResolvers,
  type GQLManualReviewDecisionComponentResolvers,
  type GQLManualReviewJobCommentResolvers,
  type GQLManualReviewJobEnqueueSourceInfoResolvers,
  type GQLManualReviewJobPayloadResolvers,
  type GQLManualReviewJobResolvers,
  type GQLManualReviewQueueResolvers,
  type GQLMutationResolvers,
  type GQLNcmecManualReviewJobPayloadResolvers,
  type GQLQueryManualReviewQueueArgs,
  type GQLQueryResolvers,
  type GQLThreadAppealManualReviewJobPayloadResolvers,
  type GQLThreadManualReviewJobPayloadResolvers,
  type GQLUserAppealManualReviewJobPayloadResolvers,
  type GQLUserManualReviewJobPayloadResolvers,
} from '../generated.js';
import { formatItemSubmissionForGQL } from '../types.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { oneOfInputToTaggedUnion } from '../utils/inputHelpers.js';

const { omit, sum, sumBy } = _;

const typeDefs = /* GraphQL */ `
  type ManualReviewQueue {
    id: ID!
    name: String!
    description: String
    orgId: ID!
    isDefaultQueue: Boolean!
    jobs(ids: [ID!]): [ManualReviewJob!]!
    pendingJobCount: Int!
    oldestJobCreatedAt: DateTime
    explicitlyAssignedReviewers: [User!]!
    hiddenActionIds: [ID!]!
    isAppealsQueue: Boolean!
    autoCloseJobs: Boolean!
  }

  type ManualReviewJob {
    id: ID!
    createdAt: DateTime!
    payload: ManualReviewJobPayload!
    policyIds: [String!]!
    comments: [ManualReviewJobComment!]!
    numTimesReported: Int
  }

  type ItemSubmissions {
    latest: Item!
    prior: [Item!]
  }

  type ItemWithParents {
    item: ItemSubmissions!
    parents: [ItemSubmissions!]!
  }

  type ReportEnqueueSourceInfo {
    kind: JobCreationSourceOptions!
  }

  type AppealEnqueueSourceInfo {
    kind: JobCreationSourceOptions!
  }

  type RuleExecutionEnqueueSourceInfo {
    kind: JobCreationSourceOptions!
    rules: [Rule!]!
  }

  type MrtJobEnqueueSourceInfo {
    kind: JobCreationSourceOptions!
  }

  type PostActionsEnqueueSourceInfo {
    kind: JobCreationSourceOptions!
  }

  union ManualReviewJobEnqueueSourceInfo =
      ReportEnqueueSourceInfo
    | RuleExecutionEnqueueSourceInfo
    | MrtJobEnqueueSourceInfo
    | PostActionsEnqueueSourceInfo
    | AppealEnqueueSourceInfo

  type ReportedForReason {
    reporterId: ItemIdentifier
    reason: String
  }

  type ReportHistoryEntry {
    reportId: ID!
    reporterId: ItemIdentifier
    reason: String
    reportedAt: DateTime!
    policyId: ID
  }

  type ContentManualReviewJobPayload {
    item: ContentItem!
    reportHistory: [ReportHistoryEntry!]!
    additionalContentItems: [ContentItem!]!
    itemThreadContentItems: [ContentItem!]
    reportedForReason: String
    reportedForReasons: [ReportedForReason!]!
    userScore: Int
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo
  }

  type UserManualReviewJobPayload {
    item: UserItem!
    reportHistory: [ReportHistoryEntry!]!
    userScore: Int
    additionalContentItems: [ContentItem!]!
    itemThreadContentItems: [ContentItem!]
    reportedItems: [ItemIdentifier]
    # TODO: migrate this to use latestUserSubmittedItems query instead
    userSubmittedItems: [ItemSubmissions!]!
    reportedForReasons: [ReportedForReason!]!
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo
  }

  type ThreadManualReviewJobPayload {
    item: ThreadItem!
    reportHistory: [ReportHistoryEntry!]!
    threadItems: [ItemWithParents!]!
    reportedForReason: String
    reportedForReasons: [ReportedForReason!]!
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo
  }

  type ContentAppealManualReviewJobPayload {
    item: ContentItem!
    additionalContentItems: [ContentItem!]!
    appealReason: String
    appealerIdentifier: ItemIdentifier
    userScore: Int
    enqueueSourceInfo: AppealEnqueueSourceInfo
    actionsTaken: [String!]!
    appealId: String!
  }

  type UserAppealManualReviewJobPayload {
    item: UserItem!
    userScore: Int
    additionalContentItems: [ContentItem!]!
    reportedItems: [ItemIdentifier]
    appealReason: String
    appealerIdentifier: ItemIdentifier
    enqueueSourceInfo: AppealEnqueueSourceInfo
    appealId: String!
    actionsTaken: [String!]!
  }

  type ThreadAppealManualReviewJobPayload {
    item: ThreadItem!
    appealId: String!
    appealReason: String
    appealerIdentifier: ItemIdentifier
    enqueueSourceInfo: AppealEnqueueSourceInfo
    actionsTaken: [String!]!
  }

  type NcmecContentItem {
    # contentItem used to be a ContentItem, but is now misnamed because
    # we also add the user in order to render their profile pictures and
    # other images
    contentItem: Item!
    isConfirmedCSAM: Boolean!
    isReported: Boolean!
  }

  type NcmecManualReviewJobPayload {
    item: UserItem!
    userScore: Int
    allMediaItems: [NcmecContentItem!]!
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo
  }

  union ManualReviewJobPayload =
      ContentManualReviewJobPayload
    | UserManualReviewJobPayload
    | ThreadManualReviewJobPayload
    | NcmecManualReviewJobPayload
    | ContentAppealManualReviewJobPayload
    | UserAppealManualReviewJobPayload
    | ThreadAppealManualReviewJobPayload

  input UserActionDecisionAction {
    id: ID!
  }

  input UserActionDecisionPolicy {
    id: ID!
  }

  input CoopActionDecisionInput {
    _: Boolean
  }

  enum NCMECIncidentType {
    CHILD_PORNOGRAPHY
    CHILD_SEX_TRAFFICKING
    CHILD_SEX_TOURISM
    CHILD_SEXUAL_MOLESTATION
    MISLEADING_DOMAIN_NAME
    MISLEADING_WORDS_OR_DIGITAL_IMAGES
    ONLINE_ENTICEMENT_OF_CHILDREN
    UNSOLICITED_OBSCENE_MATERIAL_TO_CHILD
  }

  input SubmitNcmecReportInput {
    reportedMedia: [NcmecMediaInput!]!
    reportedMessages: [NcmecThreadInput!]!
    incidentType: NCMECIncidentType!
  }

  enum AppealDecision {
    ACCEPT
    REJECT
  }

  input SubmitAppealDecisionInput {
    appealId: String!
  }

  enum ManualReviewJobKind {
    DEFAULT
    NCMEC
  }

  input TransformJobAndRecreateInQueue {
    newJobKind: ManualReviewJobKind!
    originalQueueId: String
    newQueueId: String
    policyIds: [String!]!
  }

  input ReporterIdInput {
    id: ID!
    typeId: ID!
  }

  input ReportHistoryEntryInput {
    reporterId: ReporterIdInput
    reportId: ID!
    reason: String
    reportedAt: DateTime!
    policyId: ID
  }

  #This should be called DecisionSubmissionComponent, but is named DecisionSubmission for legacy reasons
  input DecisionSubmission {
    userAction: ExecuteBulkActionsInput
    ignore: CoopActionDecisionInput
    submitNcmecReport: SubmitNcmecReportInput
    transformJobAndRecreateInQueue: TransformJobAndRecreateInQueue
    acceptAppeal: SubmitAppealDecisionInput
    rejectAppeal: SubmitAppealDecisionInput
  }

  input SubmitDecisionInput {
    queueId: ID!
    jobId: ID!
    lockToken: String!
    reportHistory: [ReportHistoryEntryInput!]!
    reportedItemDecisionComponents: [DecisionSubmission!]!
    relatedItemActions: [ExecuteBulkActionsInput!]!
    decisionReason: String
  }

  type SubmitDecisionSuccessResponse {
    success: Boolean!
  }

  type JobHasAlreadyBeenSubmittedError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type SubmittedJobActionNotFoundError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type NoJobWithIdInQueueError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type RecordingJobDecisionFailedError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union SubmitDecisionResponse =
      SubmitDecisionSuccessResponse
    | JobHasAlreadyBeenSubmittedError
    | SubmittedJobActionNotFoundError
    | NoJobWithIdInQueueError
    | RecordingJobDecisionFailedError

  union DequeueManualReviewJobResponse = DequeueManualReviewJobSuccessResponse

  type DequeueManualReviewJobSuccessResponse {
    job: ManualReviewJob!
    lockToken: String!
    numPendingJobs: Int!
  }

  type MutateManualReviewQueueSuccessResponse {
    data: ManualReviewQueue!
  }

  type ManualReviewQueueNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union CreateManualReviewQueueResponse =
      MutateManualReviewQueueSuccessResponse
    | ManualReviewQueueNameExistsError

  union UpdateManualReviewQueueQueueResponse =
      MutateManualReviewQueueSuccessResponse
    | ManualReviewQueueNameExistsError
    | NotFoundError

  input CreateManualReviewQueueInput {
    name: String!
    description: String
    userIds: [ID!]!
    hiddenActionIds: [ID!]!
    isAppealsQueue: Boolean!
    autoCloseJobs: Boolean!
  }

  input UpdateManualReviewQueueInput {
    id: ID!
    name: String
    description: String
    userIds: [ID!]!
    actionIdsToHide: [ID!]!
    actionIdsToUnhide: [ID!]!
    autoCloseJobs: Boolean!
  }

  input AddAccessibleQueuesToUserInput {
    userId: ID!
    queueIds: [ID!]!
  }

  input RemoveAccessibleQueuesToUserInput {
    userId: ID!
    queueIds: [ID!]!
  }

  type MutateAccessibleQueuesForUserSuccessResponse {
    _: Boolean!
  }

  union AddAccessibleQueuesToUserResponse =
      MutateAccessibleQueuesForUserSuccessResponse

  union RemoveAccessibleQueuesToUserResponse =
      MutateAccessibleQueuesForUserSuccessResponse
    | NotFoundError

  type DeleteAllJobsFromQueueSuccessResponse {
    _: Boolean!
  }

  type DeleteAllJobsUnauthorizedError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union DeleteAllJobsFromQueueResponse =
      DeleteAllJobsFromQueueSuccessResponse
    | DeleteAllJobsUnauthorizedError

  enum MetricsTimeDivisionOptions {
    DAY
    HOUR
  }

  enum ManualReviewChartMetric {
    DECISIONS
    JOBS
  }

  enum DecisionCountGroupByColumns {
    TYPE
    POLICY_ID
    QUEUE_ID
    REVIEWER_ID
  }

  enum JobCountGroupByColumns {
    QUEUE_ID
    REVIEWER_ID
  }

  enum SkippedJobCountGroupByColumns {
    QUEUE_ID
    REVIEWER_ID
  }

  enum DecisionActionType {
    CUSTOM_ACTION
    RELATED_ACTION
  }

  type DecisionCountFilterBy {
    startDate: DateTime!
    endDate: DateTime!
    type: [ManualReviewDecisionType!]!
    actionIds: [String!]!
    policyIds: [String!]!
    queueIds: [String!]!
    reviewerIds: [String!]!
    itemTypeIds: [String!]!
    filteredDecisionActionType: [DecisionActionType!]
  }

  input DecisionCountFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    type: [ManualReviewDecisionType!]!
    actionIds: [String!]!
    policyIds: [String!]!
    queueIds: [String!]!
    reviewerIds: [String!]!
    itemTypeIds: [String!]!
    filteredDecisionActionType: [DecisionActionType!]
  }

  input JobCountFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    queueIds: [String!]!
    reviewerIds: [String!]!
  }

  input SkippedJobFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    queueIds: [String!]!
    reviewerIds: [String!]!
  }

  type GetDecisionCountSettings {
    title: String!
    metric: ManualReviewChartMetric!
    groupBy: [DecisionCountGroupByColumns!]!
    filterBy: DecisionCountFilterBy!
    timeDivision: MetricsTimeDivisionOptions!
  }

  input DecisionCountSettingsInput {
    groupBy: [DecisionCountGroupByColumns!]!
    filterBy: DecisionCountFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
  }

  input GetDecisionCountInput {
    groupBy: [DecisionCountGroupByColumns!]!
    filterBy: DecisionCountFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
    timeZone: String!
  }

  enum DecisionsCountGroupBy {
    REVIEWER_ID
    QUEUE_ID
  }

  input DecisionCountTableFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    queueIds: [String!]!
    reviewerIds: [String!]!
  }

  input GetDecisionCountsTableInput {
    groupBy: DecisionsCountGroupBy!
    filterBy: DecisionCountTableFilterByInput!
    timeZone: String!
  }

  type TableDecisionCount {
    count: Int!
    type: ManualReviewDecisionType!
    action_id: String
    queue_id: String
    reviewer_id: String
  }

  input GetResolvedJobCountInput {
    groupBy: [JobCountGroupByColumns!]!
    filterBy: JobCountFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
    timeZone: String!
  }

  input GetSkippedJobCountInput {
    groupBy: [SkippedJobCountGroupByColumns!]!
    filterBy: SkippedJobFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
    timeZone: String!
  }

  type DecisionCount {
    count: Int!
    time: String!
    type: ManualReviewDecisionType
    action_id: String
    policy_id: String
    queue_id: String
    reviewer_id: String
  }

  enum JobCreationGroupByColumns {
    QUEUE_ID
    ITEM_TYPE_ID
    POLICY_ID
    SOURCE
  }

  enum JobCreationSourceOptions {
    REPORT
    RULE_EXECUTION
    MRT_JOB
    POST_ACTIONS
    APPEAL
  }

  type JobCreationFilterBy {
    startDate: DateTime!
    endDate: DateTime!
    policyIds: [String!]!
    queueIds: [String!]!
    itemTypeIds: [String!]!
    ruleIds: [String!]!
    sources: [JobCreationSourceOptions!]!
  }

  input JobCreationFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    policyIds: [String!]!
    queueIds: [String!]!
    itemTypeIds: [String!]!
    ruleIds: [String!]!
    sources: [JobCreationSourceOptions!]!
  }

  type GetJobCreationCountSettings {
    title: String!
    metric: ManualReviewChartMetric!
    groupBy: [JobCreationGroupByColumns!]!
    filterBy: JobCreationFilterBy!
    timeDivision: MetricsTimeDivisionOptions!
  }

  input JobCreationSettingsInput {
    groupBy: [JobCreationGroupByColumns!]!
    filterBy: JobCreationFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
  }

  input GetJobCreationCountInput {
    groupBy: [JobCreationGroupByColumns!]!
    filterBy: JobCreationFilterByInput!
    timeDivision: MetricsTimeDivisionOptions!
    timeZone: String!
  }

  type JobCreationCount {
    count: Int!
    time: String!
    itemTypeId: String
    policyId: String
    ruleId: String
    queueId: String
    source: JobCreationSourceOptions
  }

  type ResolvedJobCount {
    count: Int!
    time: String!
    reviewerId: String
    queueId: String
  }

  type SkippedJobCount {
    count: Int!
    time: String!
    reviewerId: String
    queueId: String
  }

  enum TimeToActionGroupByColumns {
    ITEM_TYPE_ID
    QUEUE_ID
    REVIEWER_ID
  }

  input TimeToActionFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    queueIds: [String!]!
    itemTypeIds: [String!]!
  }

  type TimeToAction {
    timeToAction: Int
    itemTypeId: String
    queueId: String
  }

  input TimeToActionInput {
    groupBy: [TimeToActionGroupByColumns!]!
    filterBy: TimeToActionFilterByInput!
  }

  union ManualReviewChartSettings =
      GetDecisionCountSettings
    | GetJobCreationCountSettings

  input ManualReviewChartSettingsInput {
    title: String!
    metric: ManualReviewChartMetric!
    decisionCountSettings: DecisionCountSettingsInput
    jobCreationCountSettings: JobCreationSettingsInput
  }

  enum ManualReviewDecisionType {
    IGNORE
    CUSTOM_ACTION
    SUBMIT_NCMEC_REPORT
    TRANSFORM_JOB_AND_RECREATE_IN_QUEUE
    RELATED_ACTION
    ACCEPT_APPEAL
    REJECT_APPEAL
    AUTOMATIC_CLOSE
  }

  type IgnoreDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
  }

  type AutomaticCloseDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
  }

  type RejectAppealDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
    appealId: String!
    actionIds: [String!]!
  }

  type AcceptAppealDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
    appealId: String!
    actionIds: [String!]!
  }

  type UserOrRelatedActionDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
    itemTypeId: String!
    itemIds: [String!]!
    actionIds: [String!]!
    policyIds: [String!]!
    customMrtApiParams: JSONObject
  }

  type SubmitNCMECReportDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
    reportedMedia: [NcmecReportedMediaDetails!]!
  }

  type TransformJobAndRecreateInQueueDecisionComponent implements ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
    newJobKind: ManualReviewJobKind!
    originalQueueId: String
    newQueueId: String
    policyIds: [String!]
  }

  interface ManualReviewDecisionComponentBase {
    type: ManualReviewDecisionType!
  }

  union ManualReviewDecisionComponent =
      IgnoreDecisionComponent
    | UserOrRelatedActionDecisionComponent
    | SubmitNCMECReportDecisionComponent
    | TransformJobAndRecreateInQueueDecisionComponent
    | RejectAppealDecisionComponent
    | AcceptAppealDecisionComponent
    | AutomaticCloseDecisionComponent

  type ManualReviewDecision {
    id: String!
    jobId: String!
    itemId: String
    itemTypeId: String
    queueId: String!
    reviewerId: String
    decisions: [ManualReviewDecisionComponent!]!
    relatedActions: [ManualReviewDecisionComponent!]!
    createdAt: DateTime!
    decisionReason: String
  }

  type ManualReviewExistingJob {
    queueId: String!
    job: ManualReviewJob!
  }

  input RecentManualReviewIgnoreDecision {
    _: Boolean
  }

  input RecentManualReviewAutomaticCloseDecision {
    _: Boolean
  }

  input RecentManualReviewSubmitNCMECReportDecision {
    _: Boolean
  }

  input RecentManualReviewTransformJobAndRecreateInQueueDecision {
    _: Boolean
  }

  input RecentManualReviewUserOrRelatedActionDecision {
    actionIds: [ID!]!
  }

  input RecentManualReviewAcceptAppealDecision {
    _: Boolean
  }

  input RecentManualReviewRejectAppealDecision {
    _: Boolean
  }

  input RecentManualReviewDecisionType {
    acceptAppealDecision: RecentManualReviewAcceptAppealDecision
    rejectAppealDecision: RecentManualReviewRejectAppealDecision
    ignoreDecision: RecentManualReviewIgnoreDecision
    automaticCloseDecision: RecentManualReviewAutomaticCloseDecision
    userOrRelatedActionDecision: RecentManualReviewUserOrRelatedActionDecision
    submitNcmecReportDecision: RecentManualReviewSubmitNCMECReportDecision
    transformJobAndRecreateInQueueDecision: RecentManualReviewTransformJobAndRecreateInQueueDecision
  }

  input RecentDecisionsFilterInput {
    userSearchString: String
    decisions: [RecentManualReviewDecisionType!]
    policyIds: [ID!]
    reviewerIds: [ID!]
    queueIds: [ID!]
    startTime: DateTime
    endTime: DateTime
  }

  input RecentDecisionsInput {
    filter: RecentDecisionsFilterInput!
    page: Int
  }

  type RecentDecisionsForUser {
    userSearchString: String!
    recentDecisions: [ManualReviewDecision!]!
  }

  type ManualReviewJobComment {
    id: ID!
    author: User!
    commentText: String!
    createdAt: DateTime!
  }

  input CreateManualReviewJobCommentInput {
    jobId: String!
    commentText: String!
  }

  input DeleteManualReviewJobCommentInput {
    jobId: String!
    commentId: String!
  }

  type AddCommentFailedError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type AddManualReviewJobCommentSuccessResponse {
    comment: ManualReviewJobComment!
  }
  union AddManualReviewJobCommentResponse =
      AddManualReviewJobCommentSuccessResponse
    | NotFoundError

  type ManualReviewJobWithDecisions {
    job: ManualReviewJob!
    decision: ManualReviewDecision!
  }

  input LogSkipInput {
    jobId: String!
    queueId: String!
  }

  input ReleaseJobLockInput {
    jobId: String!
    queueId: String!
    lockToken: String!
  }

  type SkippedJob {
    jobId: String!
    userId: String!
    queueId: String!
    ts: DateTime!
  }

  type Query {
    manualReviewQueue(id: ID!): ManualReviewQueue
    getDecisionCounts(input: GetDecisionCountInput!): [DecisionCount!]!
    getDecisionsTable(
      input: GetDecisionCountsTableInput!
    ): [TableDecisionCount!]!
    getJobCreationCounts(input: GetJobCreationCountInput!): [JobCreationCount!]!
    getResolvedJobCounts(input: GetResolvedJobCountInput!): [ResolvedJobCount!]!
    getSkippedJobCounts(input: GetSkippedJobCountInput!): [SkippedJobCount!]!
    getTotalPendingJobsCount: Int!
    getRecentDecisions(input: RecentDecisionsInput!): [ManualReviewDecision!]!
    getSkipsForRecentDecisions(input: RecentDecisionsInput!): [SkippedJob!]!
    getDecidedJob(id: ID!): ManualReviewJob
    # This has to be a string because job IDs don't conform to the ID type
    getDecidedJobFromJobId(id: String!): ManualReviewJobWithDecisions
    getCommentsForJob(jobId: ID!): [ManualReviewJobComment!]!
    getExistingJobsForItem(
      itemId: ID!
      itemTypeId: ID!
    ): [ManualReviewExistingJob!]!
    getTimeToAction(input: TimeToActionInput!): [TimeToAction!]
    getResolvedJobsForUser(timeZone: String!): Int!
    getSkippedJobsForUser(timeZone: String!): Int!
  }

  type Mutation {
    dequeueManualReviewJob(queueId: ID!): DequeueManualReviewJobResponse
    submitManualReviewDecision(
      input: SubmitDecisionInput!
    ): SubmitDecisionResponse!
    createManualReviewQueue(
      input: CreateManualReviewQueueInput!
    ): CreateManualReviewQueueResponse!
    updateManualReviewQueue(
      input: UpdateManualReviewQueueInput!
    ): UpdateManualReviewQueueQueueResponse!
    deleteManualReviewQueue(id: ID!): Boolean!
    addAccessibleQueuesToUser(
      input: AddAccessibleQueuesToUserInput!
    ): AddAccessibleQueuesToUserResponse!
    removeAccessibleQueuesToUser(
      input: RemoveAccessibleQueuesToUserInput!
    ): RemoveAccessibleQueuesToUserResponse!
    deleteAllJobsFromQueue(queueId: ID!): DeleteAllJobsFromQueueResponse!
    createManualReviewJobComment(
      input: CreateManualReviewJobCommentInput!
    ): AddManualReviewJobCommentResponse!
    deleteManualReviewJobComment(
      input: DeleteManualReviewJobCommentInput!
    ): Boolean!
    logSkip(input: LogSkipInput!): Boolean!
    releaseJobLock(input: ReleaseJobLockInput!): Boolean!
  }
`;

const ManualReviewJobEnqueueSourceInfo: GQLManualReviewJobEnqueueSourceInfoResolvers =
  {
    __resolveType(it) {
      switch (it.kind) {
        case 'REPORT':
          return 'ReportEnqueueSourceInfo';
        case 'APPEAL':
          return 'AppealEnqueueSourceInfo';
        case 'RULE_EXECUTION':
          return 'RuleExecutionEnqueueSourceInfo';
        case 'MRT_JOB':
          return 'MrtJobEnqueueSourceInfo';
        case 'POST_ACTIONS':
          return 'PostActionsEnqueueSourceInfo';
        default:
          assertUnreachable(it.kind);
      }
    },
  };

const ManualReviewJobPayload: GQLManualReviewJobPayloadResolvers = {
  async __resolveType(it, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const itemType = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (itemType === undefined) {
      throw new Error('No item type found');
    }

    switch (itemType.kind) {
      case 'CONTENT': {
        return 'appealId' in it
          ? 'ContentAppealManualReviewJobPayload'
          : 'ContentManualReviewJobPayload';
      }
      case 'USER': {
        return 'appealId' in it
          ? 'UserAppealManualReviewJobPayload'
          : it.kind === 'DEFAULT'
            ? 'UserManualReviewJobPayload'
            : 'allMediaItems' in it
              ? 'NcmecManualReviewJobPayload'
              : 'UserManualReviewJobPayload';
      }
      case 'THREAD': {
        return 'appealId' in it
          ? 'ThreadAppealManualReviewJobPayload'
          : 'ThreadManualReviewJobPayload';
      }
      default:
        assertUnreachable(itemType);
    }
  },
};


const ContentManualReviewJobPayload: GQLContentManualReviewJobPayloadResolvers =
  {
    async item(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      const type = await context.services.getItemTypeEventuallyConsistent({
        orgId: user.orgId,
        typeSelector: it.item.itemTypeIdentifier,
      });
      if (type === undefined) {
        throw new Error(
          `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
        );
      }

      if (type.kind !== 'CONTENT') {
        throw new Error('Invalid item type in content item type resolver');
      }

      const itemSubmission = itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type);
      
      // Matched banks are now stored directly in the item data during submission
      return formatItemSubmissionForGQL(itemSubmission);
    },
    async itemThreadContentItems(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.itemThreadContentItems === undefined) {
        return null;
      }

      return Promise.all(
        it.itemThreadContentItems.map(async (contentItemSubmission) => {
          const type = await context.services.getItemTypeEventuallyConsistent({
            orgId: user.orgId,
            typeSelector: contentItemSubmission.itemTypeIdentifier,
          });

          if (type === undefined || type.kind !== 'CONTENT') {
            throw new Error(
              `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
            );
          }

          return formatItemSubmissionForGQL(
            itemSubmissionWithTypeIdentifierToItemSubmission(
              contentItemSubmission,
              type,
            ),
          );
        }),
      );
    },
    async additionalContentItems(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.additionalContentItems === undefined) {
        return [];
      }
      return 'additionalContentItems' in it
        ? Promise.all(
            it.additionalContentItems.map(async (contentItemSubmission) => {
              const type =
                await context.services.getItemTypeEventuallyConsistent({
                  orgId: user.orgId,
                  typeSelector: contentItemSubmission.itemTypeIdentifier,
                });

              if (type === undefined || type.kind !== 'CONTENT') {
                throw new Error(
                  `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
                );
              }

              return formatItemSubmissionForGQL(
                itemSubmissionWithTypeIdentifierToItemSubmission(
                  contentItemSubmission,
                  type,
                ),
              );
            }),
          )
        : [];
    },
    async enqueueSourceInfo(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.enqueueSourceInfo === undefined) {
        return null;
      }
      const enqueueSourceInfo = it.enqueueSourceInfo;
      switch (enqueueSourceInfo.kind) {
        case 'MRT_JOB':
        case 'REPORT':
        case 'POST_ACTIONS':
          return { kind: enqueueSourceInfo.kind };
        case 'RULE_EXECUTION':
          const org = await context.dataSources.orgAPI.getGraphQLOrgFromId(
            user.orgId,
          );
          const rules = await org.getRules();
          return {
            kind: enqueueSourceInfo.kind,
            rules: rules.filter((rule) =>
              enqueueSourceInfo.rules.includes(rule.id),
            ),
          };
        default:
          assertUnreachable(enqueueSourceInfo);
      }
    },
  };

const ContentAppealManualReviewJobPayload: GQLContentAppealManualReviewJobPayloadResolvers =
  {
    async item(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      const type = await context.services.getItemTypeEventuallyConsistent({
        orgId: user.orgId,
        typeSelector: it.item.itemTypeIdentifier,
      });
      if (type === undefined) {
        throw new Error(
          `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
        );
      }

      if (type.kind !== 'CONTENT') {
        throw new Error('Invalid item type in content item type resolver');
      }

      return formatItemSubmissionForGQL(
        itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
      );
    },
    async additionalContentItems(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.additionalContentItems === undefined) {
        return [];
      }
      return 'additionalContentItems' in it
        ? Promise.all(
            it.additionalContentItems.map(async (contentItemSubmission) => {
              const type =
                await context.services.getItemTypeEventuallyConsistent({
                  orgId: user.orgId,
                  typeSelector: contentItemSubmission.itemTypeIdentifier,
                });

              if (type === undefined || type.kind !== 'CONTENT') {
                throw new Error(
                  `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
                );
              }

              return formatItemSubmissionForGQL(
                itemSubmissionWithTypeIdentifierToItemSubmission(
                  contentItemSubmission,
                  type,
                ),
              );
            }),
          )
        : [];
    },
    async enqueueSourceInfo(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.enqueueSourceInfo === undefined) {
        return null;
      }
      const enqueueSourceInfo = it.enqueueSourceInfo;
      return { kind: enqueueSourceInfo.kind };
    },
  };

const UserManualReviewJobPayload: GQLUserManualReviewJobPayloadResolvers = {
  async item(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'USER') {
      throw new Error('Invalid item type in user item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  },
  async itemThreadContentItems(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.itemThreadContentItems === undefined) {
      return null;
    }
    return Promise.all(
      it.itemThreadContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  },
  async additionalContentItems(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.additionalContentItems === undefined) {
      return [];
    }
    return Promise.all(
      it.additionalContentItems.map(async (contentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector: contentItemSubmission.itemTypeIdentifier,
        });

        if (type === undefined || type.kind !== 'CONTENT') {
          throw new Error(
            `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
          );
        }

        return formatItemSubmissionForGQL(
          itemSubmissionWithTypeIdentifierToItemSubmission(
            contentItemSubmission,
            type,
          ),
        );
      }),
    );
  },
  async userSubmittedItems(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const items = await asyncIterableToArray(
      context.services.ItemInvestigationService.getItemSubmissionsByCreator({
        orgId: user.orgId,
        itemCreatorIdentifier: {
          id: it.item.itemId,
          typeId: it.item.itemTypeIdentifier.id,
        },
      }),
    );

    const itemSubmissionsForGQL = items.flatMap((itemSubmissions) => {
      const { latestSubmission, priorSubmissions } = itemSubmissions;
      if (latestSubmission.itemType.kind !== 'CONTENT') {
        return [];
      }
      return {
        latest: formatItemSubmissionForGQL(latestSubmission),
        prior: priorSubmissions
          ? itemSubmissions.priorSubmissions?.map(formatItemSubmissionForGQL)
          : [],
      };
    });
    return itemSubmissionsForGQL;
  },
  async enqueueSourceInfo(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION':
        const org = await context.dataSources.orgAPI.getGraphQLOrgFromId(
          user.orgId,
        );
        const rules = await org.getRules();
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  },
};

const UserAppealManualReviewJobPayload: GQLUserAppealManualReviewJobPayloadResolvers =
  {
    async item(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      const type = await context.services.getItemTypeEventuallyConsistent({
        orgId: user.orgId,
        typeSelector: it.item.itemTypeIdentifier,
      });
      if (type === undefined) {
        throw new Error(
          `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
        );
      }

      if (type.kind !== 'USER') {
        throw new Error('Invalid item type in user item type resolver');
      }

      return formatItemSubmissionForGQL(
        itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
      );
    },
    async additionalContentItems(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.additionalContentItems === undefined) {
        return [];
      }
      return Promise.all(
        it.additionalContentItems.map(async (contentItemSubmission) => {
          const type = await context.services.getItemTypeEventuallyConsistent({
            orgId: user.orgId,
            typeSelector: contentItemSubmission.itemTypeIdentifier,
          });

          if (type === undefined || type.kind !== 'CONTENT') {
            throw new Error(
              `No/Unexpected Item Type found for id: ${contentItemSubmission.itemTypeIdentifier.id}`,
            );
          }

          return formatItemSubmissionForGQL(
            itemSubmissionWithTypeIdentifierToItemSubmission(
              contentItemSubmission,
              type,
            ),
          );
        }),
      );
    },
    async enqueueSourceInfo(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.enqueueSourceInfo === undefined) {
        return null;
      }
      const enqueueSourceInfo = it.enqueueSourceInfo;
      return { kind: enqueueSourceInfo.kind };
    },
  };

const ThreadManualReviewJobPayload: GQLThreadManualReviewJobPayloadResolvers = {
  async item(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'THREAD') {
      throw new Error('Invalid item type in thread item type resolver');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  },

  async threadItems(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    const itemsWithParents = await asyncIterableToArray(
      context.services.ItemInvestigationService.getThreadSubmissionsByTime({
        orgId: user.orgId,
        threadId: {
          id: it.item.itemId,
          typeId: it.item.itemTypeIdentifier.id,
        },
        limit: 20,
        numParentLevels: 0,
        latestSubmissionsOnly: true,
      }),
    );

    return Promise.all(
      itemsWithParents.map(async (itemWithParents) => {
        const parentSubmissions = await asyncIterableToArray(
          itemWithParents.parents,
        );
        return {
          item: {
            latest: formatItemSubmissionForGQL(
              itemWithParents.latestSubmission,
            ),
            prior: itemWithParents.priorSubmissions
              ? itemWithParents.priorSubmissions.map(formatItemSubmissionForGQL)
              : [],
          },
          parents: parentSubmissions.map((p) => {
            return {
              latest: formatItemSubmissionForGQL(p.latestSubmission),
              prior: p.priorSubmissions
                ? p.priorSubmissions.map(formatItemSubmissionForGQL)
                : [],
            };
          }),
        };
      }),
    );
  },
  async enqueueSourceInfo(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION':
        const org = await context.dataSources.orgAPI.getGraphQLOrgFromId(
          user.orgId,
        );
        const rules = await org.getRules();
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  },
};

const ThreadAppealManualReviewJobPayload: GQLThreadAppealManualReviewJobPayloadResolvers =
  {
    async item(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      const type = await context.services.getItemTypeEventuallyConsistent({
        orgId: user.orgId,
        typeSelector: it.item.itemTypeIdentifier,
      });
      if (type === undefined) {
        throw new Error(
          `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
        );
      }

      if (type.kind !== 'THREAD') {
        throw new Error('Invalid item type in thread item type resolver');
      }

      return formatItemSubmissionForGQL(
        itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
      );
    },

    async enqueueSourceInfo(it, _, context) {
      const user = context.getUser();
      if (user == null) {
        throw new Error('No user found on context');
      }
      if (it.enqueueSourceInfo === undefined) {
        return null;
      }
      const enqueueSourceInfo = it.enqueueSourceInfo;
      return { kind: enqueueSourceInfo.kind };
    },
  };

const NcmecManualReviewJobPayload: GQLNcmecManualReviewJobPayloadResolvers = {
  async item(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    const type = await context.services.getItemTypeEventuallyConsistent({
      orgId: user.orgId,
      typeSelector: it.item.itemTypeIdentifier,
    });
    if (type === undefined) {
      throw new Error(
        `No Item Type found for id: ${it.item.itemTypeIdentifier.id}`,
      );
    }

    if (type.kind !== 'USER') {
      throw new Error('Item on a NCMEC job must be a user item type');
    }

    return formatItemSubmissionForGQL(
      itemSubmissionWithTypeIdentifierToItemSubmission(it.item, type),
    );
  },
  async allMediaItems(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    return Promise.all(
      it.allMediaItems.map(async (ncmecContentItemSubmission) => {
        const type = await context.services.getItemTypeEventuallyConsistent({
          orgId: user.orgId,
          typeSelector:
            ncmecContentItemSubmission.contentItem.itemTypeIdentifier,
        });
        if (
          type === undefined ||
          (type.kind !== 'CONTENT' && type.kind !== 'USER')
        ) {
          throw new Error(
            `No Content Item Type found for id: ${ncmecContentItemSubmission.contentItem.itemTypeIdentifier.id}`,
          );
        }
        return {
          ...ncmecContentItemSubmission,
          contentItem: formatItemSubmissionForGQL(
            itemSubmissionWithTypeIdentifierToItemSubmission(
              ncmecContentItemSubmission.contentItem,
              type,
            ),
          ),
        };
      }),
    );
  },
  async enqueueSourceInfo(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }
    if (it.enqueueSourceInfo === undefined) {
      return null;
    }
    const enqueueSourceInfo = it.enqueueSourceInfo;
    switch (enqueueSourceInfo.kind) {
      case 'MRT_JOB':
      case 'REPORT':
      case 'POST_ACTIONS':
        return { kind: enqueueSourceInfo.kind };
      case 'RULE_EXECUTION':
        const org = await context.dataSources.orgAPI.getGraphQLOrgFromId(
          user.orgId,
        );
        const rules = await org.getRules();
        return {
          kind: enqueueSourceInfo.kind,
          rules: rules.filter((rule) =>
            enqueueSourceInfo.rules.includes(rule.id),
          ),
        };
      default:
        assertUnreachable(enqueueSourceInfo);
    }
  },
};

const ManualReviewQueue: GQLManualReviewQueueResolvers = {
  async jobs(queue, { ids: jobIds }, context) {
    const { orgId, id: queueId } = queue;

    if (!jobIds) {
      return context.services.ManualReviewToolService.getAllJobsForQueue({
        orgId,
        queueId,
      });
    } else {
      return context.services.ManualReviewToolService.getJobsForQueue({
        orgId,
        queueId,
        jobIds,
        isAppealsQueue: queue.isAppealsQueue,
      });
    }
  },
  async pendingJobCount(queue, _, context) {
    const { orgId, id: queueId } = queue;
    return context.services.ManualReviewToolService.getPendingJobCount({
      orgId,
      queueId,
    });
  },
  async oldestJobCreatedAt(queue, _, context) {
    const { orgId, id: queueId } = queue;
    return context.services.ManualReviewToolService.getOldestJobCreatedAt({
      orgId,
      queueId,
      isAppealsQueue: queue.isAppealsQueue,
    });
  },
  async explicitlyAssignedReviewers(queue, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    const { id: userId, orgId } = user;

    const userIds = (
      await context.services.ManualReviewToolService.getUsersWhoCanSeeQueue({
        queueId: queue.id,
        userId,
        orgId,
      })
    ).map((it) => it.userId);
    return context.dataSources.userAPI.getGraphQLUsersFromIds(userIds);
  },
  async hiddenActionIds(queue, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    const { orgId } = user;
    const { id: queueId } = queue;

    return context.services.ManualReviewToolService.getHiddenActionsForQueue({
      orgId,
      queueId,
    });
  },
};

const ManualReviewJobComment: GQLManualReviewJobCommentResolvers = {
  async author(comment, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    return context.dataSources.userAPI.getGraphQLUserFromId({
      id: comment.authorId,
      orgId: user.orgId,
    });
  },
};

const ManualReviewJob: GQLManualReviewJobResolvers = {
  async comments(job, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    return context.services.ManualReviewToolService.getJobComments({
      orgId: user.orgId,
      jobId: job.id,
    });
  },
  async numTimesReported(job, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new Error('No user found on context');
    }

    return context.services.ReportingService.getNumTimesReported({
      orgId: user.orgId,
      itemId: job.payload.item.itemId,
    });
  },
};

const DequeueManualReviewJobResponse: GQLDequeueManualReviewJobResponseResolvers =
  {
    __resolveType(_response) {
      return 'DequeueManualReviewJobSuccessResponse';
    },
  };

const Query: GQLQueryResolvers = {
  async getDecisionCounts(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    return context.services.ManualReviewToolService.getDecisionCounts({
      ...input,
      groupBy: input.groupBy.map((it) => it.toLowerCase()),
      filterBy: {
        ...input.filterBy,
        startDate: new Date(input.filterBy.startDate),
        endDate: new Date(input.filterBy.endDate),
        filteredDecisionActionType: input.filterBy.filteredDecisionActionType
          ? input.filterBy.filteredDecisionActionType
          : undefined,
      },
      timeZone: input.timeZone,
      orgId: user.orgId,
    });
  },
  async getJobCreationCounts(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getJobCreationCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('item_type_id' in it ? { itemTypeId: it.item_type_id } : {}),
      ...('policy_id' in it ? { policyId: it.policy_id } : {}),
      ...('rule_id' in it ? { ruleId: it.rule_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
      ...('source' in it ? { source: it.source } : {}),
    }));
  },

  async getResolvedJobCounts(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getResolvedJobCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('reviewer_id' in it ? { reviewerId: it.reviewer_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
    }));
  },

  async getSkippedJobCounts(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getSkippedJobCounts({
        timeDivision: input.timeDivision,
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          userIds: input.filterBy.reviewerIds,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return result.map((it) => ({
      count: it.count,
      time: it.time,
      ...('user_id' in it ? { reviewerId: it.user_id } : {}),
      ...('queue_id' in it ? { queueId: it.queue_id } : {}),
    }));
  },

  async getResolvedJobsForUser(_: unknown, { timeZone }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const counts =
      await context.services.ManualReviewToolService.getResolvedJobCounts({
        timeDivision: 'DAY',
        groupBy: ['reviewer_id'],
        filterBy: {
          reviewerIds: [user.id],
          queueIds: [],
          // Time at midnight in UTC
          startDate: getStartOfDayInTimezone(timeZone),
          endDate: getEndOfDayInTimezone(timeZone),
        },
        timeZone,
        orgId: user.orgId,
      });
    if (counts.length === 0) {
      return 0;
    }
    return sumBy(counts, 'count');
  },

  async getSkippedJobsForUser(_: unknown, { timeZone }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const counts =
      await context.services.ManualReviewToolService.getSkippedJobCounts({
        timeDivision: 'DAY',
        groupBy: ['reviewer_id'],
        filterBy: {
          userIds: [user.id],
          queueIds: [],
          // Time at midnight in UTC
          startDate: getStartOfDayInTimezone(timeZone),
          endDate: getEndOfDayInTimezone(timeZone),
        },
        timeZone,
        orgId: user.orgId,
      });
    if (counts.length === 0) {
      return 0;
    }
    return sumBy(counts, 'count');
  },

  async getTimeToAction(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const result =
      await context.services.ManualReviewToolService.getDecisionTimeToAction({
        groupBy: input.groupBy.map((it) => it.toLowerCase()),
        filterBy: {
          ...input.filterBy,
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        orgId: user.orgId,
      });
    return result.map((it) => ({
      timeToAction: it.time_to_action ? Math.round(it.time_to_action) : 0,
      queueId: it.queue_id,
    }));
  },
  async getTotalPendingJobsCount(_: unknown, __: unknown, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const allQueues =
      await context.services.ManualReviewToolService.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
        { orgId: user.orgId },
      );

    const jobsPerQueue = await Promise.all(
      allQueues.map(async (queue) =>
        context.services.ManualReviewToolService.getPendingJobCount({
          orgId: user.orgId,
          queueId: queue.id,
        }),
      ),
    );
    return sum(jobsPerQueue);
  },

  async getRecentDecisions(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const permissions = user.getPermissions();
    const { filter, page } = input;
    const recentDecisions =
      await context.services.ManualReviewToolService.getRecentDecisions({
        userPermissions: permissions,
        orgId: user.orgId,
        input: {
          userSearchString: filter.userSearchString ?? undefined,
          decisions: filter.decisions
            ? filterNullOrUndefined(
                filter.decisions.map((it) =>
                  it.userOrRelatedActionDecision
                    ? {
                        type: 'CUSTOM_ACTION',
                        actionIds: it.userOrRelatedActionDecision.actionIds,
                      }
                    : it.ignoreDecision
                    ? { type: 'IGNORE' }
                    : it.submitNcmecReportDecision
                    ? { type: 'SUBMIT_NCMEC_REPORT' }
                    : it.transformJobAndRecreateInQueueDecision
                    ? { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE' }
                    : it.acceptAppealDecision
                    ? {
                        type: 'ACCEPT_APPEAL',
                      }
                    : it.rejectAppealDecision
                    ? {
                        type: 'REJECT_APPEAL',
                      }
                    : undefined,
                ),
              )
            : undefined,
          policyIds: filter.policyIds ?? undefined,
          reviewerIds: filter.reviewerIds ?? undefined,
          queueIds: filter.queueIds ?? undefined,
          startTime: filter.startTime ? new Date(filter.startTime) : undefined,
          endTime: filter.endTime ? new Date(filter.endTime) : undefined,
          page: page ?? 0,
        },
      });
    return recentDecisions;
  },
  async getDecidedJob(_: unknown, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecidedJob({
      orgId: user.orgId,
      id,
    });
  },
  async getDecidedJobFromJobId(_: unknown, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecidedJobFromJobId({
      orgId: user.orgId,
      jobId: id,
      userPermissions: user.getPermissions(),
    });
  },
  async manualReviewQueue(
    _: unknown,
    { id }: GQLQueryManualReviewQueueArgs,
    context,
  ) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const queue =
      await context.services.ManualReviewToolService.getQueueForOrgAndDangerouslyBypassPermissioning(
        { orgId: user.orgId, queueId: id },
      );
    return queue ?? null;
  },
  async getCommentsForJob(_: unknown, { jobId }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ManualReviewToolService.getJobComments({
      orgId: user.orgId,
      jobId,
    });
  },
  async getExistingJobsForItem(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getExistingJobsForItem({
      orgId: user.orgId,
      itemId: params.itemId,
      itemTypeId: params.itemTypeId,
    });
  },
  async getDecisionsTable(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.getDecisionCountsTable({
      orgId: user.orgId,
      groupBy: params.input.groupBy.toLowerCase(),
      filterBy: {
        ...params.input.filterBy,
        startDate: new Date(params.input.filterBy.startDate),
        endDate: new Date(params.input.filterBy.endDate),
      },
      timeZone: params.input.timeZone,
    });
  },
  async getSkipsForRecentDecisions(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const filter = input.filter;

    return context.services.ManualReviewToolService.getSkippedJobsForRecentDecisions(
      {
        orgId: user.orgId,
        input: {
          userSearchString: filter.userSearchString ?? undefined,
          decisions: filter.decisions
            ? filterNullOrUndefined(
                filter.decisions.map((it) =>
                  it.userOrRelatedActionDecision
                    ? {
                        type: 'CUSTOM_ACTION',
                        actionIds: it.userOrRelatedActionDecision.actionIds,
                      }
                    : it.ignoreDecision
                    ? { type: 'IGNORE' }
                    : it.submitNcmecReportDecision
                    ? { type: 'SUBMIT_NCMEC_REPORT' }
                    : it.transformJobAndRecreateInQueueDecision
                    ? { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE' }
                    : it.acceptAppealDecision
                    ? {
                        type: 'ACCEPT_APPEAL',
                      }
                    : it.rejectAppealDecision
                    ? {
                        type: 'REJECT_APPEAL',
                      }
                    : undefined,
                ),
              )
            : undefined,
          policyIds: filter.policyIds ?? undefined,
          reviewerIds: filter.reviewerIds ?? undefined,
          queueIds: filter.queueIds ?? undefined,
        },
      },
    );
  },
};

const Mutation: GQLMutationResolvers = {
  async dequeueManualReviewJob(_, { queueId }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id: userId, orgId } = user;
    const nextJob =
      await context.services.ManualReviewToolService.dequeueNextJob({
        orgId,
        queueId,
        userId,
      });
    if (!nextJob) {
      return null;
    }

    return {
      ...nextJob,
      numPendingJobs:
        await context.services.ManualReviewToolService.getPendingJobCount({
          orgId,
          queueId,
        }),
    };
  },

  async submitManualReviewDecision(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id: userId, orgId, email: userEmail } = user;

    const {
      queueId,
      jobId,
      lockToken,
      reportedItemDecisionComponents,
      relatedItemActions,
      decisionReason,
      reportHistory,
    } = params.input;

    const decisionPayloads = reportedItemDecisionComponents.map(
      (reportedItemDecisionComponent) => {
        const decision = oneOfInputToTaggedUnion(
          reportedItemDecisionComponent,
          {
            userAction: 'CUSTOM_ACTION',
            ignore: 'IGNORE',
            submitNcmecReport: 'SUBMIT_NCMEC_REPORT',
            transformJobAndRecreateInQueue:
              'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE',
            rejectAppeal: 'REJECT_APPEAL',
            acceptAppeal: 'ACCEPT_APPEAL',
          },
        );
        return (() => {
          switch (decision.type) {
            case 'CUSTOM_ACTION':
              return {
                ...omit(decision, ['policyIds', 'actionIds']),
                policies: decision.policyIds.map((id) => ({
                  id,
                })),
                actions: decision.actionIds.map((actionId) => ({
                  id: actionId,
                })),
                actionIdsToMrtApiParamDecisionPayload:
                  decision.actionIdsToMrtApiParamDecisionPayload ?? undefined,
              };
            case 'ACCEPT_APPEAL':
            case 'REJECT_APPEAL':
            case 'SUBMIT_NCMEC_REPORT':
            case 'IGNORE':
            case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
              return decision;

            default:
              assertUnreachable(decision);
          }
        })();
      },
    );

    try {
      const reportHistoryNoNullFields = reportHistory.map((report) => ({
        reportId: report.reportId,
        reason: report.reason === null ? undefined : report.reason,
        reporterId: report.reporterId === null ? undefined : report.reporterId,
        reportedAt: new Date(report.reportedAt),
        policyId: report.policyId === null ? undefined : report.policyId,
      }));

      await context.services.ManualReviewToolService.submitDecision({
        reportHistory: [...reportHistoryNoNullFields],
        queueId,
        jobId,
        lockToken,
        decisionComponents: decisionPayloads,
        relatedActions: [...relatedItemActions],
        reviewerId: userId,
        reviewerEmail: userEmail,
        orgId,
        decisionReason: decisionReason ?? undefined,
      });
      return gqlSuccessResult(
        { success: true },
        'SubmitDecisionSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, 'JobHasAlreadyBeenSubmittedError') ||
        isCoopErrorOfType(e, 'SubmittedJobActionNotFoundError') ||
        isCoopErrorOfType(e, 'NoJobWithIdInQueueError') ||
        isCoopErrorOfType(e, 'RecordingJobDecisionFailedError')
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async createManualReviewQueue(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const {
      name,
      description,
      userIds,
      hiddenActionIds,
      isAppealsQueue,
      autoCloseJobs,
    } = params.input;
    try {
      const queue =
        await context.services.ManualReviewToolService.createManualReviewQueue({
          description: description ?? null,
          name,
          userIds: [...userIds, user.id],
          hiddenActionIds,
          isAppealsQueue,
          autoCloseJobs,
          invokedBy: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        });

      const res = gqlSuccessResult(
        { data: queue },
        'MutateManualReviewQueueSuccessResponse',
      );
      return res;
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ManualReviewQueueNameExistsError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async updateManualReviewQueue(_, params, context) {
    const user = context.getUser();
    if (
      user == null ||
      !user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)
    ) {
      throw new AuthenticationError('Authenticated user required');
    }

    const {
      id: queueId,
      name,
      description,
      userIds,
      actionIdsToHide,
      actionIdsToUnhide,
      autoCloseJobs,
    } = params.input;
    try {
      const queue =
        await context.services.ManualReviewToolService.updateManualReviewQueue({
          queueId,
          orgId: user.orgId,
          description,
          name: name ?? undefined,
          // Include the user who's creating the queue as having permission to see
          // the queue
          userIds: [...userIds, user.id],
          actionIdsToHide,
          actionIdsToUnhide,
          autoCloseJobs,
        });
      return gqlSuccessResult(
        { data: queue },
        'MutateManualReviewQueueSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ManualReviewQueueNameExistsError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async deleteManualReviewQueue(_, params, context) {
    const user = context.getUser();
    if (
      user == null ||
      !user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)
    ) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.services.ManualReviewToolService.deleteManualReviewQueue(
      user.orgId,
      params.id,
    );
  },
  async addAccessibleQueuesToUser(_, params, context) {
    const user = context.getUser();
    if (
      user == null ||
      !user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)
    ) {
      throw new AuthenticationError('Authenticated user required');
    }

    await context.services.ManualReviewToolService.addAccessibleQueuesForUser(
      params.input.userId,
      params.input.queueIds,
    );

    // TODO: try/catch and return failure cases
    return gqlSuccessResult(
      { _: true },
      'MutateAccessibleQueuesForUserSuccessResponse',
    );
  },
  async removeAccessibleQueuesToUser(_, params, context) {
    const user = context.getUser();
    if (
      user == null ||
      !user.getPermissions().includes(UserPermission.EDIT_MRT_QUEUES)
    ) {
      throw new AuthenticationError('Authenticated user required');
    }

    await context.services.ManualReviewToolService.removeAccessibleQueuesForUser(
      params.input.userId,
      params.input.queueIds,
    );

    // TODO: try/catch and return failure cases
    return gqlSuccessResult(
      { _: true },
      'MutateAccessibleQueuesForUserSuccessResponse',
    );
  },
  async deleteAllJobsFromQueue(_, params, context) {
    //TODO: this needs to write a decision now so we can send
    // a report decision callback to users for each of the jobs/reportIds
    // that are being deleted
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    try {
      await context.services.ManualReviewToolService.deleteAllJobsFromQueue({
        orgId: user.orgId,
        queueId: params.queueId,
        userPermissions: getPermissionsForRole(user.role),
      });
      return gqlSuccessResult(
        { _: true },
        'DeleteAllJobsFromQueueSuccessResponse',
      );
    } catch (e) {
      if (isCoopErrorOfType(e, 'DeleteAllJobsUnauthorizedError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async createManualReviewJobComment(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const { jobId, commentText } = params.input;
      const comment =
        await context.services.ManualReviewToolService.addJobComment({
          orgId: user.orgId,
          jobId,
          commentText,
          authorId: user.id,
        });

      return gqlSuccessResult(
        { comment },
        'AddManualReviewJobCommentSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async deleteManualReviewJobComment(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const { id: userId, orgId } = user;
    try {
      const { jobId, commentId } = params.input;
      await context.services.ManualReviewToolService.deleteJobComment({
        orgId,
        jobId,
        userId,
        commentId,
      });
      return true;
    } catch (e) {
      return false;
    }
  },
  async logSkip(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    try {
      await context.services.ManualReviewToolService.logSkip({
        orgId: user.orgId,
        jobId: input.jobId,
        queueId: input.queueId,
        userId: user.id,
      });
      return true;
    } catch (e) {
      return false;
    }
  },
  async releaseJobLock(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    try {
      await context.services.ManualReviewToolService.releaseJobLock({
        orgId: user.orgId,
        jobId: input.jobId,
        queueId: input.queueId,
        lockToken: input.lockToken,
      });
      return true;
    } catch (e) {
      return false;
    }
  },
};

const ManualReviewDecisionComponent: GQLManualReviewDecisionComponentResolvers =
  {
    __resolveType(it) {
      switch (it.type) {
        case 'IGNORE':
          return 'IgnoreDecisionComponent';
        case 'CUSTOM_ACTION':
        case 'RELATED_ACTION':
          return 'UserOrRelatedActionDecisionComponent';
        case 'SUBMIT_NCMEC_REPORT':
          return 'SubmitNCMECReportDecisionComponent';
        case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
          return 'TransformJobAndRecreateInQueueDecisionComponent';
        case 'ACCEPT_APPEAL':
          return 'AcceptAppealDecisionComponent';
        case 'REJECT_APPEAL':
          return 'RejectAppealDecisionComponent';
        case 'AUTOMATIC_CLOSE':
          return 'AutomaticCloseDecisionComponent';
        default:
          assertUnreachable(it.type);
      }
    },
  };

const ManualReviewChartSettings: GQLManualReviewChartSettingsResolvers = {
  __resolveType(it) {
    switch (it.metric) {
      case 'DECISIONS':
        return 'GetDecisionCountSettings';
      case 'JOBS':
        return 'GetJobCreationCountSettings';
      default:
        assertUnreachable(it.metric);
    }
  },
};

const NCMECIncidentType = {
  CHILD_PORNOGRAPHY: NCMECIncidentTypeValues['Child Pornography (possession, manufacture, and distribution)'],
  CHILD_SEX_TRAFFICKING: NCMECIncidentTypeValues['Child Sex Trafficking'],
  CHILD_SEX_TOURISM: NCMECIncidentTypeValues['Child Sex Tourism'],
  CHILD_SEXUAL_MOLESTATION: NCMECIncidentTypeValues['Child Sexual Molestation'],
  MISLEADING_DOMAIN_NAME: NCMECIncidentTypeValues['Misleading Domain Name'],
  MISLEADING_WORDS_OR_DIGITAL_IMAGES: NCMECIncidentTypeValues['Misleading Words or Digital Images on the Internet'],
  ONLINE_ENTICEMENT_OF_CHILDREN: NCMECIncidentTypeValues['Online Enticement of Children for Sexual Acts'],
  UNSOLICITED_OBSCENE_MATERIAL_TO_CHILD: NCMECIncidentTypeValues['Unsolicited Obscene Material Sent to a Child'],
};

const resolvers = {
  Query,
  Mutation,
  NCMECIncidentType,
  ManualReviewJobEnqueueSourceInfo,
  ManualReviewQueue,
  DequeueManualReviewJobResponse,
  ManualReviewJobPayload,
  ContentManualReviewJobPayload,
  UserManualReviewJobPayload,
  ThreadManualReviewJobPayload,
  NcmecManualReviewJobPayload,
  ManualReviewDecisionComponent,
  ManualReviewChartSettings,
  ManualReviewJobComment,
  ManualReviewJob,
  ContentAppealManualReviewJobPayload,
  UserAppealManualReviewJobPayload,
  ThreadAppealManualReviewJobPayload,
};

export { resolvers, typeDefs };
