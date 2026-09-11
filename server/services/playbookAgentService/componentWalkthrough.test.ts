/**
 * Component walkthrough — exercises every component in the playbook agent
 * framework through two end-to-end scenarios:
 *
 *   1. Account Takeover (LLM decides) — no hard rules, LLM produces verdict
 *      from messy text, QueryCatalog parses SQL template, confidence is grounded
 *
 *   2. CSAM Triage (hard rule decides) — deterministic rule overrides LLM,
 *      artifact store captures immutable evidence chain
 *
 * Components exercised:
 *   - PlaybookLoader (parsePlaybook)
 *   - QueryCatalog (parseCatalogEntry, resolve, renderSql)
 *   - HardRuleEngine (evaluateHardRules)
 *   - JsonExtractor (extractVerdict from raw LLM text)
 *   - ConfidenceEngine (computeConfidence)
 *   - PlaybookRunner (full pipeline via PlaybookAgentService)
 *   - Interfaces (ILLMAdapter, IEvidenceStore, IArtifactStore)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryJsonParse } from '../../utils/encoding.js';
import { computeConfidence } from './confidenceEngine.js';
import { evaluateHardRules } from './hardRuleEngine.js';
import type {
  IArtifactStore,
  IEvidenceStore,
  ILLMAdapter,
  PlaybookArtifact,
} from './interfaces.js';
import { extractVerdict } from './jsonExtractor.js';
import { PlaybookAgentService } from './playbookAgentService.js';
import { parsePlaybook } from './playbookLoader.js';
import type { Playbook, PlaybookVerdict, QueryResults } from './playbookTypes.js';
import QueryCatalog, { parseCatalogEntry } from './queryCatalog.js';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), 'examples');

function readExample(filename: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const raw = readFileSync(join(examplesDir, filename), 'utf-8');
  const parsed = tryJsonParse(raw);
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
    throw new Error(`Example '${filename}' must be a JSON object`);
  }
  return parsed;
}

function readSql(filename: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(join(examplesDir, filename), 'utf-8');
}

// ── Scenario 1: Account Takeover (LLM decides, no hard rules) ──────────────

describe('Scenario: Account Takeover — LLM decides verdict', () => {
  let playbook: Playbook;

  beforeAll(() => {
    playbook = parsePlaybook(
      readExample('account_takeover_triage.playbook.json'),
    );
  });

  it('PlaybookLoader: parses the ATO playbook with no hard rules', () => {
    expect(playbook.useCaseId).toBe('account_takeover_triage');
    expect(playbook.decisionLogic.hardRules).toHaveLength(0);
    expect(playbook.labels).toHaveLength(3);
    expect(playbook.labels.map((l) => l.labelId)).toEqual([
      'ATO_CONFIRMED',
      'ATO_SUSPECTED',
      'LEGITIMATE',
    ]);
    expect(playbook.decisionLogic.defaultLabel).toBe('LEGITIMATE');
  });

  it('QueryCatalog: parses SQL template and renders with parameters', () => {
    const sql = readSql('account_takeover_triage.catalog.sql');
    const entry = parseCatalogEntry(sql);

    expect(entry.catalogId).toBe('login_patterns');
    expect(entry.version).toBe('1.0.0');
    expect(entry.parameters).toContain('account_id');
    expect(entry.parameters).toContain('lookback_days');
    expect(entry.sql).toContain(':account_id');

    const catalog = new QueryCatalog([entry]);
    const resolved = catalog.resolve(playbook.baselineCatalogRefs[0]!);
    expect(resolved).toBeDefined();

    const { sql: rendered, bindings } = catalog.renderSql(resolved!, {
      account_id: 'acc_12345',
      lookback_days: 30,
    });

    expect(rendered).toContain('$1'); // account_id
    expect(rendered).toContain('$2'); // lookback_days
    expect(rendered).not.toContain(':account_id');
    expect(bindings).toEqual(['acc_12345', 30]);
  });

  it('HardRuleEngine: no rules fire (empty hard_rules list)', () => {
    const queryResults = {
      login_patterns: {
        success: true,
        data: [
          { login_date: '2026-05-20', login_count: 15, failed_logins: 12, distinct_ips: 8, distinct_countries: 4 },
        ],
      },
    };

    const match = evaluateHardRules(playbook.decisionLogic.hardRules, queryResults);
    expect(match).toBeUndefined();
  });

  it('JsonExtractor: extracts verdict from messy LLM output with surrounding text', () => {
    const messyLlmOutput = `
Based on my analysis of the login patterns, I've identified several concerning signals.

The account shows 12 failed logins from 8 different IPs across 4 countries in a single day,
which is consistent with credential stuffing followed by a successful compromise.

Here is my structured assessment:

\`\`\`json
{"verdict": "ATO_CONFIRMED", "rationale": "12 failed logins from 8 IPs across 4 countries in 24h is consistent with credential stuffing. The successful login from a new device in a 5th country 2 hours later confirms compromise.", "confidence_score": 4, "u_llm": 0.15, "queries_executed": ["login_patterns"], "supporting_evidence": ["geo_impossible_travel", "credential_stuffing_pattern", "new_device_after_failures"], "contradicting_evidence": [], "critical_evidence_missing": false, "has_contradictory_signals": false}
\`\`\`

I recommend immediate account lockout and password reset.
    `;

    const verdict = extractVerdict(messyLlmOutput, playbook.outputContract);

    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('ATO_CONFIRMED');
    expect(verdict!.uLlm).toBe(0.15);
    expect(verdict!.supportingEvidence).toHaveLength(3);
    expect(verdict!.contradictingEvidence).toHaveLength(0);
    expect(verdict!.rationale).toContain('credential stuffing');
  });

  it('ConfidenceEngine: computes grounded score for LLM verdict', () => {
    const verdict: PlaybookVerdict = {
      verdict: 'ATO_CONFIRMED',
      rationale: 'Credential stuffing pattern detected.',
      confidenceScore: 4,
      uLlm: 0.15,
      queriesExecuted: ['login_patterns'],
      supportingEvidence: ['geo_impossible', 'credential_stuffing', 'new_device'],
      contradictingEvidence: [],
      criticalEvidenceMissing: false,
      hasContradictorySignals: false,
    };

    const queryResults: QueryResults = {
      results: {
        login_patterns: {
          success: true,
          data: [
            { login_date: '2026-05-20', login_count: 15, failed_logins: 12, distinct_ips: 8 },
            { login_date: '2026-05-19', login_count: 3, failed_logins: 0, distinct_ips: 1 },
          ],
        },
      },
    };

    const confidence = computeConfidence(verdict, queryResults, playbook);

    // LLM uncertainty is low (0.15) so it barely reduces confidence
    expect(confidence.uLlm).toBe(0.15);
    expect(confidence.alpha).toBe(0.4);
    expect(confidence.confidenceScore0To1).toBeGreaterThan(0);
    expect(confidence.confidenceScore0To1).toBeLessThanOrEqual(1);
    expect(confidence.confidenceScore1To5).toBeGreaterThanOrEqual(1);
    expect(confidence.confidenceScore1To5).toBeLessThanOrEqual(5);
    // C_final = C_ground * (1 - 0.4 * 0.15) = C_ground * 0.94
    expect(confidence.confidenceScore0To1).toBeCloseTo(
      confidence.cGround * (1 - 0.4 * 0.15),
      3,
    );
  });

  it('PlaybookAgentService: full pipeline — LLM verdict is used (no hard rule)', async () => {
    const artifacts: PlaybookArtifact[] = [];

    const service = new PlaybookAgentService({
      llmAdapter: {
        async complete() {
          return {
            content: JSON.stringify({
              verdict: 'ATO_SUSPECTED',
              rationale: 'Suspicious login pattern from multiple countries.',
              confidence_score: 3,
              u_llm: 0.3,
              queries_executed: ['login_patterns'],
              supporting_evidence: ['multi_country_logins'],
              contradicting_evidence: ['known_vpn_usage'],
              critical_evidence_missing: false,
              has_contradictory_signals: true,
            }),
          };
        },
      } satisfies ILLMAdapter,
      evidenceStore: {
        async executeQuery() {
          return {
            success: true,
            data: [
              { login_date: '2026-05-20', login_count: 5, failed_logins: 2, distinct_countries: 3 },
            ],
          };
        },
      } satisfies IEvidenceStore,
      artifactStore: {
        async store(artifact) { artifacts.push(artifact); },
        async getBySessionId(sid) { return artifacts.filter((a) => a.sessionId === sid); },
      } satisfies IArtifactStore,
      playbooks: new Map([[playbook.useCaseId, playbook]]),
      queuePlaybookMapping: new Map([['ato-review-queue', playbook.useCaseId]]),
    });

    const result = await service.runForJob({
      orgId: 'org-1',
      queueId: 'ato-review-queue',
      itemId: 'user_abc',
      itemTypeId: 'user',
      itemData: { account_id: 'acc_12345', lookback_days: 30 },
    });

    // LLM verdict is used (no hard rule override)
    expect(result).toBeDefined();
    expect(result!.verdict.verdict).toBe('ATO_SUSPECTED');
    expect(result!.hardRuleTriggered).toBeUndefined();
    expect(result!.verdict.hasContradictorySignals).toBe(true);

    // Confidence is penalized for contradictory signals
    expect(result!.confidence.signalAgreement).toBeLessThan(1.0);

    // Artifacts stored
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((a) => a.artifactType).sort()).toEqual(['confidence', 'verdict']);
  });
});

// ── Scenario 2: CSAM Triage (hard rule overrides LLM) ──────────────────────

describe('Scenario: CSAM Triage — hard rule overrides LLM', () => {
  let playbook: Playbook;

  beforeAll(() => {
    playbook = parsePlaybook(
      readExample('dummy_csam_triage.playbook.json'),
    );
  });

  it('HardRuleEngine: critical hash match fires deterministic rule', () => {
    const queryResults = {
      hash_match_history: {
        success: true,
        data: [{ severity_tier: 'CRITICAL', total_matches: 1 }],
      },
    };

    const match = evaluateHardRules(playbook.decisionLogic.hardRules, queryResults);
    expect(match).toBeDefined();
    expect(match!.ruleId).toBe('known_critical_hash');
    expect(match!.outcome).toBe('REPORT_AND_REMOVE');
    expect(match!.bypassLlm).toBe(true);
  });

  it('PlaybookAgentService: hard rule overrides LLM even when LLM says NO_ACTION', async () => {
    const service = new PlaybookAgentService({
      llmAdapter: {
        async complete() {
          return {
            content: JSON.stringify({
              verdict: 'NO_ACTION',
              rationale: 'LLM incorrectly says no action needed.',
              confidence_score: 5,
              u_llm: 0.01,
              queries_executed: ['hash_match_history'],
              supporting_evidence: [],
              contradicting_evidence: [],
              critical_evidence_missing: false,
              has_contradictory_signals: false,
            }),
          };
        },
      } satisfies ILLMAdapter,
      evidenceStore: {
        async executeQuery() {
          return {
            success: true,
            data: [{ severity_tier: 'CRITICAL', total_matches: 1 }],
          };
        },
      } satisfies IEvidenceStore,
      artifactStore: {
        async store() {},
        async getBySessionId() { return []; },
      } satisfies IArtifactStore,
      playbooks: new Map([[playbook.useCaseId, playbook]]),
      queuePlaybookMapping: new Map([['csam-queue', playbook.useCaseId]]),
    });

    const result = await service.runForJob({
      orgId: 'org-1',
      queueId: 'csam-queue',
      itemId: 'item-999',
      itemTypeId: 'content',
      itemData: {},
    });

    // Hard rule overrides the LLM's NO_ACTION
    expect(result!.verdict.verdict).toBe('REPORT_AND_REMOVE');
    expect(result!.hardRuleTriggered).toBe('known_critical_hash');
    // LLM rationale is preserved even though verdict was overridden
    expect(result!.verdict.rationale).toContain('no action');
  });
});
