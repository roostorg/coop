import { evaluateHardRules } from './hardRuleEngine.js';
import type { HardRule, QueryResult } from './playbookTypes.js';

function makeResult(
  data: Record<string, unknown>[],
  success = true,
): QueryResult {
  return { success, data };
}

describe('evaluateHardRules', () => {
  const rules: HardRule[] = [
    {
      ruleId: 'auto_report_critical',
      description: 'Auto-report on known CSAM series',
      condition: "hash_match_history.severity_tier == 'CRITICAL'",
      outcome: 'REPORT_AND_REMOVE',
      bypassLlm: true,
    },
    {
      ruleId: 'escalate_high_count',
      description: 'Escalate when many matches',
      condition: 'hash_match_history.total_matches >= 5',
      outcome: 'ESCALATE_FOR_REVIEW',
      bypassLlm: false,
    },
  ];

  it('returns first matching rule', () => {
    const queryResults = {
      hash_match_history: makeResult([
        { severity_tier: 'CRITICAL', total_matches: 10 },
      ]),
    };

    const match = evaluateHardRules(rules, queryResults);
    expect(match).toBeDefined();
    expect(match!.ruleId).toBe('auto_report_critical');
    expect(match!.outcome).toBe('REPORT_AND_REMOVE');
    expect(match!.bypassLlm).toBe(true);
    expect(match!.matchedValue).toBe('CRITICAL');
  });

  it('returns second rule when first does not match', () => {
    const queryResults = {
      hash_match_history: makeResult([
        { severity_tier: 'HIGH', total_matches: 7 },
      ]),
    };

    const match = evaluateHardRules(rules, queryResults);
    expect(match).toBeDefined();
    expect(match!.ruleId).toBe('escalate_high_count');
    expect(match!.outcome).toBe('ESCALATE_FOR_REVIEW');
  });

  it('returns undefined when no rules match', () => {
    const queryResults = {
      hash_match_history: makeResult([
        { severity_tier: 'LOW', total_matches: 1 },
      ]),
    };

    const match = evaluateHardRules(rules, queryResults);
    expect(match).toBeUndefined();
  });

  it('handles missing query results gracefully', () => {
    const match = evaluateHardRules(rules, {});
    expect(match).toBeUndefined();
  });

  it('handles failed queries gracefully', () => {
    const queryResults = {
      hash_match_history: makeResult([], false),
    };

    const match = evaluateHardRules(rules, queryResults);
    expect(match).toBeUndefined();
  });

  it('matches across any row in the result set', () => {
    const queryResults = {
      hash_match_history: makeResult([
        { severity_tier: 'LOW', total_matches: 1 },
        { severity_tier: 'CRITICAL', total_matches: 1 },
      ]),
    };

    const match = evaluateHardRules(rules, queryResults);
    expect(match).toBeDefined();
    expect(match!.ruleId).toBe('auto_report_critical');
  });

  it('handles != operator', () => {
    const notNullRule: HardRule[] = [
      {
        ruleId: 'not_null_check',
        description: 'Check field is not null',
        condition: "data.status != 'inactive'",
        outcome: 'FLAG',
        bypassLlm: false,
      },
    ];

    const queryResults = {
      data: makeResult([{ status: 'active' }]),
    };

    const match = evaluateHardRules(notNullRule, queryResults);
    expect(match).toBeDefined();
    expect(match!.ruleId).toBe('not_null_check');
  });

  it('returns undefined for empty rules', () => {
    const match = evaluateHardRules([], { some_query: makeResult([{ a: 1 }]) });
    expect(match).toBeUndefined();
  });
});
