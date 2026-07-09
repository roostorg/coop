/**
 * Playbook Schema Types — Declarative configs for risk investigation use cases.
 *
 * Playbooks are versioned, declarative configurations that define investigation
 * workflows, evidence requirements, decision logic, and output contracts.
 *
 * Key design principles:
 *   - Versioned using semantic versioning for reproducibility
 *   - Declarative: define requirements, not implementation
 *   - Catalog-based: reference queries by ID + version, never contain SQL
 *   - Deterministic: same input + same playbook version = same behavior
 *
 * @license Apache-2.0
 */

// ── Semantic Versioning ─────────────────────────────────────────────────────

export type SemanticVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
};

export function parseSemanticVersion(input: string): SemanticVersion {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(input);
  if (!match) {
    throw new Error(
      `Invalid semantic version format: '${input}'. Expected format: 'X.Y.Z' with no leading zeros.`,
    );
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatSemanticVersion(v: SemanticVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

// ── Catalog References ──────────────────────────────────────────────────────

const FORBIDDEN_CATALOG_IDS = [
  'latest',
  'head',
  'main',
  'master',
  'current',
] as const;

const CATALOG_ID_PATTERN = /^[a-z0-9_]+$/;

export type CatalogType = 'query' | 'query_bundle';

export type CatalogReference = {
  readonly catalogId: string;
  readonly version: SemanticVersion;
  readonly catalogType: CatalogType;
};

export function validateCatalogReference(ref: CatalogReference): void {
  if (!CATALOG_ID_PATTERN.test(ref.catalogId)) {
    throw new Error(
      `Invalid catalog ID '${ref.catalogId}': must match /^[a-z0-9_]+$/`,
    );
  }
  if (
    (FORBIDDEN_CATALOG_IDS as readonly string[]).includes(ref.catalogId)
  ) {
    throw new Error(
      `Catalog ID cannot be '${ref.catalogId}' — use specific versioned IDs`,
    );
  }
}

export function formatCatalogReference(ref: CatalogReference): string {
  return `${ref.catalogId}@${formatSemanticVersion(ref.version)}`;
}

// ── Input Context ───────────────────────────────────────────────────────────

export type InputFieldType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime';

export type InputContextField = {
  readonly fieldName: string;
  readonly fieldType: InputFieldType;
  readonly required: boolean;
  readonly description: string;
  readonly default?: unknown;
  readonly validationPattern?: string;
  readonly catalogParameterName?: string;
};

// ── Evidence Ontology ───────────────────────────────────────────────────────

export type EvidenceQuality = {
  readonly freshnessMaxAgeMs?: number;
  readonly minimumConfidence: number;
  readonly minimumNumRequiredSources: number;
};

export type EvidenceType = {
  readonly evidenceId: string;
  readonly displayName: string;
  readonly description: string;
  readonly quality: EvidenceQuality;
};

export type EvidenceOntology = {
  readonly version: SemanticVersion;
  readonly evidenceTypes: readonly EvidenceType[];
};

// ── Evidence Request Policy ─────────────────────────────────────────────────

export type EvidenceRequestPolicy = {
  readonly querySelectionMode: 'query_id';
  readonly maxRounds: number;
  readonly targetConfidence: number;
  readonly maxAdditionalQueries: number;
  readonly stopIfNoNewEvidence: boolean;
  readonly triggerDeepDiveIf?: string;
  readonly stopInvestigationIf?: string;
  readonly guidance?: string;
};

// ── Deep-Dive Modules ───────────────────────────────────────────────────────

export type DeepDiveCondition = {
  readonly conditionId: string;
  readonly description: string;
  readonly expression: string;
};

export type DeepDiveModule = {
  readonly moduleId: string;
  readonly displayName: string;
  readonly description: string;
  readonly entryConditions: readonly DeepDiveCondition[];
  readonly exitConditions: readonly DeepDiveCondition[];
  readonly queryRefs: readonly CatalogReference[];
};

// ── Labels & Decision Logic ─────────────────────────────────────────────────

export type LabelDefinition = {
  readonly labelId: string;
  readonly displayName: string;
  readonly description: string;
  readonly severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
};

export type HardRule = {
  readonly ruleId: string;
  readonly description: string;
  readonly condition: string;
  readonly outcome: string;
  readonly bypassLlm: boolean;
};

export type ScoringGuidance = {
  readonly guidanceId: string;
  readonly description: string;
};

export type DecisionLogic = {
  readonly hardRules: readonly HardRule[];
  readonly scoringGuidance: readonly ScoringGuidance[];
  readonly defaultLabel: string;
};

// ── Confidence Computation ──────────────────────────────────────────────────

export type ConfidenceComputation = {
  readonly evidenceCompletenessWeight: number;
  readonly signalStrengthWeight: number;
  readonly signalAgreementWeight: number;
  readonly dataQualityWeight: number;
  readonly llmUncertaintyAlpha: number;
  readonly baseCoverageWeight: number;
  readonly additionalCoverageWeight: number;
  readonly criticalEvidenceMissingPenalty: number;
  readonly additionalQueryBonusMax: number;
};

// ── Phase Budget ────────────────────────────────────────────────────────────

export type PhaseBudget = {
  readonly maxQueries: number;
  readonly maxLlmCalls: number;
  readonly maxDurationMs: number;
};

// ── Output Contract ─────────────────────────────────────────────────────────

export type OutputContract = {
  readonly version: SemanticVersion;
  readonly requiredFields: readonly string[];
  readonly schema?: Record<string, unknown>;
};

// ── Playbook (top-level) ────────────────────────────────────────────────────

export type Playbook = {
  readonly useCaseId: string;
  readonly version: SemanticVersion;
  readonly displayName: string;
  readonly description: string;
  readonly inputContext: readonly InputContextField[];
  readonly evidenceOntology: EvidenceOntology;
  readonly baselineCatalogRefs: readonly CatalogReference[];
  readonly allowedCatalogRefs: readonly CatalogReference[];
  readonly evidenceRequestPolicy: EvidenceRequestPolicy;
  readonly deepDiveModules?: readonly DeepDiveModule[];
  readonly labels: readonly LabelDefinition[];
  readonly decisionLogic: DecisionLogic;
  readonly confidenceComputation: ConfidenceComputation;
  readonly phaseBudget?: PhaseBudget;
  readonly outputContract: OutputContract;
};

// ── Verdict & Results ───────────────────────────────────────────────────────

export type PlaybookVerdict = {
  readonly verdict: string;
  readonly rationale: string;
  readonly confidenceScore: number;
  /** LLM self-reported uncertainty (0–1). Higher = less certain. */
  readonly uLlm: number;
  /** Domain-specific outputs defined by the playbook's output_contract. */
  readonly additionalOutputs?: Record<string, unknown>;
  readonly queriesExecuted: readonly string[];
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly criticalEvidenceMissing: boolean;
  readonly hasContradictorySignals: boolean;
  readonly isEdgeCase?: boolean;
};

export type ConfidenceBreakdown = {
  readonly confidenceScore0To1: number;
  readonly confidenceScore1To5: number;
  readonly cGround: number;
  readonly uLlm: number;
  readonly alpha: number;
  readonly evidenceCompleteness: number;
  readonly signalStrength: number;
  readonly signalAgreement: number;
  readonly dataQuality: number;
  readonly baseCoverage: number;
  readonly additionalCoverage: number;
};

export type QueryResult = {
  readonly success: boolean;
  readonly data: readonly Record<string, unknown>[];
  readonly error?: string;
};

export type QueryResults = {
  readonly results: Record<string, QueryResult>;
};

export type PlaybookResult = {
  readonly playbookId: string;
  readonly playbookVersion: string;
  readonly verdict: PlaybookVerdict;
  readonly confidence: ConfidenceBreakdown;
  readonly hardRuleTriggered?: string;
  readonly evidence: readonly Record<string, unknown>[];
  readonly queriesExecuted: readonly string[];
  readonly ranAt: Date;
  readonly durationMs: number;
  readonly sessionId: string;
};
