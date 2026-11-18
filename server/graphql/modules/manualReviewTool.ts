/* eslint-disable max-lines */

import { NCMECIncidentType as NCMECIncidentTypeValues } from '../../services/ncmecService/index.js';
import { userInputError } from '../utils/errors.js';

export const MAX_MANUAL_REVIEW_JOB_IDS = 10;

export function assertManualReviewJobIdsWithinLimit(jobIds: readonly string[]) {
  if (jobIds.length > MAX_MANUAL_REVIEW_JOB_IDS) {
    throw userInputError(
      `At most ${MAX_MANUAL_REVIEW_JOB_IDS} job IDs may be requested.`,
    );
  }
}

const typeDefs = /* GraphQL */ `
  enum JobSortType {
    FIFO
    NUM_REPORTS
    WEIGHTED
  }

  enum JobPriorityProperty {
    numReports
    userScore
  }

  type JobPriorityWeight {
    property: JobPriorityProperty!
    weight: Float!
  }

  input JobPriorityWeightInput {
    property: JobPriorityProperty!
    weight: Float!
  }

  input SetJobPriorityWeightsInput {
    weights: [JobPriorityWeightInput!]!
  }

  type SetJobPriorityWeightsSuccessResponse {
    _: Boolean
  }

  union SetJobPriorityWeightsResponse = SetJobPriorityWeightsSuccessResponse

  enum MrtClearReportsDisposition {
    AUTOMATIC_CLOSE
    IGNORE
    SAME_ACTION
  }

  enum MrtClearReportsScope {
    CURRENT_QUEUE
    ALL_QUEUES
  }

  type ManualReviewQueue {
    id: ID!
    name: String!
    description: String
    orgId: ID!
    isDefaultQueue: Boolean!
    jobs(ids: [ID!], limit: Int, lockToken: String): [ManualReviewJob!]!
    pendingJobCount: Int!
    oldestJobCreatedAt: DateTime
    explicitlyAssignedReviewers: [User!]!
    "Roles whose members can review this queue, in addition to explicitly assigned reviewers."
    assignedRoleIds: [ID!]!
    hiddenActionIds: [ID!]!
    isAppealsQueue: Boolean!
    autoCloseJobs: Boolean!
    jobSortType: JobSortType!
    clearReportsDisposition: MrtClearReportsDisposition
    clearReportsScope: MrtClearReportsScope!
    clearReportsTriggerActionIds: [ID!]!
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
    """
    True when this item was synthesized server-side from indirect references
    rather than a real submission. \`latest.data\` is empty when set.
    """
    isSynthetic: Boolean
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
    | ReportEnqueueSourceInfo
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
    reportedMessages: [ItemIdentifier!]!
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo
  }

  union ManualReviewJobPayload =
    | ContentManualReviewJobPayload
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
    escalateToHighPriority: String
    additionalInfo: String
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
    """
    Non-blocking, reviewer-facing notices about the decision (e.g. an NCMEC escalation that was skipped because the user was already reported). Surfaced as toasts.
    """
    warnings: [String!]!
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

  type MissingRequiredDecisionReasonError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type MissingRequiredPolicyForDecisionError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type NcmecEscalationUnavailableError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union SubmitDecisionResponse =
    | SubmitDecisionSuccessResponse
    | JobHasAlreadyBeenSubmittedError
    | SubmittedJobActionNotFoundError
    | NoJobWithIdInQueueError
    | RecordingJobDecisionFailedError
    | MissingRequiredDecisionReasonError
    | MissingRequiredPolicyForDecisionError
    | NcmecEscalationUnavailableError

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
    | MutateManualReviewQueueSuccessResponse
    | ManualReviewQueueNameExistsError

  union UpdateManualReviewQueueQueueResponse =
    | MutateManualReviewQueueSuccessResponse
    | ManualReviewQueueNameExistsError
    | NotFoundError

  input CreateManualReviewQueueInput {
    name: String!
    description: String
    userIds: [ID!]!
    roleIds: [ID!]!
    hiddenActionIds: [ID!]!
    isAppealsQueue: Boolean!
    autoCloseJobs: Boolean!
    jobSortType: JobSortType
    clearReportsDisposition: MrtClearReportsDisposition
    clearReportsScope: MrtClearReportsScope
    clearReportsTriggerActionIds: [ID!]
  }

  input UpdateManualReviewQueueInput {
    id: ID!
    name: String
    description: String
    userIds: [ID!]!
    roleIds: [ID!]!
    actionIdsToHide: [ID!]!
    actionIdsToUnhide: [ID!]!
    autoCloseJobs: Boolean!
    jobSortType: JobSortType
    clearReportsDisposition: MrtClearReportsDisposition
    clearReportsScope: MrtClearReportsScope
    clearReportsTriggerActionIds: [ID!]
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
    | MutateAccessibleQueuesForUserSuccessResponse

  union RemoveAccessibleQueuesToUserResponse =
    | MutateAccessibleQueuesForUserSuccessResponse
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
    | DeleteAllJobsFromQueueSuccessResponse
    | DeleteAllJobsUnauthorizedError

  input InvalidateReportsFromReporterInput {
    reporter: ReporterIdInput!
    reason: String
    """
    Scopes the sweep to a single MRT job. When omitted, every pending job
    in the caller's org is scanned.
    """
    jobId: ID
  }

  type InvalidateReportsFromReporterSuccessResponse {
    queuesScanned: Int!
    jobsScanned: Int!
    jobsScrubbed: Int!
    jobsDeleted: Int!
    reportsRemoved: Int!
    """
    True when a queue exceeded the per-queue scan cap, so the sweep was partial.
    """
    truncated: Boolean!
  }

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

  enum HandleTimeGroupByColumns {
    QUEUE_ID
    REVIEWER_ID
  }

  input HandleTimeFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
    queueIds: [String!]!
    reviewerIds: [String!]!
  }

  type HandleTime {
    handleTimeSeconds: Int
    reviewerId: String
    queueId: String
  }

  input HandleTimeInput {
    groupBy: [HandleTimeGroupByColumns!]!
    filterBy: HandleTimeFilterByInput!
  }

  union ManualReviewChartSettings =
    | GetDecisionCountSettings
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
    | IgnoreDecisionComponent
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
    assignedAt: DateTime
    jobCreatedAt: DateTime
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
    author: User
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
    | AddManualReviewJobCommentSuccessResponse
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
    getHandleTime(input: HandleTimeInput!): [HandleTime!]
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
    """
    Strips every entry sent by the given reporter from the report history of
    every pending MRT job in the caller's org. If a job's history becomes
    empty and it was originally enqueued from a user report, the job itself
    is removed. Intentionally non-persistent: future reports from the same
    reporter are NOT blocked. See issue #404.
    """
    invalidateReportsFromReporter(
      input: InvalidateReportsFromReporterInput!
    ): InvalidateReportsFromReporterSuccessResponse!
    createManualReviewJobComment(
      input: CreateManualReviewJobCommentInput!
    ): AddManualReviewJobCommentResponse!
    deleteManualReviewJobComment(
      input: DeleteManualReviewJobCommentInput!
    ): Boolean!
    logSkip(input: LogSkipInput!): Boolean!
    releaseJobLock(input: ReleaseJobLockInput!): Boolean!
    setJobPriorityWeights(
      input: SetJobPriorityWeightsInput!
    ): SetJobPriorityWeightsResponse!
  }
`;

