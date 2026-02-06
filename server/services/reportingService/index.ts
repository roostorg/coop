import { type ReportingRuleErrorType } from './ReportingRules.js';

// Needs to be exported because it's used in the contract for
// snowflakeEventualWrite.
export { type ReportingServiceSnowflakeSchema } from './dbTypes.js';
export {
  type ReportingService,
  default as makeReportingService,
  type ReportingRuleExecutionCorrelationId,
} from './reportingService.js';

export type ReportingServiceErrorType = ReportingRuleErrorType;
