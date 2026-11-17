/**
 * Playbook Runner — Core orchestrator for investigation playbooks.
 *
 * Executes the full investigation pipeline:
 *   1. Load playbook config
 *   2. Execute baseline queries (evidence gathering)
 *   3. Evaluate hard rules (deterministic — before LLM)
 *   4. If no hard rule fires: call LLM for verdict
 *   5. Extract structured verdict from LLM output
 *   6. Compute grounded confidence score
 *   7. Store artifacts (immutable evidence chain)
 *   8. Return PlaybookResult
 *
 * @license Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { jsonStringify } from '../../utils/encoding.js';

import { computeConfidence } from './confidenceEngine.js';
import { evaluateHardRules, type HardRuleMatch } from './hardRuleEngine.js';
import type {
  IArtifactStore,
  IEvidenceStore,
  ILLMAdapter,
  IPlaybookRunner,
  PlaybookRunInput,
} from './interfaces.js';
import { extractVerdict } from './jsonExtractor.js';
import {
  type Playbook,
  type PlaybookResult,
  type QueryResult,
  type QueryResults,
  formatSemanticVersion,
} from './playbookTypes.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type PlaybookRunnerDeps = {
  readonly llmAdapter: ILLMAdapter;
  readonly evidenceStore: IEvidenceStore;
  readonly artifactStore: IArtifactStore;
};

// ── Prompt builders ─────────────────────────────────────────────────────────

function buildSystemPrompt(playbook: Playbook): string {
  const labelList = playbook.labels
    .map((l) => `- ${l.labelId}: ${l.description}`)
    .join('\n');

  const evidenceList = playbook.evidenceOntology.evidenceTypes
    .map((et) => `- ${et.evidenceId}: ${et.description}`)
    .join('\n');

  const outputFields = playbook.outputContract.requiredFields.join(', ');

  return [
    `You are an investigation agent for the "${playbook.displayName}" use case.`,
    `${playbook.description}`,
    '',
    'EVIDENCE TYPES:',
    evidenceList,
    '',
    'POSSIBLE VERDICTS:',
    labelList,
    '',
    `OUTPUT: Return a JSON object with these required fields: ${outputFields}`,
    '',
    playbook.evidenceRequestPolicy.guidance ?? '',
  ].join('\n');
}

function buildUserPrompt(
  inputContext: Record<string, unknown>,
  evidence: Record<string, QueryResult>,
  hardRuleMatch: HardRuleMatch | undefined,
): string {
  const sections: string[] = ['INVESTIGATION CONTEXT:'];

  // Input context
  for (const [key, value] of Object.entries(inputContext)) {
    sections.push(`  ${key}: ${jsonStringify(value)}`);
  }

  // Evidence from baseline queries
  sections.push('', 'EVIDENCE GATHERED:');
  for (const [catalogId, result] of Object.entries(evidence)) {
    if (result.success && result.data.length > 0) {
      sections.push(`  ${catalogId}: ${jsonStringify(result.data)}`);
    } else if (!result.success) {
      sections.push(`  ${catalogId}: QUERY FAILED — ${result.error ?? 'unknown error'}`);
    } else {
      sections.push(`  ${catalogId}: NO DATA RETURNED`);
    }
  }

  // Hard rule context
  if (hardRuleMatch) {
    sections.push(
      '',
      'HARD RULE TRIGGERED:',
      `  Rule: ${hardRuleMatch.ruleId}`,
      `  Condition: ${hardRuleMatch.matchedCondition}`,
      `  Outcome: ${hardRuleMatch.outcome} (LOCKED — you cannot override this verdict)`,
      '',
      'Your role: provide rationale and populate all required output fields.',
      'The verdict is already determined by the hard rule.',
    );
  }

  sections.push(
    '',
    'Analyze the evidence and return your verdict as a JSON object.',
  );

  return sections.join('\n');
}

// ── PlaybookRunner ──────────────────────────────────────────────────────────

export default class PlaybookRunner implements IPlaybookRunner {
  readonly #deps: PlaybookRunnerDeps;
  readonly #playbooks: ReadonlyMap<string, Playbook>;

  constructor(deps: PlaybookRunnerDeps, playbooks: ReadonlyMap<string, Playbook>) {
    this.#deps = deps;
    this.#playbooks = playbooks;
  }

  async run(input: PlaybookRunInput): Promise<PlaybookResult> {
    const startTime = Date.now();
    const sessionId = input.sessionId ?? uuidv4();

    // 1. Load playbook
    const playbook = this.#playbooks.get(input.playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: '${input.playbookId}'`);
    }

    // 2. Execute baseline queries
    const queryResults = await this.#executeBaselineQueries(
      playbook,
      input.inputContext,
    );

    // 3. Evaluate hard rules
    const hardRuleMatch = evaluateHardRules(
      playbook.decisionLogic.hardRules,
      queryResults.results,
    );

    // 4. Call LLM for verdict (even if hard rule fired — for rationale)
    const llmResponse = await this.#deps.llmAdapter.complete({
      systemPrompt: buildSystemPrompt(playbook),
      userPrompt: buildUserPrompt(
        input.inputContext,
        queryResults.results,
        hardRuleMatch,
      ),
    });

    // 5. Extract structured verdict
    let verdict = extractVerdict(llmResponse.content, playbook.outputContract);
    verdict ??= {
      verdict: playbook.decisionLogic.defaultLabel,
      rationale: 'Unable to extract structured verdict from LLM output',
      confidenceScore: 1,
      uLlm: 1.0,
      queriesExecuted: Object.keys(queryResults.results),
      supportingEvidence: [],
      contradictingEvidence: [],
      criticalEvidenceMissing: true,
      hasContradictorySignals: false,
    };

    // Override verdict if hard rule fired
    if (hardRuleMatch) {
      verdict = {
        ...verdict,
        verdict: hardRuleMatch.outcome,
      };
    }

    // 6. Compute grounded confidence
    const confidence = computeConfidence(verdict, queryResults, playbook);

    // 7. Store artifacts
    const result: PlaybookResult = {
      playbookId: playbook.useCaseId,
      playbookVersion: formatSemanticVersion(playbook.version),
      verdict,
      confidence,
      hardRuleTriggered: hardRuleMatch?.ruleId,
      evidence: this.#flattenEvidence(queryResults),
      queriesExecuted: Object.keys(queryResults.results),
      ranAt: new Date(),
      durationMs: Date.now() - startTime,
      sessionId,
    };

    await this.#storeArtifacts(result, sessionId, playbook.useCaseId);

    return result;
  }

  async #executeBaselineQueries(
    playbook: Playbook,
    inputContext: Record<string, unknown>,
  ): Promise<QueryResults> {
    const results: Record<string, QueryResult> = {};

    // Execute baseline queries in parallel
    const queryPromises = playbook.baselineCatalogRefs.map(async (ref) => {
      try {
        const result = await this.#deps.evidenceStore.executeQuery({
          catalogId: ref.catalogId,
          version: formatSemanticVersion(ref.version),
          parameters: inputContext,
        });
        results[ref.catalogId] = result;
      } catch (error) {
        results[ref.catalogId] = {
          success: false,
          data: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    await Promise.all(queryPromises);
    return { results };
  }

  #flattenEvidence(queryResults: QueryResults): Record<string, unknown>[] {
    const evidence: Record<string, unknown>[] = [];
    for (const [catalogId, result] of Object.entries(queryResults.results)) {
      if (result.success) {
        for (const row of result.data) {
          evidence.push({ ...row, _catalogId: catalogId });
        }
      }
    }
    return evidence;
  }

  async #storeArtifacts(
    result: PlaybookResult,
    sessionId: string,
    playbookId: string,
  ): Promise<void> {
    const now = new Date();

    await Promise.all([
      this.#deps.artifactStore.store({
        sessionId,
        playbookId,
        artifactType: 'verdict',
        data: result.verdict,
        createdAt: now,
      }),
      this.#deps.artifactStore.store({
        sessionId,
        playbookId,
        artifactType: 'confidence',
        data: result.confidence,
        createdAt: now,
      }),
    ]);
  }
}