const NCMECIncidentType = {
  CHILD_PORNOGRAPHY:
    NCMECIncidentTypeValues[
      'Child Pornography (possession, manufacture, and distribution)'
    ],
  CHILD_SEX_TRAFFICKING: NCMECIncidentTypeValues['Child Sex Trafficking'],
  CHILD_SEX_TOURISM: NCMECIncidentTypeValues['Child Sex Tourism'],
  CHILD_SEXUAL_MOLESTATION: NCMECIncidentTypeValues['Child Sexual Molestation'],
  MISLEADING_DOMAIN_NAME: NCMECIncidentTypeValues['Misleading Domain Name'],
  MISLEADING_WORDS_OR_DIGITAL_IMAGES:
    NCMECIncidentTypeValues[
      'Misleading Words or Digital Images on the Internet'
    ],
  ONLINE_ENTICEMENT_OF_CHILDREN:
    NCMECIncidentTypeValues['Online Enticement of Children for Sexual Acts'],
  UNSOLICITED_OBSCENE_MATERIAL_TO_CHILD:
    NCMECIncidentTypeValues['Unsolicited Obscene Material Sent to a Child'],
};

// The MRT field resolvers are NestJS classes in manualReviewTool.resolvers.ts.
const resolvers = { NCMECIncidentType };

export { resolvers, typeDefs };
