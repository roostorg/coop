import { computeConfidence } from './confidenceEngine.js';
import type {
  ConfidenceComputation,
  Playbook,
  PlaybookVerdict,
  QueryResults,
} from './playbookTypes.js';

function makePlaybook(
  overrides: Partial<ConfidenceComputation> = {},
): Playbook {
  return {
    useCaseId: 'test_use_case',
    version: { major: 1, minor: 0, patch: 0 },
    displayName: 'Test',
    description: 'Test playbook',
    inputContext: [],
    evidenceOntology: {
      version: { major: 1, minor: 0, patch: 0 },
      evidenceTypes: [],
    },
    baselineCatalogRefs: [
      { catalogId: 'query_a', version: { major: 1, minor: 0, patch: 0 }, catalogType: 'query' },
      { catalogId: 'query_b', version: { major: 1, minor: 0, patch: 0 }, catalogType: 'query' },
    ],
    allowedCatalogRefs: [
      { catalogId: 'query_a', version: { major: 1, minor: 0, patch: 0 }, catalogType: 'query' },
      { catalogId: 'query_b', version: { major: 1, minor: 0, patch: 0 }, catalogType: 'query' },
      { catalogId: 'query_c', version: { major: 1, minor: 0, patch: 0 }, catalogType: 'query' },
    ],
    evidenceRequestPolicy: {
      querySelectionMode: 'query_id',
      maxRounds: 3,
      targetConfidence: 0.75,
      maxAdditionalQueries: 5,
      stopIfNoNewEvidence: true,
    },
    labels: [],
    decisionLogic: { hardRules: [], scoringGuidance: [], defaultLabel: 'SAFE' },
    confidenceComputation: {
      evidenceCompletenessWeight: 0.35,
      signalStrengthWeight: 0.25,
      signalAgreementWeight: 0.25,
      dataQualityWeight: 0.15,
      llmUncertaintyAlpha: 0.4,
      baseCoverageWeight: 0.7,
      additionalCoverageWeight: 0.3,
      criticalEvidenceMissingPenalty: 0.3,
      additionalQueryBonusMax: 0.2,
      ...overrides,
    },
    outputContract: {
      version: { major: 1, minor: 0, patch: 0 },
      requiredFields: ['verdict', 'rationale', 'confidence_score'],
    },
  };
}

function makeVerdict(overrides: Partial<PlaybookVerdict> = {}): PlaybookVerdict {
  return {
    verdict: 'RISKY',
    rationale: 'Test rationale',
    confidenceScore: 4,
    uLlm: 0.1,
    queriesExecuted: ['query_a', 'query_b'],
    supportingEvidence: ['evidence_1', 'evidence_2'],
    contradictingEvidence: [],
    criticalEvidenceMissing: false,
    hasContradictorySignals: false,
    ...overrides,
  };
}

function makeQueryResults(
  results: Record<string, { success: boolean; data: Record<string, unknown>[] }>,
): QueryResults {
  return { results };
}

describe('confidenceEngine', () => {
  it('computes high confidence when all evidence is present and agrees', () => {
    const playbook = makePlaybook();
    const verdict = makeVerdict({ uLlm: 0.05, queriesExecuted: ['query_a', 'query_b', 'query_c'] });
    const queryResults = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] },
      query_b: { success: true, data: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }] },
      query_c: { success: true, data: [{ id: 11 }] },
    });

    const result = computeConfidence(verdict, queryResults, playbook);

    expect(result.confidenceScore0To1).toBeGreaterThan(0.9);
    expect(result.confidenceScore1To5).toBe(5);
    expect(result.cGround).toBeGreaterThan(0.9);
    expect(result.baseCoverage).toBe(1.0);
  });

  it('reduces confidence when critical evidence is missing', () => {
    const playbook = makePlaybook();
    const verdict = makeVerdict({ criticalEvidenceMissing: true });
    const queryResults = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }] },
      query_b: { success: true, data: [] },
    });

    const result = computeConfidence(verdict, queryResults, playbook);

    expect(result.confidenceScore0To1).toBeLessThan(0.8);
    expect(result.evidenceCompleteness).toBeLessThan(0.7);
  });

  it('penalizes contradictory signals', () => {
    const playbook = makePlaybook();

    const noContradiction = makeVerdict({
      supportingEvidence: ['a', 'b', 'c'],
      contradictingEvidence: [],
      hasContradictorySignals: false,
    });
    const withContradiction = makeVerdict({
      supportingEvidence: ['a', 'b'],
      contradictingEvidence: ['c'],
      hasContradictorySignals: true,
    });

    const qr = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] },
      query_b: { success: true, data: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }] },
    });

    const resultClean = computeConfidence(noContradiction, qr, playbook);
    const resultDirty = computeConfidence(withContradiction, qr, playbook);

    expect(resultDirty.signalAgreement).toBeLessThan(resultClean.signalAgreement);
    expect(resultDirty.confidenceScore0To1).toBeLessThan(resultClean.confidenceScore0To1);
  });

  it('LLM uncertainty can only reduce confidence', () => {
    const playbook = makePlaybook();
    const qr = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] },
      query_b: { success: true, data: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }] },
    });

    const lowUncertainty = computeConfidence(makeVerdict({ uLlm: 0.05 }), qr, playbook);
    const highUncertainty = computeConfidence(makeVerdict({ uLlm: 0.9 }), qr, playbook);

    // Same C_ground, different u_llm → higher uncertainty = lower C_final
    expect(lowUncertainty.cGround).toBeCloseTo(highUncertainty.cGround, 2);
    expect(highUncertainty.confidenceScore0To1).toBeLessThan(lowUncertainty.confidenceScore0To1);
  });

  it('handles query failures gracefully', () => {
    const playbook = makePlaybook();
    const verdict = makeVerdict({ queriesExecuted: ['query_a'] });
    const queryResults = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }] },
      query_b: { success: false, data: [] },
    });

    const result = computeConfidence(verdict, queryResults, playbook);

    expect(result.dataQuality).toBeLessThan(1.0);
    expect(result.confidenceScore0To1).toBeGreaterThan(0);
    expect(result.confidenceScore0To1).toBeLessThan(1);
  });

  it('produces valid 1–5 bucket scores', () => {
    const playbook = makePlaybook();
    const qr = makeQueryResults({
      query_a: { success: true, data: [{ id: 1 }] },
      query_b: { success: true, data: [{ id: 2 }] },
    });

    for (const uLlm of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const result = computeConfidence(makeVerdict({ uLlm }), qr, playbook);
      expect(result.confidenceScore1To5).toBeGreaterThanOrEqual(1);
      expect(result.confidenceScore1To5).toBeLessThanOrEqual(5);
      expect(Number.isInteger(result.confidenceScore1To5)).toBe(true);
    }
  });
});
