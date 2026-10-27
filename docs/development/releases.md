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
