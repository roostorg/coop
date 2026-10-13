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

## Changelog entries

Coop uses [Changie](https://changie.dev/) to collect entries in `.changes/unreleased/`.

For a notable change, run this from the repository root:

```bash
pnpm run changie new
```

Write a concise, user-facing summary in the body. The CLI also prompts for one or more comma-separated PR numbers and GitHub usernames. Commit the generated YAML fragment with the change.

Do not edit `CHANGELOG.md` directly. Internal refactors, tests, CI changes, and other changes with no notable impact on deployers do not need fragments.

## Creating a release

Before cutting a release, ensure:

- [ ] **CI is passing** for the `main` branch
- [ ] **You understand the correct version** according to SemVer
- [ ] **Pending fragments in `.changes/unreleased/` cover the notable changes**
- [ ] **Every fragment has `custom.pr` filled in**; it can be blank when created, but batching requires it.

Prepare the changelog in a release PR. Replace `x.y.z` with the chosen version:

```bash
pnpm run changie batch x.y.z
pnpm run changie merge
```

`batch` creates `.changes/x.y.z.md` and deletes the consumed fragments. Review that version file and edit it if needed, then run `merge` again. `merge` generates `CHANGELOG.md`; neither command publishes a release or changes package versions.

Commit the new version file, deleted fragments, and generated changelog. Merge the release PR before creating the release tag.

Then:

1. In GitHub: **Releases** → **Draft a new release**
2. **Create a tag** in SemVer format `x.y.z` from the `main` branch
3. **Draft the release notes**, starting from [CHANGELOG.md](https://github.com/roostorg/coop/blob/main/CHANGELOG.md)
4. Check **Create a discussion for this release** for at least major and minor releases
5. **Publish** the release

Publishing a release triggers automations:

- **Docker images**: builds and pushes version-tagged Docker images for `coop-server`, `coop-worker`, `coop-client`, and `coop-migrations`
- **Docs**: adds a folder for the release to the [index](https://roostorg.github.io/coop/) with a snapshot of the docs
