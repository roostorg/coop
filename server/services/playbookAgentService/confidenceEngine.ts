/**
 * Confidence Engine — Grounded confidence scoring.
 *
 * Implements the playbook-driven confidence formula:
 *   C_final = C_ground * (1 - alpha * u_llm)
 *
 * Where:
 *   C_ground: Computed from objective, query-backed factors
 *     1. Evidence completeness (required evidence present vs missing)
 *     2. Signal strength (data volume and investigation depth)
 *     3. Signal agreement (supporting vs contradicting evidence)
 *     4. Data quality (query success rate and result quality)
 *
 *   u_llm: LLM's self-reported uncertainty (0–1)
 *   alpha: Playbook-configured uncertainty weight
 *
 * The LLM can only REDUCE confidence — it can never inflate it.
 *
 * @license Apache-2.0
 */

import type {
  ConfidenceBreakdown,
  Playbook,
  PlaybookVerdict,
  QueryResults,
} from './playbookTypes.js';

/**
 * Compute grounded confidence score from objective evidence factors.
 *
 * Takes the LLM's u_llm, computes C_ground from query results,
 * and applies the playbook formula: C_final = C_ground * (1 - alpha * u_llm)
 */
export function computeConfidence(
  verdict: PlaybookVerdict,
  queryResults: QueryResults,
  playbook: Playbook,
): ConfidenceBreakdown {
  const cc = playbook.confidenceComputation;
  const alpha = cc.llmUncertaintyAlpha;
  const uLlm = verdict.uLlm;

  // Identify baseline vs additional query IDs
  const baselineQueryIds = new Set(
    playbook.baselineCatalogRefs.map((ref) => ref.catalogId),
  );
  const allowedQueryIds = new Set(
    playbook.allowedCatalogRefs.map((ref) => ref.catalogId),
  );
  const additionalQueryIds = new Set(
    [...allowedQueryIds].filter((id) => !baselineQueryIds.has(id)),
  );

  const queriesExecuted = new Set(verdict.queriesExecuted);
  const additionalQueriesExecuted = new Set(
    [...queriesExecuted].filter((id) => additionalQueryIds.has(id)),
  );

  // ── 1. Evidence completeness ──────────────────────────────────────────
  const baseQueriesTotal = baselineQueryIds.size;
  let baseQueriesWithData = 0;
  for (const [queryId, result] of Object.entries(queryResults.results)) {
    if (
      baselineQueryIds.has(queryId) &&
      result.success &&
      result.data.length > 0
    ) {
      baseQueriesWithData++;
    }
  }
  const baseCoverage =
    baseQueriesTotal > 0 ? baseQueriesWithData / baseQueriesTotal : 0.0;

  const additionalQueriesTotal = additionalQueryIds.size;
  const additionalCoverage =
    additionalQueriesTotal > 0
      ? additionalQueriesExecuted.size / additionalQueriesTotal
      : 0.0;

  // Weighted average using playbook config
  let baseWeight = cc.baseCoverageWeight;
  let additionalWeight = cc.additionalCoverageWeight;
  const totalWeight = baseWeight + additionalWeight;
  if (totalWeight > 0) {
    baseWeight = baseWeight / totalWeight;
    additionalWeight = additionalWeight / totalWeight;
  } else {
    baseWeight = 0.7;
    additionalWeight = 0.3;
  }

  let evidenceCompleteness =
    baseWeight * baseCoverage + additionalWeight * additionalCoverage;

  // Penalty for missing critical evidence
  if (verdict.criticalEvidenceMissing) {
    evidenceCompleteness *= 1.0 - cc.criticalEvidenceMissingPenalty;
  }

  // ── 2. Signal strength ────────────────────────────────────────────────
  let totalRows = 0;
  for (const result of Object.values(queryResults.results)) {
    if (result.success) {
      totalRows += result.data.length;
    }
  }
  let signalStrength = Math.min(1.0, totalRows / 10.0);

  // Bonus for additional queries indicating deeper investigation
  if (additionalQueriesTotal > 0) {
    const bonus = Math.min(
      cc.additionalQueryBonusMax,
      (additionalQueriesExecuted.size / additionalQueriesTotal) *
        cc.additionalQueryBonusMax,
    );
    signalStrength = Math.min(1.0, signalStrength + bonus);
  }

  // ── 3. Signal agreement ───────────────────────────────────────────────
  const supportingCount = verdict.supportingEvidence.length;
  const contradictingCount = verdict.contradictingEvidence.length;
  const totalEvidence = supportingCount + contradictingCount;

  let signalAgreement =
    totalEvidence > 0 ? supportingCount / totalEvidence : 0.5;

  if (verdict.hasContradictorySignals) {
    signalAgreement *= 0.5;
  }

  // ── 4. Data quality ───────────────────────────────────────────────────
  let baseQueriesSuccessful = 0;
  for (const [queryId, result] of Object.entries(queryResults.results)) {
    if (baselineQueryIds.has(queryId) && result.success) {
      baseQueriesSuccessful++;
    }
  }
  const failedQueries = baseQueriesTotal - baseQueriesSuccessful;
  let dataQuality = Math.max(0.0, 1.0 - failedQueries * 0.2);

  // Penalty for empty results
  let emptyResults = 0;
  for (const result of Object.values(queryResults.results)) {
    if (result.success && result.data.length === 0) {
      emptyResults++;
    }
  }
  if (emptyResults > 0 && baseQueriesTotal > 0) {
    const emptyPenalty = Math.min(
      0.3,
      (emptyResults / baseQueriesTotal) * 0.3,
    );
    dataQuality *= 1.0 - emptyPenalty;
  }

  // Penalty for edge cases
  if (verdict.isEdgeCase) {
    dataQuality *= 0.8;
  }

  // ── Compute C_ground ──────────────────────────────────────────────────
  let cGround =
    cc.evidenceCompletenessWeight * evidenceCompleteness +
    cc.signalStrengthWeight * signalStrength +
    cc.signalAgreementWeight * signalAgreement +
    cc.dataQualityWeight * dataQuality;
  cGround = clamp(cGround, 0.0, 1.0);

  // ── Apply formula: C_final = C_ground * (1 - alpha * u_llm) ──────────
  let cFinal = cGround * (1.0 - alpha * uLlm);
  cFinal = clamp(cFinal, 0.0, 1.0);

  // Bucket into 1–5 scale
  const cFinal1To5 = 1 + Math.min(4, Math.floor(cFinal * 5));

  return {
    confidenceScore0To1: round4(cFinal),
    confidenceScore1To5: cFinal1To5,
    cGround: round4(cGround),
    uLlm: round4(uLlm),
    alpha,
    evidenceCompleteness: round4(evidenceCompleteness),
    signalStrength: round4(signalStrength),
    signalAgreement: round4(signalAgreement),
    dataQuality: round4(dataQuality),
    baseCoverage: round4(baseCoverage),
    additionalCoverage: round4(additionalCoverage),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
