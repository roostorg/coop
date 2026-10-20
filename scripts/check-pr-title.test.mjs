import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('./check-pr-title.mjs', import.meta.url);

test('accepts conventional PR titles with optional scopes and breaking markers', () => {
  for (const title of [
    'feat: add queue filters',
    'fix(client): handle empty review queues',
    'docs: explain local setup',
    'style: format resolver files',
    'refactor(server): simplify rule evaluation',
    'perf: batch item lookups',
    'test: cover report pagination',
    'build(deps): update dependencies',
    'ci: validate PR titles',
    'chore: tidy repository metadata',
    'revert: undo queue filter changes',
    'feat!: require a queue identifier',
    'fix(api)!: reject ambiguous item identifiers',
    'fix: handle Unicode labels such as café',
    'fix: handle `quotes`, "strings", and $(expressions)',
  ]) {
    const result = spawnSync(process.execPath, [script.pathname, title], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${title}: ${result.stderr}`);
  }
});

test('rejects missing or malformed titles with actionable guidance', () => {
  for (const title of [
    undefined,
    '',
    'Add queue filters',
    'feature: add queue filters',
    'Feat: add queue filters',
    'fix:add queue filters',
    'fix:  add queue filters',
    'fix: ',
    'fix(): add queue filters',
    'fix(review queue): add queue filters',
    'fix((client)): add queue filters',
    'fix!(client): add queue filters',
    'fix!!: add queue filters',
    ' fix: add queue filters',
    'fix: add queue filters ',
    'fix: add queue filters\n',
    'fix: add\nqueue filters',
    'fix: add\rqueue filters',
  ]) {
    const result = spawnSync(
      process.execPath,
      [script.pathname, ...(title === undefined ? [] : [title])],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1, String(title));
    assert.match(result.stderr, /See CONTRIBUTING\.md/u);
  }
});
