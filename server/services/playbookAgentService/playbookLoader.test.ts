import { parsePlaybook } from './playbookLoader.js';

const MINIMAL_PLAYBOOK = {
  use_case_id: 'test_investigation',
  version: '1.0.0',
  display_name: 'Test Investigation',
  description: 'A test playbook',
  input_context: [
    {
      field_name: 'account_id',
      field_type: 'string',
      required: true,
      description: 'Account to investigate',
    },
  ],
  evidence_ontology: {
    version: '1.0.0',
    evidence_types: [
      {
        evidence_id: 'login_patterns',
        display_name: 'Login Patterns',
        description: 'Login frequency analysis',
        quality: { minimum_confidence: 0.7, minimum_num_required_sources: 1 },
      },
    ],
  },
  baseline_catalog_refs: [
    { catalog_id: 'login_patterns', version: '1.0.0', catalog_type: 'query' },
  ],
  allowed_catalog_refs: [
    { catalog_id: 'login_patterns', version: '1.0.0', catalog_type: 'query' },
    { catalog_id: 'device_info', version: '1.0.0', catalog_type: 'query' },
  ],
  evidence_request_policy: {
    query_selection_mode: 'query_id',
    max_rounds: 3,
    target_confidence: 0.75,
    max_additional_queries: 5,
    stop_if_no_new_evidence: true,
  },
  labels: [
    { label_id: 'RISKY', display_name: 'Risky', description: 'Account is risky' },
    { label_id: 'SAFE', display_name: 'Safe', description: 'Account is safe' },
  ],
  decision_logic: {
    hard_rules: [],
    default_label: 'SAFE',
  },
  confidence_computation: {
    evidence_completeness_weight: 0.35,
    signal_strength_weight: 0.25,
    signal_agreement_weight: 0.25,
    data_quality_weight: 0.15,
    llm_uncertainty_alpha: 0.4,
  },
  output_contract: {
    version: '1.0.0',
    required_fields: ['verdict', 'rationale', 'confidence_score'],
  },
};

describe('parsePlaybook', () => {
  it('parses a valid playbook', () => {
    const playbook = parsePlaybook(MINIMAL_PLAYBOOK);

    expect(playbook.useCaseId).toBe('test_investigation');
    expect(playbook.version).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(playbook.baselineCatalogRefs).toHaveLength(1);
    expect(playbook.allowedCatalogRefs).toHaveLength(2);
    expect(playbook.labels).toHaveLength(2);
    expect(playbook.confidenceComputation.llmUncertaintyAlpha).toBe(0.4);
  });

  it('applies default values for optional confidence fields', () => {
    const playbook = parsePlaybook(MINIMAL_PLAYBOOK);

    expect(playbook.confidenceComputation.baseCoverageWeight).toBe(0.7);
    expect(playbook.confidenceComputation.additionalCoverageWeight).toBe(0.3);
    expect(playbook.confidenceComputation.criticalEvidenceMissingPenalty).toBe(0.3);
    expect(playbook.confidenceComputation.additionalQueryBonusMax).toBe(0.2);
  });

  it('rejects baseline ref not in allowed set', () => {
    const bad = {
      ...MINIMAL_PLAYBOOK,
      baseline_catalog_refs: [
        { catalog_id: 'unknown_query', version: '1.0.0', catalog_type: 'query' },
      ],
    };

    expect(() => parsePlaybook(bad)).toThrow('not found in allowed_catalog_refs');
  });

  it('rejects invalid default label', () => {
    const bad = {
      ...MINIMAL_PLAYBOOK,
      decision_logic: {
        hard_rules: [],
        default_label: 'NONEXISTENT',
      },
    };

    expect(() => parsePlaybook(bad)).toThrow("'NONEXISTENT' is not a valid label");
  });

  it('rejects confidence weights that do not sum to ~1.0', () => {
    const bad = {
      ...MINIMAL_PLAYBOOK,
      confidence_computation: {
        ...MINIMAL_PLAYBOOK.confidence_computation,
        evidence_completeness_weight: 0.5,
        signal_strength_weight: 0.5,
        signal_agreement_weight: 0.5,
        data_quality_weight: 0.5,
      },
    };

    expect(() => parsePlaybook(bad)).toThrow('weights sum to');
  });

  it('rejects invalid semantic version', () => {
    const bad = { ...MINIMAL_PLAYBOOK, version: 'not-a-version' };
    expect(() => parsePlaybook(bad)).toThrow('Invalid semantic version');
  });

  it('rejects forbidden catalog IDs', () => {
    const bad = {
      ...MINIMAL_PLAYBOOK,
      allowed_catalog_refs: [
        ...MINIMAL_PLAYBOOK.allowed_catalog_refs,
        { catalog_id: 'latest', version: '1.0.0', catalog_type: 'query' },
      ],
    };

    expect(() => parsePlaybook(bad)).toThrow("cannot be 'latest'");
  });

  it('validates hard rule outcomes against labels', () => {
    const bad = {
      ...MINIMAL_PLAYBOOK,
      decision_logic: {
        hard_rules: [
          {
            rule_id: 'test_rule',
            description: 'Test',
            condition: "data.field == 'value'",
            outcome: 'NONEXISTENT_LABEL',
            bypass_llm: true,
          },
        ],
        default_label: 'SAFE',
      },
    };

    expect(() => parsePlaybook(bad)).toThrow("'NONEXISTENT_LABEL' is not a valid label");
  });
});
