import { PlaybookAgentService } from './playbookAgentService.js';
import { jsonStringify } from '../../utils/encoding.js';
import type {
  IArtifactStore,
  IEvidenceStore,
  ILLMAdapter,
  PlaybookArtifact,
} from './interfaces.js';
import type { Playbook } from './playbookTypes.js';

function makePlaybook(): Playbook {
  return {
    useCaseId: 'dummy_csam_triage',
    version: { major: 1, minor: 0, patch: 0 },
    displayName: 'Dummy CSAM Triage',
    description: 'Smoke-test playbook for local service verification.',
    inputContext: [
      {
        fieldName: 'item_id',
        fieldType: 'string',
        required: true,
        description: 'Submitted item id',
      },
    ],
    evidenceOntology: {
      version: { major: 1, minor: 0, patch: 0 },
      evidenceTypes: [
        {
          evidenceId: 'hash_match',
          displayName: 'Hash Match',
          description: 'Known hash match evidence',
          quality: {
            minimumConfidence: 1,
            minimumNumRequiredSources: 1,
          },
        },
      ],
    },
    baselineCatalogRefs: [
      {
        catalogId: 'hash_match_history',
        version: { major: 1, minor: 0, patch: 0 },
        catalogType: 'query',
      },
    ],
    allowedCatalogRefs: [
      {
        catalogId: 'hash_match_history',
        version: { major: 1, minor: 0, patch: 0 },
        catalogType: 'query',
      },
    ],
    evidenceRequestPolicy: {
      querySelectionMode: 'query_id',
      maxRounds: 1,
      targetConfidence: 0.8,
      maxAdditionalQueries: 0,
      stopIfNoNewEvidence: true,
      guidance: 'Use only the supplied evidence.',
    },
    labels: [
      {
        labelId: 'NO_ACTION',
        displayName: 'No Action',
        description: 'No enforcement needed.',
        severity: 'INFO',
      },
      {
        labelId: 'REPORT_AND_REMOVE',
        displayName: 'Report and Remove',
        description: 'Known critical hash match requires reporting and removal.',
        severity: 'CRITICAL',
      },
    ],
    decisionLogic: {
      hardRules: [
        {
          ruleId: 'known_critical_hash',
          description: 'Critical hash matches are deterministic.',
          condition: "hash_match_history.severity_tier == 'CRITICAL'",
          outcome: 'REPORT_AND_REMOVE',
          bypassLlm: true,
        },
      ],
      scoringGuidance: [],
      defaultLabel: 'NO_ACTION',
    },
    confidenceComputation: {
      evidenceCompletenessWeight: 0.35,
      signalStrengthWeight: 0.25,
      signalAgreementWeight: 0.25,
      dataQualityWeight: 0.15,
      llmUncertaintyAlpha: 0.4,
      baseCoverageWeight: 1,
      additionalCoverageWeight: 0,
      criticalEvidenceMissingPenalty: 0.3,
      additionalQueryBonusMax: 0,
    },
    outputContract: {
      version: { major: 1, minor: 0, patch: 0 },
      requiredFields: [
        'verdict',
        'rationale',
        'confidence_score',
        'u_llm',
        'queries_executed',
        'supporting_evidence',
        'contradicting_evidence',
        'critical_evidence_missing',
        'has_contradictory_signals',
      ],
    },
  };
}

function makeArtifactsStore(): IArtifactStore {
  const store = jest.fn(async (_artifact: PlaybookArtifact) => {});
  return {
    store,
    async getBySessionId(sessionId) {
      const artifacts = store.mock.calls.map(([artifact]) => artifact);
      return artifacts.filter((artifact) => artifact.sessionId === sessionId);
    },
  };
}

function makeService(options?: {
  llmAdapter?: ILLMAdapter;
  evidenceStore?: IEvidenceStore;
  artifactStore?: IArtifactStore;
}) {
  const playbook = makePlaybook();

  return new PlaybookAgentService({
    llmAdapter:
      options?.llmAdapter ??
      ({
        async complete() {
          return {
            content: jsonStringify({
              verdict: 'NO_ACTION',
              rationale:
                'The model chose NO_ACTION, but the hard rule should override it.',
              confidence_score: 2,
              u_llm: 0.2,
              queries_executed: ['hash_match_history'],
              supporting_evidence: [
                'hash_match_history.severity_tier=CRITICAL',
              ],
              contradicting_evidence: [],
              critical_evidence_missing: false,
              has_contradictory_signals: false,
            }),
          };
        },
      } satisfies ILLMAdapter),
    evidenceStore:
      options?.evidenceStore ??
      ({
        async executeQuery(query) {
          return {
            success: true,
            data: [
              {
                item_id: query.parameters['item_id'],
                severity_tier: 'CRITICAL',
                total_matches: 1,
              },
            ],
          };
        },
      } satisfies IEvidenceStore),
    artifactStore: options?.artifactStore ?? makeArtifactsStore(),
    playbooks: new Map([[playbook.useCaseId, playbook]]),
    queuePlaybookMapping: new Map([['dummy-queue', playbook.useCaseId]]),
  });
}

describe('PlaybookAgentService', () => {
  it('returns undefined when the queue has no configured playbook', async () => {
    const service = makeService();

    await expect(
      service.runForJob({
        orgId: 'org-1',
        queueId: 'unmapped-queue',
        itemId: 'item-without-playbook',
        itemTypeId: 'content-type',
        itemData: { text: 'no playbook here' },
      }),
    ).resolves.toBeUndefined();
  });

  it('runs a mapped playbook and lets hard rules override the LLM verdict', async () => {
    const artifactStore = makeArtifactsStore();
    const service = makeService({ artifactStore });

    const result = await service.runForJob({
      orgId: 'org-1',
      queueId: 'dummy-queue',
      itemId: 'dummy-item-123',
      itemTypeId: 'content-type',
      itemData: { text: 'dummy test content' },
    });

    expect(result).toBeDefined();
    expect(result!.verdict.verdict).toBe('REPORT_AND_REMOVE');
    expect(result!.verdict.rationale).toContain('hard rule should override');
    expect(result!.hardRuleTriggered).toBe('known_critical_hash');
    expect(result!.queriesExecuted).toEqual(['hash_match_history']);
    expect(result!.evidence).toEqual([
      {
        item_id: 'dummy-item-123',
        severity_tier: 'CRITICAL',
        total_matches: 1,
        _catalogId: 'hash_match_history',
      },
    ]);
    expect(result!.confidence.confidenceScore0To1).toBeGreaterThan(0);
    expect(result!.confidence.confidenceScore1To5).toBeGreaterThanOrEqual(1);
    const storedArtifacts = await artifactStore.getBySessionId(
      result!.sessionId,
    );
    expect(storedArtifacts.map((artifact) => artifact.artifactType)).toEqual([
      'verdict',
      'confidence',
    ]);
  });

  it('returns undefined instead of blocking the caller when a playbook run fails', async () => {
    const service = makeService({
      llmAdapter: {
        async complete() {
          throw new Error('llm unavailable');
        },
      },
    });

    await expect(
      service.runForJob({
        orgId: 'org-1',
        queueId: 'dummy-queue',
        itemId: 'dummy-item-123',
        itemTypeId: 'content-type',
        itemData: { text: 'dummy test content' },
      }),
    ).resolves.toBeUndefined();
  });
});
