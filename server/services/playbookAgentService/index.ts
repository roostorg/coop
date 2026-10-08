/**
 * Playbook Agent Service — AI-powered investigation framework for Coop.
 *
 * Open-source components ported from Risk Goose Agent (Block):
 *   - PlaybookRunner: orchestrates evidence → hard rules → LLM → confidence
 *   - QueryCatalog: pre-approved SQL templates (agent never writes SQL)
 *   - ConfidenceEngine: grounded scoring — C_final = C_ground × (1 − α × u_llm)
 *   - HardRuleEngine: deterministic rules that bypass the LLM
 *   - JsonExtractor: robust structured output parsing from LLM text
 *
 * Abstract interfaces allow any organization to bring their own LLM, database,
 * and storage backend. The framework handles orchestration, safety constraints,
 * and audit trail.
 *
 * @license Apache-2.0
 */

// Service
export {
  PlaybookAgentService,
  default as makePlaybookAgentService,
  type PlaybookAgentServiceDeps,
  type RunForJobInput,
} from './playbookAgentService.js';

// Core runner
export { default as PlaybookRunner } from './playbookRunner.js';
export type { PlaybookRunnerDeps } from './playbookRunner.js';

// Interfaces (implement these to integrate)
export type {
  EvidenceQuery,
  IArtifactStore,
  IEvidenceStore,
  ILLMAdapter,
  IPlaybookRunner,
  LLMRequest,
  LLMResponse,
  PlaybookArtifact,
  PlaybookRunInput,
} from './interfaces.js';

// Query catalog
export {
  default as QueryCatalog,
  parseCatalogEntry,
  type CatalogEntry,
  type CatalogEntryMap,
} from './queryCatalog.js';

// Confidence engine
export { computeConfidence } from './confidenceEngine.js';

// Hard rule engine
export {
  evaluateHardRules,
  type HardRuleMatch,
} from './hardRuleEngine.js';

// JSON extractor
export {
  extractJsonObjects,
  extractVerdict,
  validateAgainstContract,
} from './jsonExtractor.js';

// Playbook loader
export { parsePlaybook, type PlaybookValidationError } from './playbookLoader.js';

// Types
export type {
  CatalogReference,
  CatalogType,
  ConfidenceBreakdown,
  ConfidenceComputation,
  DecisionLogic,
  DeepDiveCondition,
  DeepDiveModule,
  EvidenceOntology,
  EvidenceQuality,
  EvidenceRequestPolicy,
  EvidenceType,
  HardRule,
  InputContextField,
  InputFieldType,
  LabelDefinition,
  OutputContract,
  PhaseBudget,
  Playbook,
  PlaybookResult,
  PlaybookVerdict,
  QueryResult,
  QueryResults,
  ScoringGuidance,
  SemanticVersion,
} from './playbookTypes.js';

export {
  formatCatalogReference,
  formatSemanticVersion,
  parseSemanticVersion,
  validateCatalogReference,
} from './playbookTypes.js';
