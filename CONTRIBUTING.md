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

Scopes are optional. Use a component name such as `client`, `server`, or `api`. Write a concise, imperative description after the colon and space. Start the description with a lowercase word and do not end it with a period. Do not add leading or trailing whitespace. GitHub-generated revert titles such as `Revert "feat: add review queues"` are also accepted.

Examples:

```text
feat(client): add review queue filters
fix(server): handle missing item identifiers
docs: explain local development setup
feat(api)!: require a queue identifier
```

For breaking changes, put `!` immediately before the colon and explain the impact and migration steps in the PR description. Preserve that explanation in the squash commit body, preferably with a `BREAKING CHANGE: <explanation>` footer.

CI checks the PR title with [action-semantic-pull-request](https://github.com/amannn/action-semantic-pull-request), including after title edits. Individual work-in-progress commits are not checked and do not need this format.
