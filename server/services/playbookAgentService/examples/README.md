# Dummy CSAM Triage Example

This directory defines a concrete sample for the Playbook Agent backend. It is
not wired into the product UI yet; it documents the contract that a future MRT
or Investigation UI can render.

## Files

- `dummy_csam_triage.playbook.json`: authored playbook config in the same
  snake_case shape a YAML playbook would use.
- `dummy_csam_triage.evidence.json`: sample pre-approved evidence query request
  and result.
- `dummy_csam_triage.result.json`: representative backend result after the
  playbook runner applies hard rules and confidence scoring.

## Backend Flow

1. Queue `dummy-queue` maps to playbook `dummy_csam_triage`.
2. The runner executes baseline catalog query `hash_match_history@1.0.0`.
3. Evidence returns `severity_tier: CRITICAL`.
4. Hard rule `known_critical_hash` locks the verdict to
   `REPORT_AND_REMOVE`.
5. The LLM can still provide rationale, but it cannot override the hard-rule
   verdict.
6. The confidence engine returns a grounded score and stores `verdict` and
   `confidence` artifacts.

## UI Target

A future UI panel should be able to render the expected result like this:

```text
Playbook Investigation

Verdict      REPORT_AND_REMOVE
Confidence   4/5 (0.713)
Hard rule    known_critical_hash

Evidence
- hash_match_history@1.0.0
  - severity_tier: CRITICAL
  - total_matches: 1

Rationale
The model tried to choose NO_ACTION, but the hard rule should override this
verdict.

Audit artifacts
- verdict
- confidence
```

The important behavior is that the deterministic hard rule wins over the LLM
verdict while still preserving the LLM rationale and grounded confidence
breakdown for review.
