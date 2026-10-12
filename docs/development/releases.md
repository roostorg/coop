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

Coop uses [Changie](https://changie.dev/) to collect entries in `.changes/unreleased/`. `npm ci` at the repository root installs the CLI; Python and Go are not required.

For a notable change, run this from the repository root:

```bash
npm run changie -- new
```

Choose `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`. Write only a concise, user-facing summary in the body. The CLI also prompts for the PR number and one or more comma-separated GitHub usernames.

The fragment stores attribution separately:

```yaml
kind: Fixed
body: Description
time: 2026-10-12T12:00:00Z
custom:
  pr: '123'
  authors: alice, bob
```

Changie generates the PR link and all author links when batching. Spaces around usernames and leading `@` signs are accepted. Authors are required; if the PR is not open yet, leave its number blank and fill `custom.pr` before release preparation. Batching fails if the PR is missing or an author entry is empty.

For non-interactive use with multiple authors, CSV-quote the whole authors argument so Changie does not treat its commas as separate custom fields:

```bash
npm run changie -- new --kind Fixed --body 'Description' \
  --custom pr=123 --custom '"authors=alice,bob"' --interactive=false
```

Commit the generated YAML fragment with the change. Its filename is generated automatically, so a PR number is not needed to create the file.

Do not edit `CHANGELOG.md` directly or batch fragments in ordinary PRs. Internal refactors, tests, CI changes, and other changes with no notable impact on deployers do not need fragments.

## Creating a release

Before cutting a release, ensure:

- [ ] **CI is passing** for the `main` branch
- [ ] **You understand the correct version** according to SemVer
- [ ] **Pending fragments in `.changes/unreleased/` cover the notable changes**

Prepare the changelog in a release PR. Replace `x.y.z` with the chosen version:

```bash
npm ci
npm run changie -- batch x.y.z
npm run changie -- merge
```

`batch` creates `.changes/x.y.z.md` and deletes the consumed fragments. Review that version file and edit it if needed, then run `merge` again. `merge` generates `CHANGELOG.md`; neither command publishes a release or changes package versions.

Commit the new version file, deleted fragments, and generated changelog. Merge the release PR before creating the release tag. Released notes in `.changes/` are immutable; corrections belong in new fragments. `.changes/1.1.1.md` contains the release history through 1.1.1.

Then:

1. In GitHub: **Releases** → **Draft a new release**
2. **Create a tag** in SemVer format `x.y.z` from the `main` branch
3. **Draft the release notes**, starting from [CHANGELOG.md](https://github.com/roostorg/coop/blob/main/CHANGELOG.md)
4. Check **Create a discussion for this release** for at least major and minor releases
5. **Publish** the release

Publishing a release triggers automations:

- **Docker images**: builds and pushes version-tagged Docker images for `coop-server`, `coop-worker`, `coop-client`, and `coop-migrations`
- **Docs**: adds a folder for the release to the [index](https://roostorg.github.io/coop/) with a snapshot of the docs
