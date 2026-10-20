# Contributing to Coop

Follow the [ROOST contribution guidelines](https://github.com/roostorg/.github/blob/main/CONTRIBUTING.md). For nontrivial changes, start with an issue and link it in your pull request. Keep changes focused and small enough to review.

See the [development guide](docs/development/README.md) for setup and testing.

## Pull requests and commit messages

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope][!]: <description>
```

Use a lowercase type from this list:

| Type       | Purpose                                     |
| ---------- | ------------------------------------------- |
| `feat`     | Add a feature                               |
| `fix`      | Fix a bug                                   |
| `docs`     | Change documentation                        |
| `style`    | Change formatting without changing behavior |
| `refactor` | Restructure code without changing behavior  |
| `perf`     | Improve performance                         |
| `test`     | Add or update tests                         |
| `build`    | Change dependencies or build tooling        |
| `ci`       | Change CI configuration                     |
| `chore`    | Perform other maintenance                   |
| `revert`   | Revert a change                             |

Scopes are optional. Use a component name such as `client`, `server`, or `api`, without whitespace or parentheses. Write a concise, imperative description after exactly one space. Titles must occupy one line without leading or trailing whitespace.

Examples:

```text
feat(client): add review queue filters
fix(server): handle missing item identifiers
docs: explain local development setup
feat(api)!: require a queue identifier
```

For breaking changes, put `!` immediately before the colon and explain the impact and migration steps in the PR description. Preserve that explanation in the squash commit body, preferably with a `BREAKING CHANGE: <explanation>` footer.

CI checks the PR title, including after title edits. Individual work-in-progress commits are not checked and do not need this format. To validate a title locally:

```sh
node scripts/check-pr-title.mjs 'fix(client): handle empty review queues'
```

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Explain the change and its motivation, link the related issue, and describe your testing. Include screenshots for visual changes and a rollout plan when deployment needs special steps. Complete the checklist items that apply.

Update `CHANGELOG.md` under `Unreleased` for notable changes that affect people deploying Coop. Follow its Keep a Changelog categories and existing entry format. Changelog generation is manual; a conventional title does not replace a required changelog entry.

## Maintainer configuration

To enforce this convention in merged history, configure the target repository:

1. Enable squash merging and disable merge commits and rebase merging under **Settings → General → Pull Requests**.
2. Set the default squash commit message to **Pull request title**.
3. Add **Check PR title** as a required status check in the ruleset or branch protection rule for `main`.

Squash-merge each PR with its validated title as the commit subject. Preserve the conventional prefix when editing the merge message. CI validates PR titles, not the final message edited by a maintainer.
