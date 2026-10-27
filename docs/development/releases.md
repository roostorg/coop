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

Contributors describe notable changes in the optional `## Release notes` section of the PR description, using one category and single-line bullet entries:

```markdown
### Fixed

- Cancel failed media downloads before retrying.
```

The categories are Added, Changed, Deprecated, Removed, Fixed, and Security. Leave the section blank for changes that do not need release notes. PR and author links are added automatically. Contributors do not edit `CHANGELOG.md` or choose a version bump.

The **Check release notes** workflow validates the format, including on fork PRs. The **Draft release notes** workflow manages inclusion and category labels from the description. Missing, whitespace-only, comment-only, and empty template notes are excluded. Nonblank malformed notes fail validation and are excluded until corrected.

After a PR merges, Release Drafter refreshes the draft in [GitHub Releases](https://github.com/roostorg/coop/releases). Editing a merged PR's description also refreshes the draft. Manual edits to the draft can be overwritten; make persistent corrections in the source PR description. Use **Actions → Draft release notes → Run workflow** to refresh the draft manually. The workflow includes the two pending entries for PRs #1432 and #1470 only while the previous release is 1.2.0.

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
6. Close and reopen the automated **Update changelog for Coop x.y.z** PR to trigger PR checks. Review and merge it after checks pass. Add a description in your own words if needed.

Publishing a release triggers automations:

- **Docker images**: builds and pushes version-tagged Docker images for `coop-server`, `coop-worker`, `coop-client`, and `coop-migrations`
- **Docs**: adds a folder for the release to the [index](https://roostorg.github.io/coop/) with a snapshot of the docs
- **Changelog**: opens a PR that copies the published notes and publication date into `CHANGELOG.md` and adds the comparison link. The file contains published releases only. The release tag does not include its own changelog entry because that entry merges afterward.

`@roostorg/coop-types` and `@roostorg/db-migrator` are not released this way; they publish to npm from `main` whenever `types/**` or `migrator/**` changes.

Editing a published stable release refreshes its changelog PR, or opens a correction PR if the original PR is merged. Reruns do not duplicate release sections. Prereleases do not create changelog PRs. New stable releases must be added in version order; merge the previous changelog PR before publishing another release.

## Repository setup

Enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. The changelog workflow uses the repository's `GITHUB_TOKEN`; no contributor token is needed. PRs opened or updated with that token do not automatically trigger `pull_request` workflows. After each bot update, close and reopen the PR as a maintainer to run the checks on its latest commit.

The privileged PR workflow checks out only `main`, never a fork's code. It reads PR descriptions as data and manages only the release-note labels. Release Drafter has permission to update drafts but the workflow sets `publish: false`; publishing remains a maintainer action.
