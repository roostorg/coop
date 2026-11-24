import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(
  new URL('./release-drafter.yml', import.meta.url),
  'utf8',
);
const [, source, flags] = config.match(
  /labels: \[has-release-notes\]\s+body:\s+- '\/(.+)\/([a-z]+)'/,
);
const matcher = new RegExp(source, flags);
const template = readFileSync(
  new URL('./PULL_REQUEST_TEMPLATE.md', import.meta.url),
  'utf8',
);
const botSummary =
  '\n<!-- Bot summary -->\n---\n## Summary\nUnrelated summary.\n';

test('an empty release notes section does not pick up a bot summary after the checklist', () => {
  assert.equal(matcher.test(template + botSummary), false);
});

test('plain text and bulleted release notes after the template comment match', () => {
  for (const notes of [
    'Improve worker shutdown.',
    '- Improve worker shutdown.',
  ]) {
    const body = template.replace('## Checklist', `${notes}\n\n## Checklist`);
    assert.equal(matcher.test(body + botSummary), true);
  }
});
