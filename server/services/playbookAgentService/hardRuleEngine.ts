/**
 * Hard Rule Engine — Deterministic rules evaluated before the LLM.
 *
 * Hard rules provide guardrails for critical cases that must never be left
 * to probabilistic reasoning. When a hard rule fires, its outcome is locked
 * and the LLM verdict cannot override it.
 *
 * Example: A known CSAM series hash match always results in REPORT_AND_REMOVE,
 * regardless of what the LLM produces.
 *
 * @license Apache-2.0
 */

import type { HardRule, QueryResult } from './playbookTypes.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type HardRuleMatch = {
  readonly ruleId: string;
  readonly outcome: string;
  readonly bypassLlm: boolean;
  readonly matchedCondition: string;
  readonly matchedValue: unknown;
};

// ── Expression evaluation ───────────────────────────────────────────────────

/**
 * Evaluate a hard rule condition against query results.
 *
 * Conditions use a simple dot-path expression format:
 *   "catalog_id.field_name == 'VALUE'"
 *   "catalog_id.field_name >= 3"
 *   "catalog_id.field_name != null"
 *
 * The left side is a dot-path into the query results (catalog_id.column).
 * The right side is a literal value (string, number, boolean, null).
 */
function evaluateCondition(
  condition: string,
  queryResults: Readonly<Record<string, QueryResult | undefined>>,
): { readonly matched: boolean; readonly matchedValue: unknown } {
  // Parse condition: "catalog_id.field == 'VALUE'"
  const match = condition.match(
    /^(\w+)\.(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/,
  );
  if (!match) {
    return { matched: false, matchedValue: undefined };
  }

  const [, catalogId, fieldName, operator, rawExpected] = match;
  const result = queryResults[catalogId];

  if (!result?.success || result.data.length === 0) {
    return { matched: false, matchedValue: undefined };
  }

  // Parse the expected value
  const expected = parseExpectedValue(rawExpected.trim());

  // Check if ANY row in the result matches
  for (const row of result.data) {
    const actual = row[fieldName];
    if (compare(actual, operator, expected)) {
      return { matched: true, matchedValue: actual };
    }
  }

  return { matched: false, matchedValue: undefined };
}

function parseExpectedValue(raw: string): unknown {
  // String literal: 'VALUE' or "VALUE"
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    return raw.slice(1, -1);
  }
  // null
  if (raw === 'null') return null;
  // boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // number
  const num = Number(raw);
  if (!Number.isNaN(num)) return num;
  // fallback to string
  return raw;
}

function compare(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    default:
      return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate all hard rules against query results.
 *
 * Returns the first matching rule (rules are evaluated in order).
 * If no rule matches, returns undefined and the LLM verdict is used.
 */
export function evaluateHardRules(
  hardRules: readonly HardRule[],
  queryResults: Readonly<Record<string, QueryResult | undefined>>,
): HardRuleMatch | undefined {
  for (const rule of hardRules) {
    const { matched, matchedValue } = evaluateCondition(
      rule.condition,
      queryResults,
    );
    if (matched) {
      return {
        ruleId: rule.ruleId,
        outcome: rule.outcome,
        bypassLlm: rule.bypassLlm,
        matchedCondition: rule.condition,
        matchedValue,
      };
    }
  }
  return undefined;
}
