import {
  extractJsonObjects,
  extractVerdict,
  validateAgainstContract,
} from './jsonExtractor.js';
import type { OutputContract } from './playbookTypes.js';

describe('extractJsonObjects', () => {
  it('extracts a single JSON object from text', () => {
    const text = 'Some text before {"verdict": "RISKY", "score": 5} and after';
    const objects = extractJsonObjects(text);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toEqual({ verdict: 'RISKY', score: 5 });
  });

  it('extracts multiple JSON objects', () => {
    const text = '{"a": 1} blah {"b": 2}';
    const objects = extractJsonObjects(text);
    expect(objects).toHaveLength(2);
  });

  it('handles nested JSON objects', () => {
    const text = '{"outer": {"inner": {"deep": true}}, "other": 1}';
    const objects = extractJsonObjects(text);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toEqual({
      outer: { inner: { deep: true } },
      other: 1,
    });
  });

  it('handles strings containing braces', () => {
    const text = '{"message": "use { and } in strings", "ok": true}';
    const objects = extractJsonObjects(text);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toEqual({ message: 'use { and } in strings', ok: true });
  });

  it('skips invalid JSON', () => {
    const text = '{invalid json} {"valid": true}';
    const objects = extractJsonObjects(text);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toEqual({ valid: true });
  });

  it('returns empty array for no JSON', () => {
    const objects = extractJsonObjects('no json here');
    expect(objects).toHaveLength(0);
  });
});

describe('extractVerdict', () => {
  it('extracts verdict from FINAL_VERDICT wrapper', () => {
    const text = `Here is my analysis: {"FINAL_VERDICT": {"verdict": "RISKY", "rationale": "Found issues", "confidence_score": 4, "u_llm": 0.1, "queries_executed": ["q1"], "supporting_evidence": ["e1"], "contradicting_evidence": [], "critical_evidence_missing": false, "has_contradictory_signals": false}}`;

    const verdict = extractVerdict(text);
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('RISKY');
    expect(verdict!.rationale).toBe('Found issues');
    expect(verdict!.confidenceScore).toBe(4);
    expect(verdict!.uLlm).toBe(0.1);
  });

  it('extracts verdict from root-level fields', () => {
    const text = `{"verdict": "SAFE", "rationale": "All clear", "confidence_score": 5, "u_llm": 0.05}`;

    const verdict = extractVerdict(text);
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('SAFE');
    expect(verdict!.uLlm).toBe(0.05);
  });

  it('returns the last valid verdict (most recent)', () => {
    const text = `
      {"verdict": "SAFE", "rationale": "First", "confidence_score": 3}
      Some more analysis...
      {"verdict": "RISKY", "rationale": "Revised", "confidence_score": 4}
    `;

    const verdict = extractVerdict(text);
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('RISKY');
    expect(verdict!.rationale).toBe('Revised');
  });

  it('filters out template patterns', () => {
    const text = `{"verdict": "<NPG | PG | further review>", "rationale": "[REQUIRED]", "confidence_score": 0}`;

    const verdict = extractVerdict(text);
    expect(verdict).toBeUndefined();
  });

  it('defaults u_llm to 0.5 when not provided', () => {
    const text = `{"verdict": "RISKY", "rationale": "test", "confidence_score": 3}`;

    const verdict = extractVerdict(text);
    expect(verdict!.uLlm).toBe(0.5);
  });

  it('returns undefined for empty text', () => {
    expect(extractVerdict('')).toBeUndefined();
  });
});

describe('validateAgainstContract', () => {
  const contract: OutputContract = {
    version: { major: 1, minor: 0, patch: 0 },
    requiredFields: ['verdict', 'rationale', 'confidence_score'],
  };

  it('returns no errors for valid JSON', () => {
    const json = { verdict: 'SAFE', rationale: 'OK', confidence_score: 5 };
    expect(validateAgainstContract(json, contract)).toHaveLength(0);
  });

  it('returns errors for missing fields', () => {
    const json = { verdict: 'SAFE' };
    const errors = validateAgainstContract(json, contract);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('rationale'))).toBe(true);
  });

  it('validates inside FINAL_VERDICT wrapper', () => {
    const json = {
      FINAL_VERDICT: { verdict: 'SAFE', rationale: 'OK', confidence_score: 5 },
    };
    expect(validateAgainstContract(json, contract)).toHaveLength(0);
  });
});
