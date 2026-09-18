import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryJsonParse } from '../../utils/encoding.js';
import { parsePlaybook } from './playbookLoader.js';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), 'examples');

function readExampleJson(filename: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const raw = readFileSync(join(examplesDir, filename), 'utf-8');
  const parsed = tryJsonParse(raw);
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
    throw new Error(`Example '${filename}' must contain a JSON object`);
  }
  return parsed;
}

describe('playbook examples', () => {
  it('keeps the dummy playbook sample parseable', () => {
    const playbook = parsePlaybook(
      readExampleJson('dummy_csam_triage.playbook.json'),
    );

    expect(playbook.useCaseId).toBe('dummy_csam_triage');
    expect(playbook.baselineCatalogRefs).toHaveLength(1);
    expect(playbook.baselineCatalogRefs[0]?.catalogId).toBe(
      'hash_match_history',
    );
    expect(playbook.decisionLogic.hardRules[0]?.ruleId).toBe(
      'known_critical_hash',
    );
  });

  it('keeps the dummy evidence and result samples aligned', () => {
    const evidence = readExampleJson('dummy_csam_triage.evidence.json');
    const result = readExampleJson('dummy_csam_triage.result.json');

    expect(result['hardRuleTriggered']).toBe('known_critical_hash');
    expect(result['queriesExecuted']).toEqual(['hash_match_history']);
    expect(result['artifactTypesStored']).toEqual(['verdict', 'confidence']);

    const query = evidence['query'];
    const verdict = result['verdict'];
    expect(query).toMatchObject({
      catalog_id: 'hash_match_history',
      version: '1.0.0',
    });
    expect(verdict).toMatchObject({
      verdict: 'REPORT_AND_REMOVE',
    });
  });
});
