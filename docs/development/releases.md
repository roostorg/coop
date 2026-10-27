# Releases

Coop follows a lightweight release process so downstream users can depend on version tags (e.g. `1.0.1`) instead of commit hashes. The process may evolve as project usage grows. There is currently no fixed release cadence; generally, releases are made when:

- Downstream users need an updated stable version tag,
- Meaningful changes have accumulated and CI is green, and/or
- A [security advisory](https://github.com/roostorg/coop/security/) is addressed

We do not currently backport changes to or release patches for versions other than the latest.

## Versioning

Coop uses [Semantic Versioning (SemVer)](https://semver.org/) following the MAJOR.MINOR.PATCH version format. In brief:

- **Patch releases** (x.y.**Z**): backward-compatible fixes or small improvements
- **Minor releases** (x.**Y**.z): new functionality or substantial improvements; changes to public API are backward-compatible
- **Major releases** (**X**.y.z): backward-incompatible changes to public API, or major feature or user interface overhauls

## Release notes

Contributors describe notable changes in the optional `## Release notes` section of the PR description, using single-line bullet entries without a category heading:

```markdown
- Cancel failed media downloads before retrying.
```

The conventional-commit prefix in the **PR title** selects the category. For example, `fix(media): cancel failed downloads` selects Fixed. Individual commit messages are not used for categorization.

| PR title prefix                                                         | Category   |
| ----------------------------------------------------------------------- | ---------- |
| `feat:`                                                                 | Added      |
| `fix:`                                                                  | Fixed      |
| `deprecate:`                                                            | Deprecated |
| `remove:`                                                               | Removed    |
| `security:`                                                             | Security   |
| Other prefixes, such as `perf:` or `refactor:`, or no recognized prefix | Changed    |

Scopes and breaking-change markers are supported, such as `feat(api)!: change the upload endpoint`. The `deprecate`, `remove`, and `security` types are project conventions. The prefix selects the category, not the final release version; maintainers choose the version when publishing.

Leave the section blank for changes that do not need release notes, regardless of the title prefix. PR and author links are added automatically. Contributors do not edit `CHANGELOG.md` or choose a version bump.

The **Draft release notes** workflow uses Release Drafter's Autolabeler to manage the `has-release-notes` label from the description, including on fork PRs. A nonempty bullet includes the PR. Missing, whitespace-only, comment-only, and empty template notes are excluded. Reviewers check the notes' format and the PR title; there is no format-validation check. Clearing the notes removes the label. Category labels are not needed.

After a PR merges, Release Drafter refreshes the draft in [GitHub Releases](https://github.com/roostorg/coop/releases). Editing a merged PR's title or description also refreshes the draft. Manual edits to the draft can be overwritten; make persistent corrections in the source PR. Use **Actions → Draft release notes → Run workflow** to refresh the draft manually. The workflow includes the two pending entries for PRs #1432 and #1470 only while the previous release is 1.2.0.

GitHub Releases is the source of truth for published release notes. To correct published notes, edit the GitHub release. `CHANGELOG.md` contains the release history through 1.2.0 and does not receive new entries.

The workflow uses the repository's `GITHUB_TOKEN` and does not check out contributor code. Release Drafter reads its configuration from the default branch and treats PR descriptions as data. Autolabeler manages only the release-note labels. Publishing remains a maintainer action (`publish: false`).

## Creating a release

Before cutting a release, ensure:

- [ ] **CI is passing** for the `main` branch
- [ ] **You understand the correct version** according to SemVer
- [ ] **The draft release notes include all notable changes**

Then:

1. Open the draft in **GitHub → Releases** and review its notes. Release Drafter's proposed version is a suggestion; choose the correct version according to SemVer.
2. Set the tag to `x.y.z` (no `v` prefix), confirm the target commit on `main`, and title the release `Coop x.y.z`.
3. Check **Create a discussion for this release** for at least major and minor releases.
4. **Publish** the release.
5. Confirm the **Publish Docker images** workflow succeeds and the version-tagged images exist.

Publishing a release triggers automations:

- **Docker images**: builds and pushes version-tagged Docker images for `coop-server`, `coop-worker`, `coop-client`, and `coop-migrations`
- **Docs**: adds a folder for the release to the [index](https://roostorg.github.io/coop/) with a snapshot of the docs

`@roostorg/coop-types` and `@roostorg/db-migrator` are not released this way; they publish to npm from `main` whenever `types/**` or `migrator/**` changes.
