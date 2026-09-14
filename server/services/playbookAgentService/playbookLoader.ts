/**
 * Playbook Loader — Load and validate investigation playbooks from YAML.
 *
 * Handles parsing, validation, and cross-reference checking of playbook configs.
 * Ensures baseline_catalog_refs is a subset of allowed_catalog_refs,
 * deep-dive query refs are in allowed set, and all label references are valid.
 *
 * @license Apache-2.0
 */

import {
  type CatalogReference,
  type CatalogType,
  type ConfidenceComputation,
  type DecisionLogic,
  type DeepDiveModule,
  type EvidenceOntology,
  type EvidenceRequestPolicy,
  type HardRule,
  type InputContextField,
  type InputFieldType,
  type LabelDefinition,
  type OutputContract,
  type PhaseBudget,
  type Playbook,
  formatCatalogReference,
  parseSemanticVersion,
  validateCatalogReference,
} from './playbookTypes.js';

// ── Raw YAML types (snake_case as authored) ─────────────────────────────────

type RawCatalogRef = {
  catalog_id: string;
  version: string;
  catalog_type: string;
};

type RawPlaybook = {
  use_case_id: string;
  version: string;
  display_name: string;
  description: string;
  input_context: Array<{
    field_name: string;
    field_type: string;
    required: boolean;
    description: string;
    default?: unknown;
    validation_pattern?: string;
    catalog_parameter_name?: string;
  }>;
  evidence_ontology: {
    version: string;
    evidence_types: Array<{
      evidence_id: string;
      display_name: string;
      description: string;
      quality?: {
        freshness_max_age_ms?: number;
        minimum_confidence?: number;
        minimum_num_required_sources?: number;
      };
    }>;
  };
  baseline_catalog_refs: RawCatalogRef[];
  allowed_catalog_refs: RawCatalogRef[];
  evidence_request_policy: {
    query_selection_mode: string;
    max_rounds: number;
    target_confidence: number;
    max_additional_queries: number;
    stop_if_no_new_evidence: boolean;
    trigger_deep_dive_if?: string;
    stop_investigation_if?: string;
    guidance?: string;
  };
  deep_dive_modules?: Array<{
    module_id: string;
    display_name: string;
    description: string;
    entry_conditions: Array<{
      condition_id: string;
      description: string;
      expression: string;
    }>;
    exit_conditions: Array<{
      condition_id: string;
      description: string;
      expression: string;
    }>;
    query_refs: RawCatalogRef[];
  }>;
  labels: Array<{
    label_id: string;
    display_name: string;
    description: string;
    severity?: string;
  }>;
  decision_logic: {
    hard_rules: Array<{
      rule_id: string;
      description: string;
      condition: string;
      outcome: string;
      bypass_llm: boolean;
    }>;
    scoring_guidance?: Array<{
      guidance_id: string;
      description: string;
    }>;
    default_label: string;
  };
  confidence_computation: {
    evidence_completeness_weight: number;
    signal_strength_weight: number;
    signal_agreement_weight: number;
    data_quality_weight: number;
    llm_uncertainty_alpha: number;
    base_coverage_weight?: number;
    additional_coverage_weight?: number;
    critical_evidence_missing_penalty?: number;
    additional_query_bonus_max?: number;
  };
  phase_budget?: {
    max_queries: number;
    max_llm_calls: number;
    max_duration_ms: number;
  };
  output_contract: {
    version: string;
    required_fields: string[];
    schema?: Record<string, unknown>;
  };
};

// ── Conversion helpers ──────────────────────────────────────────────────────

function toCatalogReference(raw: RawCatalogRef): CatalogReference {
  const ref: CatalogReference = {
    catalogId: raw.catalog_id,
    version: parseSemanticVersion(raw.version),
    catalogType: raw.catalog_type as CatalogType,
  };
  validateCatalogReference(ref);
  return ref;
}

const VALID_INPUT_FIELD_TYPES = new Set([
  'string',
  'integer',
  'float',
  'boolean',
  'date',
  'datetime',
]);

const VALID_SEVERITIES = new Set([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]);

// ── Validation ──────────────────────────────────────────────────────────────

export type PlaybookValidationError = {
  readonly field: string;
  readonly message: string;
};

