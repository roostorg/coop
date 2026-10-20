const title = process.argv[2] ?? '';
const pattern =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^()\s]+\))?!?: \S[^\r\n]*$/u;

if (title !== title.trim() || !pattern.test(title)) {
  console.error(
    'PR titles must use <type>[optional scope][!]: <description>.\n' +
      'Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.\n' +
      'Example: fix(client): handle empty review queues\n' +
      'See CONTRIBUTING.md for title and breaking-change guidance.',
  );
  process.exit(1);
}

console.log('PR title follows Conventional Commits.');
