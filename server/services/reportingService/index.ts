import { type ReportingRuleErrorType } from './ReportingRules.js';

// Needs to be exported because it's used in the contract for
// warehouse eventual-write tables.
export { type ReportingServiceWarehouseSchema } from './dbTypes.js';
export {
  type ReportingService,
  default as makeReportingService,
  type ReportingRuleExecutionCorrelationId,
} from './reportingService.js';

export {
  normalizeReportContext,
  reportContextSchema,
  type ReportContext,
  type ReportContextInput,
} from './reportContext.js';

export type ReportingServiceErrorType = ReportingRuleErrorType;