function validatePlaybookCrossRefs(playbook: Playbook): PlaybookValidationError[] {
  const errors: PlaybookValidationError[] = [];

  // baseline_catalog_refs must be a subset of allowed_catalog_refs
  const allowedIds = new Set(
    playbook.allowedCatalogRefs.map(formatCatalogReference),
  );
  for (const ref of playbook.baselineCatalogRefs) {
    const refStr = formatCatalogReference(ref);
    if (!allowedIds.has(refStr)) {
      errors.push({
        field: 'baselineCatalogRefs',
        message: `Baseline ref '${refStr}' not found in allowed_catalog_refs`,
      });
    }
  }

  // deep-dive query refs must be in allowed set
  if (playbook.deepDiveModules) {
    for (const mod of playbook.deepDiveModules) {
      for (const ref of mod.queryRefs) {
        const refStr = formatCatalogReference(ref);
        if (!allowedIds.has(refStr)) {
          errors.push({
            field: `deepDiveModules.${mod.moduleId}`,
            message: `Deep-dive ref '${refStr}' not found in allowed_catalog_refs`,
          });
        }
      }
    }
  }

  // hard rule outcomes must reference valid labels
  const labelIds = new Set(playbook.labels.map((l) => l.labelId));
  for (const rule of playbook.decisionLogic.hardRules) {
    if (!labelIds.has(rule.outcome)) {
      errors.push({
        field: `decisionLogic.hardRules.${rule.ruleId}`,
        message: `Hard rule outcome '${rule.outcome}' is not a valid label`,
      });
    }
  }

  // default label must be valid
  if (!labelIds.has(playbook.decisionLogic.defaultLabel)) {
    errors.push({
      field: 'decisionLogic.defaultLabel',
      message: `Default label '${playbook.decisionLogic.defaultLabel}' is not a valid label`,
    });
  }

  // confidence weights should sum to ~1.0
  const cc = playbook.confidenceComputation;
  const weightSum =
    cc.evidenceCompletenessWeight +
    cc.signalStrengthWeight +
    cc.signalAgreementWeight +
    cc.dataQualityWeight;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push({
      field: 'confidenceComputation',
      message: `Confidence weights sum to ${weightSum}, expected ~1.0`,
    });
  }

  return errors;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a raw YAML-deserialized object into a validated Playbook.
 *
 * Call this with the result of `yaml.load(...)` or `JSON.parse(...)`.
 * Throws on invalid structure or cross-reference violations.
 */
