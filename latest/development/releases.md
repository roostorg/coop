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

## Creating a release

Before cutting a release, ensure:

- [ ] **CI is passing** for the `main` branch
- [ ] **You understand the correct version** according to SemVer
- [ ] **[CHANGELOG.md](https://github.com/roostorg/coop/blob/main/CHANGELOG.md) is up-to-date**

Then:

1. In a PR, replace `## [Unreleased]` in `CHANGELOG.md` with `## [x.y.z] - YYYY-MM-DD`, leaving an empty `## [Unreleased]`, and update the compare links at the bottom of the file. Remove related issue links (e.g. `closes [#456](...)`) from entries, preserving the PR and contributor links. Merge it before continuing to the next step.
2. In GitHub: **Releases** → **Draft a new release**
3. **Create a tag** in SemVer format `x.y.z` (no `v` prefix) from the `main` branch, at or after the changelog PR's merge commit
4. Title the release `Coop x.y.z` and **draft the release notes**, starting from [CHANGELOG.md](https://github.com/roostorg/coop/blob/main/CHANGELOG.md)
5. Check **Create a discussion for this release** for at least major and minor releases
6. **Publish** the release
7. Confirm the **Publish Docker images** workflow run for the tag succeeds and the version-tagged images exist

Publishing a release triggers automations:

- **Docker images**: builds and pushes version-tagged Docker images for `coop-server`, `coop-worker`, `coop-client`, and `coop-migrations`
- **Docs**: adds a folder for the release to the [index](https://roostorg.github.io/coop/) with a snapshot of the docs

`@roostorg/coop-types` and `@roostorg/db-migrator` are not released this way; they publish to npm from `main` whenever `types/**` or `migrator/**` changes.
