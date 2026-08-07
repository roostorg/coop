/**
 * JSON Extractor — Parse and validate structured verdicts from LLM output.
 *
 * Extracts JSON objects from free-form LLM text using balanced brace counting,
 * filters out template/placeholder patterns, and validates against the playbook's
 * output contract schema.
 *
 * @license Apache-2.0
 */

import type { OutputContract, PlaybookVerdict } from './playbookTypes.js';
import {
  jsonStringify,
  tryJsonParse,
} from '../../utils/encoding.js';

// ── Template patterns to filter out ─────────────────────────────────────────

const TEMPLATE_PATTERNS: readonly RegExp[] = [
  /<NPG\s*\|\s*PG\s*\|\s*further\s*review>/i,
  /<≤?\d+\s*words[^>]*>/i,
  /<integer\s+\d+-\d+>/i,
  /\[REQUIRED[^\]]*\]/i,
  /\[if\s+available[^\]]*\]/i,
  /\[note\s+if[^\]]*\]/i,
  /\[list\s+all[^\]]*\]/i,
  /\[yes\/no[^\]]*\]/i,
  /\[MUST\s+include[^\]]*\]/i,
  /\[calculate\s+in[^\]]*\]/i,
  /\[provide\s+detailed[^\]]*\]/i,
  /\[Must\s+be\s+one\s+of[^\]]*\]/i,
  /\[List\s+ALL[^\]]*\]/i,
  /\[Explain\s+why[^\]]*\]/i,
  /\[Specify\s+what[^\]]*\]/i,
  /\[Note\s+ANY[^\]]*\]/i,
  /\[Highlight\s+any[^\]]*\]/i,
  /\[Flag\s+any[^\]]*\]/i,
];

// ── JSON extraction ─────────────────────────────────────────────────────────

/**
 * Extract all valid JSON objects from free-form text using balanced brace counting.
 *
 * More robust than regex-based extraction — handles nested objects,
 * strings containing braces, and escaped characters.
 */
export function extractJsonObjects(text: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  const textLen = text.length;
  let i = 0;

  while (i < textLen) {
    if (text[i] === '{') {
      const startPos = i;
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;

      while (i < textLen) {
        const char = text[i];
        if (escapeNext) {
          escapeNext = false;
        } else if (char === '\\') {
          escapeNext = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              const jsonStr = text.slice(startPos, i + 1);
              const parsed = tryJsonParse(jsonStr);
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                objects.push(parsed);
              }
              break;
            }
          }
        }
        i++;
      }
    } else {
      i++;
    }
  }

  return objects;
}

/**
 * Check whether a JSON object looks like an unfilled template.
 */
function isTemplate(obj: Record<string, unknown>): boolean {
  const jsonStr = jsonStringify(obj);
  return TEMPLATE_PATTERNS.some((pattern) => pattern.test(jsonStr));
}

// ── Verdict extraction ──────────────────────────────────────────────────────

type RawVerdict = {
  verdict: string;
  rationale: string;
  confidence_score: number;
  u_llm?: number;
  ncmec_report_required?: boolean;
  content_removal_required?: boolean;
  queries_executed?: string[];
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
  critical_evidence_missing?: boolean;
  has_contradictory_signals?: boolean;
  is_edge_case?: boolean;
};

/**
 * Extract a PlaybookVerdict from the raw JSON, handling both
 * FINAL_VERDICT wrapper and direct root-level fields.
 */
function extractVerdictFromJson(
  json: Record<string, unknown>,
): RawVerdict | undefined {
  // Prefer FINAL_VERDICT wrapper
  const nested = json['FINAL_VERDICT'];
  const source =
    typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>)
      : json;

  const verdict = source['verdict'];
  const rationale = source['rationale'];
  const confidenceScore = source['confidence_score'];

  if (typeof verdict !== 'string' || typeof rationale !== 'string') {
    return undefined;
  }
  if (typeof confidenceScore !== 'number') {
    return undefined;
  }

  return {
    verdict,
    rationale,
    confidence_score: confidenceScore,
    u_llm:
      typeof source['u_llm'] === 'number' ? source['u_llm'] : undefined,
    ncmec_report_required:
      typeof source['ncmec_report_required'] === 'boolean'
        ? source['ncmec_report_required']
        : undefined,
    content_removal_required:
      typeof source['content_removal_required'] === 'boolean'
        ? source['content_removal_required']
        : undefined,
    queries_executed: Array.isArray(source['queries_executed'])
      ? (source['queries_executed'] as string[])
      : undefined,
    supporting_evidence: Array.isArray(source['supporting_evidence'])
      ? (source['supporting_evidence'] as string[])
      : undefined,
    contradicting_evidence: Array.isArray(source['contradicting_evidence'])
      ? (source['contradicting_evidence'] as string[])
      : undefined,
    critical_evidence_missing:
      typeof source['critical_evidence_missing'] === 'boolean'
        ? source['critical_evidence_missing']
        : undefined,
    has_contradictory_signals:
      typeof source['has_contradictory_signals'] === 'boolean'
        ? source['has_contradictory_signals']
        : undefined,
    is_edge_case:
      typeof source['is_edge_case'] === 'boolean'
        ? source['is_edge_case']
        : undefined,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that a verdict contains all required fields from the output contract.
 */
export function validateAgainstContract(
  json: Record<string, unknown>,
  contract: OutputContract,
): string[] {
  const errors: string[] = [];
  // Check in both the root and FINAL_VERDICT wrapper
  const nested = json['FINAL_VERDICT'];
  const source =
    typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>)
      : json;

  for (const field of contract.requiredFields) {
    if (!(field in source)) {
      errors.push(`Missing required field: '${field}'`);
    }
  }
  return errors;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract the last valid, non-template verdict JSON from LLM output text.
 *
 * Returns the parsed PlaybookVerdict or undefined if no valid verdict is found.
 */
export function extractVerdict(
  text: string,
  contract?: OutputContract,
): PlaybookVerdict | undefined {
  const jsonObjects = extractJsonObjects(text);

  // Filter out templates, validate, and prefer the last valid object
  const candidates: PlaybookVerdict[] = [];

  for (const obj of jsonObjects) {
    if (isTemplate(obj)) continue;

    // Validate against output contract if provided
    if (contract) {
      const contractErrors = validateAgainstContract(obj, contract);
      if (contractErrors.length > 0) continue;
    }

    const raw = extractVerdictFromJson(obj);
    if (!raw) continue;

    candidates.push({
      verdict: raw.verdict,
      rationale: raw.rationale,
      confidenceScore: raw.confidence_score,
      uLlm: raw.u_llm ?? 0.5,
      ncmecReportRequired: raw.ncmec_report_required,
      contentRemovalRequired: raw.content_removal_required,
      queriesExecuted: raw.queries_executed ?? [],
      supportingEvidence: raw.supporting_evidence ?? [],
      contradictingEvidence: raw.contradicting_evidence ?? [],
      criticalEvidenceMissing: raw.critical_evidence_missing ?? false,
      hasContradictorySignals: raw.has_contradictory_signals ?? false,
      isEdgeCase: raw.is_edge_case,
    });
  }

  // Return the last valid candidate (most recent in the LLM output)
  return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}