export function parsePlaybook(raw: unknown): Playbook {
  const r = raw as Partial<RawPlaybook>;

  if (
    typeof r.use_case_id !== 'string' ||
    typeof r.version !== 'string' ||
    typeof r.display_name !== 'string' ||
    typeof r.description !== 'string' ||
    r.evidence_ontology == null ||
    !Array.isArray(r.baseline_catalog_refs) ||
    !Array.isArray(r.allowed_catalog_refs) ||
    r.evidence_request_policy == null ||
    !Array.isArray(r.labels) ||
    r.decision_logic == null ||
    r.confidence_computation == null ||
    r.output_contract == null
  ) {
    throw new Error('Playbook is missing required top-level fields');
  }

  const inputContext: InputContextField[] = (r.input_context ?? []).map(
    (f) => {
      if (!VALID_INPUT_FIELD_TYPES.has(f.field_type)) {
        throw new Error(`Invalid field_type '${f.field_type}' for input '${f.field_name}'`);
      }
      return {
        fieldName: f.field_name,
        fieldType: f.field_type as InputFieldType,
        required: f.required,
        description: f.description,
        default: f.default,
        validationPattern: f.validation_pattern,
        catalogParameterName: f.catalog_parameter_name,
      };
    },
  );

  const evidenceOntology: EvidenceOntology = {
    version: parseSemanticVersion(r.evidence_ontology.version),
    evidenceTypes: r.evidence_ontology.evidence_types.map((et) => ({
      evidenceId: et.evidence_id,
      displayName: et.display_name,
      description: et.description,
      quality: {
        freshnessMaxAgeMs: et.quality?.freshness_max_age_ms,
        minimumConfidence: et.quality?.minimum_confidence ?? 0.0,
        minimumNumRequiredSources: et.quality?.minimum_num_required_sources ?? 1,
      },
    })),
  };

  const baselineCatalogRefs = r.baseline_catalog_refs.map(toCatalogReference);
  const allowedCatalogRefs = r.allowed_catalog_refs.map(toCatalogReference);

  const evidenceRequestPolicy: EvidenceRequestPolicy = {
    querySelectionMode: 'query_id',
    maxRounds: r.evidence_request_policy.max_rounds,
    targetConfidence: r.evidence_request_policy.target_confidence,
    maxAdditionalQueries: r.evidence_request_policy.max_additional_queries,
    stopIfNoNewEvidence: r.evidence_request_policy.stop_if_no_new_evidence,
    triggerDeepDiveIf: r.evidence_request_policy.trigger_deep_dive_if,
    stopInvestigationIf: r.evidence_request_policy.stop_investigation_if,
    guidance: r.evidence_request_policy.guidance,
  };

  const deepDiveModules: DeepDiveModule[] | undefined =
    r.deep_dive_modules?.map((m) => ({
      moduleId: m.module_id,
      displayName: m.display_name,
      description: m.description,
      entryConditions: m.entry_conditions.map((c) => ({
        conditionId: c.condition_id,
        description: c.description,
        expression: c.expression,
      })),
      exitConditions: m.exit_conditions.map((c) => ({
        conditionId: c.condition_id,
        description: c.description,
        expression: c.expression,
      })),
      queryRefs: m.query_refs.map(toCatalogReference),
    }));

  const labels: LabelDefinition[] = r.labels.map((l) => {
    if (l.severity && !VALID_SEVERITIES.has(l.severity)) {
      throw new Error(
        `Invalid severity '${l.severity}' for label '${l.label_id}'`,
      );
    }
    return {
      labelId: l.label_id,
      displayName: l.display_name,
      description: l.description,
      severity: l.severity as LabelDefinition['severity'],
    };
  });

  const hardRules: HardRule[] = r.decision_logic.hard_rules.map((hr) => ({
    ruleId: hr.rule_id,
    description: hr.description,
    condition: hr.condition,
    outcome: hr.outcome,
    bypassLlm: hr.bypass_llm,
  }));

  const decisionLogic: DecisionLogic = {
    hardRules,
    scoringGuidance: (r.decision_logic.scoring_guidance ?? []).map((sg) => ({
      guidanceId: sg.guidance_id,
      description: sg.description,
    })),
    defaultLabel: r.decision_logic.default_label,
  };

  const cc = r.confidence_computation;
  const confidenceComputation: ConfidenceComputation = {
    evidenceCompletenessWeight: cc.evidence_completeness_weight,
    signalStrengthWeight: cc.signal_strength_weight,
    signalAgreementWeight: cc.signal_agreement_weight,
    dataQualityWeight: cc.data_quality_weight,
    llmUncertaintyAlpha: cc.llm_uncertainty_alpha,
    baseCoverageWeight: cc.base_coverage_weight ?? 0.7,
    additionalCoverageWeight: cc.additional_coverage_weight ?? 0.3,
    criticalEvidenceMissingPenalty: cc.critical_evidence_missing_penalty ?? 0.3,
    additionalQueryBonusMax: cc.additional_query_bonus_max ?? 0.2,
  };

  const phaseBudget: PhaseBudget | undefined = r.phase_budget
    ? {
        maxQueries: r.phase_budget.max_queries,
        maxLlmCalls: r.phase_budget.max_llm_calls,
        maxDurationMs: r.phase_budget.max_duration_ms,
      }
    : undefined;

  const outputContract: OutputContract = {
    version: parseSemanticVersion(r.output_contract.version),
    requiredFields: r.output_contract.required_fields,
    schema: r.output_contract.schema,
  };

  const playbook: Playbook = {
    useCaseId: r.use_case_id,
    version: parseSemanticVersion(r.version),
    displayName: r.display_name,
    description: r.description,
    inputContext,
    evidenceOntology,
    baselineCatalogRefs,
    allowedCatalogRefs,
    evidenceRequestPolicy,
    deepDiveModules,
    labels,
    decisionLogic,
    confidenceComputation,
    phaseBudget,
    outputContract,
  };

  const errors = validatePlaybookCrossRefs(playbook);
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.field}: ${e.message}`)
      .join('\n');
    throw new Error(`Playbook validation failed:\n${details}`);
  }

  return playbook;
}
