import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const categories = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
];

export function parseReleaseNotes(body = '') {
  const lines = (body ?? '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const notes = [];
  let inSection = false;
  let fence;
  for (const line of lines) {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (
        delimiter[1][0] === fence[0] &&
        delimiter[1].length >= fence.length
      )
        fence = undefined;
    }
    if (!fence && !delimiter) {
      const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading && heading[1].length <= 2) {
        if (inSection) break;
        inSection = heading[1] === '##' && heading[2] === 'Release notes';
        continue;
      }
    }
    if (inSection) notes.push(line);
  }

  const content = notes.map((line) => line.trim()).filter(Boolean);
  if (content.every((line) => /^###\s+/.test(line) || /^[-*]\s*$/.test(line)))
    return null;
  const category = content.shift()?.match(/^### (\w+)$/)?.[1];
  if (
    !categories.includes(category) ||
    content.some((line) => !/^[-*] \S/.test(line))
  )
    throw new Error(
      'Release notes must contain one category heading (Added, Changed, Deprecated, Removed, Fixed, or Security), followed by one-line bullet entries. Leave the section blank to omit it.',
    );
  return { category, entries: content.map((line) => line.slice(2)) };
}

export function updateChangelog(changelog, release, repository) {
  if (!/^\d+\.\d+\.\d+$/.test(release.tag_name))
    throw new Error('Only stable x.y.z releases can be added to CHANGELOG.md.');
  if (!release.body?.trim())
    throw new Error('Published release notes are empty.');
  if (!release.published_at) throw new Error('The release must be published.');

  const firstRelease = changelog.search(/^## \[/m);
  if (firstRelease === -1)
    throw new Error('CHANGELOG.md has no release sections.');
  const version = release.tag_name;
  const date = release.published_at.slice(0, 10);
  const section = `## [${version}] - ${date}\n\n${release.body.trim()}\n\n`;
  const existing = new RegExp(
    `^## \\[${version.replaceAll('.', '\\.')}\\].*\\n`,
    'm',
  );
  const match = existing.exec(changelog);
  if (match) {
    const start = match.index;
    const remaining = changelog.slice(start + match[0].length);
    const end = remaining.search(/^## \[|^\[[^\]]+\]: /m);
    return (
      changelog.slice(0, start) +
      section +
      (end === -1 ? '' : remaining.slice(end))
    );
  }

  const previous = changelog.slice(firstRelease).match(/^## \[([^\]]+)\]/)?.[1];
  // Older releases need their own compare-link insertion and ordering decision.
  if (previous.localeCompare(version, 'en', { numeric: true }) >= 0)
    throw new Error(
      'A new changelog entry must be newer than the latest entry.',
    );
  const links = changelog.search(/^\[[^\]]+\]: /m);
  if (links === -1) throw new Error('CHANGELOG.md has no comparison links.');
  const link = `[${version}]: https://github.com/${repository}/compare/${previous}...${version}\n`;
  return (
    changelog.slice(0, firstRelease) +
    section +
    changelog.slice(firstRelease, links) +
    link +
    changelog.slice(links)
  );
}

function api(path, method = 'GET', data) {
  return JSON.parse(
    execFileSync(
      'gh',
      ['api', path, '--method', method, ...(data ? ['--input', '-'] : [])],
      { encoding: 'utf8', input: data ? JSON.stringify(data) : undefined },
    ) || 'null',
  );
}

function syncLabels(repository, number) {
  const pr = api(`repos/${repository}/pulls/${number}`);
  let notes;
  let validationError;
  try {
    notes = parseReleaseNotes(pr.body);
  } catch (error) {
    validationError = error;
  }
  const managed = [
    'has-release-notes',
    ...categories.map((category) => `release:${category.toLowerCase()}`),
  ];
  const wanted = notes
    ? ['has-release-notes', `release:${notes.category.toLowerCase()}`]
    : [];
  for (const label of wanted) {
    execFileSync('gh', [
      'label',
      'create',
      label,
      '--repo',
      repository,
      '--color',
      '5319e7',
      '--force',
    ]);
  }
  if (wanted.length)
    api(`repos/${repository}/issues/${number}/labels`, 'POST', {
      labels: wanted,
    });
  for (const { name } of pr.labels) {
    if (managed.includes(name) && !wanted.includes(name))
      api(
        `repos/${repository}/issues/${number}/labels/${encodeURIComponent(name)}`,
        'DELETE',
      );
  }
  // The read-only check reports invalid notes; still refresh the draft to exclude them.
  if (validationError) console.error(validationError.message);
  console.log(
    notes
      ? `Release notes: ${notes.category}`
      : 'No release notes; excluded from the draft.',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY;
  switch (process.argv[2]) {
    case 'check':
      parseReleaseNotes(event.pull_request.body);
      console.log('Release notes are valid (blank notes are allowed).');
      break;
    case 'labels':
      syncLabels(repository, event.pull_request.number);
      break;
    case 'changelog': {
      // Read the current release so an edited-event rerun uses the latest notes.
      const release = api(`repos/${repository}/releases/${event.release.id}`);
      if (release.draft || release.prerelease)
        throw new Error('Expected a published stable release.');
      writeFileSync(
        'CHANGELOG.md',
        updateChangelog(
          readFileSync('CHANGELOG.md', 'utf8'),
          release,
          repository,
        ),
      );
      break;
    }
    default:
      throw new Error('Expected check, labels, or changelog.');
  }
}
