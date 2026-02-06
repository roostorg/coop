import { type SubmitDecisionErrorType } from './modules/JobDecisioning.js';
import { type RoutingRuleErrorType } from './modules/JobRouting.js';
import {
  type ManualReviewQueueErrorType,
  type QueueOperationsErrorType,
} from './modules/QueueOperations.js';

export {
  ManualReviewToolService,
  type ManualReviewJob,
  type ManualReviewJobOrAppeal,
  type ManualReviewAppealJob,
  type ThreadAppealReviewJobPayload,
  type ContentAppealReviewJobPayload,
  type UserAppealReviewJobPayload,
  type ManualReviewJobKind,
  type ManualReviewJobPayload,
  type ManualReviewAppealJobPayload,
  type ThreadManualReviewJobPayload,
  type ContentManualReviewJobPayload,
  type UserManualReviewJobPayload,
  type NcmecManualReviewJobPayload,
} from './manualReviewToolService.js';

export { type ManualReviewQueue } from './modules/QueueOperations.js';

export { type RoutingRule } from './modules/JobRouting.js';

export {
  type ManualReviewJobInput,
  type ManualReviewAppealJobInput,
} from './modules/JobEnrichment.js';

export { type ManualReviewDecisionComponent } from './modules/JobDecisioning.js';

// Needs to be exported because it's used in the contract for
// snowflakeEventualWrite.
export {
  type ManualReviewToolServiceSnowflakeSchema,
  type ManualReviewToolServicePg,
} from './dbTypes.js';

export type ManualReviewToolServiceErrorType =
  | RoutingRuleErrorType
  | ManualReviewQueueErrorType
  | QueueOperationsErrorType
  | SubmitDecisionErrorType;
