# Security releases

A security release is a release that ships a fix for a vulnerability in Coop or in one of its dependencies. It follows [Creating a release](releases.md#creating-a-release), with the extra steps on this page for keeping details private, publishing an advisory and notifying adopters. ROOST's overall process is on the [Security](https://community.roost.tools/software-development-practices/security) page of the community repo.

We do not currently backport changes to or release patches for versions other than the latest.

The scope tiers, response targets and communication rules below come from [RFC: Security vulnerability discovery and response process](https://github.com/roostorg/community/issues/119). They are proposals, not commitments, until that RFC is accepted.

| Tier                        | What's in it                                                                                                                             | Response                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Shipped runtime          | Packages and OS libraries in the `coop-server`, `coop-worker`, `coop-client` and `coop-migrations` images, and in `@roostorg/coop-types` | Fix, then a security release                          |
| 2. Pinned dependencies      | Third-party images and versions pinned in `docker-compose.yaml` (e.g. Postgres, ClickHouse, Scylla, Redis)                               | Bump the pin to a fixed version and release           |
| 3. Adopter-managed services | Services adopters run themselves, where Coop only documents supported versions                                                           | Raise the documented minimum version                  |
| 4. Build and CI             | Dev dependencies, build tools, GitHub Actions                                                                                            | Fix in a normal release; review for supply-chain risk |

## Before you start

- [ ] Every vulnerability going into the release has been triaged: the reported one, and every upstream advisory fixed by a dependency update in the release (see [Finding a release's security fixes](#finding-a-releases-security-fixes)). For each, record which released versions ship it, whether it is reachable from Coop's code, whether it is exploitable in the documented default configuration, and whether it is [known exploited](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) or has a high EPSS score. Reproduce it against Coop where feasible.
- [ ] Each reachable vulnerability has a draft [security advisory](https://github.com/roostorg/coop/security/advisories/new), scored for how Coop uses the affected code rather than copied from the upstream score. So does every vulnerability in Coop's own code. Upstream advisories that are not reachable get no Coop advisory; the release notes list them as precautionary updates.
- [ ] You know which path in step 1 applies.

Proposed response targets:

| Situation                                                | Triage          | Fix or mitigate                             |
| -------------------------------------------------------- | --------------- | ------------------------------------------- |
| Critical/high, tier 1 or 2, reachable or known exploited | 1 business day  | 72 hours                                    |
| Critical/high, tier 1 or 2, reachability unclear         | 1 business day  | 7 days                                      |
| Critical/high, tier 3                                    | 2 business days | Update the documented minimum within 7 days |
| Moderate, or tier 4                                      | Weekly          | Next scheduled release                      |
| Low, or not reachable                                    | Weekly          | Dismissed with a reason                     |

Reachability and exploitability details stay in the draft advisory or the private triage queue until the fix is released. Never put them in a public issue, PR, commit message or changelog entry.

The steps run in this order: choose the release base (step 2) before merging anything from a private fork; then merge the fix, publish the release, publish the advisories, and announce.

### Finding a release's security fixes

Security fixes carry the `security` label: Dependabot PRs that fix a published advisory get it automatically, and authors or maintainers add it to manual fixes. To list the fixes merged since the last release:

```bash
LAST=$(gh release view --repo roostorg/coop --json publishedAt --jq .publishedAt)
gh pr list --repo roostorg/coop --state merged --label security --search "merged:>=${LAST%%T*}" --limit 200
```

This depends on the labeling workflow in [#1519](https://github.com/roostorg/coop/pull/1519) and on the `security` label existing ([#1520](https://github.com/roostorg/coop/issues/1520), items 1 and 15). PRs merged before both are in place are not labeled, so also check the unlabeled PRs merged since the last release:

```bash
gh pr list --repo roostorg/coop --state merged --search "merged:>=${LAST%%T*} -label:security" --limit 200 --json number,title
```

For each dependency update, read the release notes or advisories of every package version it changes.

## 1. Prepare the fix

### Undisclosed vulnerability: private fork

Use this path for a vulnerability in Coop's own code, or any issue not yet public.

1. Choose the release base (step 2). On option B, create `release/x.y` first if it does not exist.
2. In the draft advisory, select **Start a temporary private fork**.
3. Clone the fork and open a PR against it with the fix, a regression test, and the version and changelog changes from step 3, so that a single merge makes everything public. Target `main` on option A, or `release/x.y` on option B.
4. GitHub Actions does not run in temporary private forks. Run the [CI checks](https://github.com/roostorg/coop/blob/main/AGENTS.md#ci) locally and record the results in the PR.
5. Once the PR is reviewed, select **Merge pull request** in the advisory. The fix is public from this point, so publish the release (step 4) straight after.

### Public upstream CVE: normal PR

Use this path when the vulnerability is already public, e.g. a CVE in a dependency or base image. Open a normal PR against `main` that bumps the dependency or pin, and add a `### Security` changelog entry for it under `## [Unreleased]`. The PR can name the upstream CVE, but not Coop-specific reachability or exploitability details.

If Dependabot has already opened the bump, use its PR. If its PR groups the security update with other updates, release only the security update (on option B, a separate PR to `release/x.y` that applies the same specifier and version as `main`).

## 2. Choose the release base

If `## [Unreleased]` in `CHANGELOG.md` contains only the fix, release from `main` as usual and skip to step 3.

If `main` has unreleased changes, choose one of the options below. **Pending decision ([#1520](https://github.com/roostorg/coop/issues/1520), item 11):** option B as a standing model is a proposal; until it is decided, agree the base with a maintainer for each release.

**A. Release from `main`.** Ship the fix together with everything already on `main`.

- Uses the existing release process and workflows unchanged.
- The release contains changes that were not planned for release yet. If `## [Unreleased]` has entries under `### Added`, or any backward-incompatible change, the next version is a minor or major release, not a patch, under [Versioning](releases.md#versioning).
- Unreleased migrations and behavior changes reach adopters who only wanted the security fix.

**B. Release from `release/x.y`.** Ship only the fixes as `x.y.(z+1)`, from a release branch kept for the latest minor version.

- Create the branch once per minor version, from its first release tag: `git switch -c release/x.y x.y.0`, then push it to `origin`.
- Fixes land on `main` first, then are cherry-picked to `release/x.y` with `git cherry-pick -x`, one PR per cherry-picked commit. The exception is a private-fork fix, which merges into `release/x.y` directly and is forward-ported to `main` in step 8.
- PR checks run on PRs against `release/x.y`, but `main`'s branch protection rules do not cover it.
- A release runs the workflow files at its tag, so fixes to `.github/workflows/` on `main` must also be cherry-picked to `release/x.y` before they apply to its releases.
- `@roostorg/coop-types` and `@roostorg/db-migrator` only publish from `main` (see step 5), so a fix in `types/` or `migrator/` reaches npm only through `main`. Publishing either package from `release/x.y` would move its npm `latest` backwards; the workflows do not support it, so ask a maintainer.

### Cherry-picking deterministically

Dependency updates usually conflict in `pnpm-lock.yaml`. Resolve them so the branch keeps its own versions of everything except the packages being fixed:

1. Take the branch's lockfile, `git checkout --ours pnpm-lock.yaml`, and its `package.json` versions for anything outside the fix.
2. Set the fixed packages to the same specifier and version as `main`, then run `pnpm install` to update the lockfile for them alone.
3. Run `pnpm install --frozen-lockfile`, and confirm that `pnpm install` leaves `pnpm-lock.yaml` unchanged (`git diff --exit-code pnpm-lock.yaml`).
4. Check that only the intended packages changed versions, e.g. `git diff origin/release/x.y -- pnpm-lock.yaml`.
5. After committing, and before tagging, check that the branch's lockfile has no package newer than `main`'s:

   ```bash
   git fetch origin
   node scripts/check-lockfile-backport.mjs origin/main
   ```

   It reads the committed lockfiles, and exits 1 and lists each package that pnpm resolved to a version newer than `main` has. If it does, redo the conflict resolution from step 1 so those packages keep the branch's versions. If the script is on `main` but not yet on `release/x.y`, run `main`'s copy: `git show origin/main:scripts/check-lockfile-backport.mjs > "$TMPDIR/check-lockfile-backport.mjs" && node "$TMPDIR/check-lockfile-backport.mjs" origin/main`.

The script depends on [#1524](https://github.com/roostorg/coop/pull/1524) ([#1520](https://github.com/roostorg/coop/issues/1520), item 5).

## 3. Bump the version and changelog

Follow step 1 of [Creating a release](releases.md#creating-a-release) with the patch version `x.y.z`, in a PR against the release base from step 2 (on the private fork path, in the fork PR). Each fix goes under `### Security` in the new `## [x.y.z]` section as a single line, in the formats from [`AGENTS.md`](https://github.com/roostorg/coop/blob/main/AGENTS.md#changelog):

```markdown
### Security

- Prevent <impact> ([GHSA-xxxx-xxxx-xxxx](https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx), [#123](https://github.com/roostorg/coop/pull/123) by [@user](https://github.com/user))
- Update <package> to <x.y.z> to fix <issue> ([CVE-…](https://github.com/advisories/GHSA-…), [#123](https://github.com/roostorg/coop/pull/123) by [@user](https://github.com/user))
```

List a Coop advisory before the PR link, and the upstream CVE when there is one. A fix from a private fork has no PR in this repository, so link only the advisory.

If the fix touches `types/` or `migrator/`, bump `version` in `types/package.json` or `migrator/package.json` in the same PR; npm publishing is skipped when the version already exists.

## 4. Tag and publish the release

On option A, follow steps 2–6 of [Creating a release](releases.md#creating-a-release).

On option B, create the release from the branch; the web UI's target defaults to `main`:

```bash
gh release create x.y.z --target release/x.y --title "Coop x.y.z" --notes-file notes.md
```

Publishing the release, from `main` or from `release/x.y`, triggers:

- `.github/workflows/publish-docker.yaml` on the `release` event, which pushes the `x.y.z`, `x.y` and commit SHA tags of each image, and moves `latest` only when `x.y.z` is the highest stable release tag. The `latest` check depends on [#1535](https://github.com/roostorg/coop/pull/1535); a release without that change at its tag moves `latest` regardless.
- `.github/workflows/mdbook.yml` on the tag push, which adds the docs snapshot for the release

`@roostorg/coop-types` and `@roostorg/db-migrator` are not published by a release; they publish only from pushes to `main` that change `types/` or `migrator/` (see step 5).

### Release notes template

```markdown
> [!IMPORTANT]
> **This release addresses <a reported security advisory | N reported security advisories>**: [GHSA-xxxx-xxxx-xxxx](https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx) (<Severity>, CVSS <n.n>). <Upgrade wording>. For security announcements, we encourage adopters to subscribe to the [security-announce@roost.tools mailing list](https://groups.google.com/a/roost.tools/g/security-announce).

<One paragraph per advisory: the affected component, the upstream CVE if any, the affected versions, and the fixed version.>

<The risk, in one or two sentences, without exploitation details.>

Thanks to @<reporter> for reporting <GHSA-xxxx-xxxx-xxxx>.

## Other security updates

- **<package>** <x.y.z> fixes [CVE-…](https://github.com/advisories/GHSA-…) (<Severity>) ([#123](https://github.com/roostorg/coop/pull/123))

### Upstream advisories that don't affect Coop

The updates in this release also fix these upstream advisories. They're in code that Coop doesn't use, so they don't affect Coop:

- **<package>** <x.y.z> fixes [CVE-…](https://github.com/advisories/GHSA-…) (<Severity>) ([#123](https://github.com/roostorg/coop/pull/123))

## Upgrade notes

- Images: `ghcr.io/roostorg/coop-server:x.y.z`, `coop-worker:x.y.z`, `coop-client:x.y.z` and `coop-migrations:x.y.z`.
```

Leave out sections that do not apply. For upgrade wording, see [Upgrade wording](#upgrade-wording).

## 5. Confirm artifacts published

- [ ] The **Publish Docker Images** run for the tag succeeded, and `ghcr.io/roostorg/coop-server:x.y.z`, `coop-worker:x.y.z`, `coop-client:x.y.z` and `coop-migrations:x.y.z` exist, e.g. `docker buildx imagetools inspect ghcr.io/roostorg/coop-server:x.y.z`. The run's tag list includes `latest` only if `x.y.z` is the highest stable release.
- [ ] If a tier 1 dependency or base image was fixed, the new images no longer contain the vulnerable version, using the image scan or SBOM attached to the release where available.
- [ ] If `types/` or `migrator/` changed, the **Publish Packages** run on `main` succeeded and `pnpm view @roostorg/coop-types version` or `pnpm view @roostorg/db-migrator version` shows the new version.

## 6. Publish the advisory

Publish each Coop advisory after the release, so that its patched version exists. Tier 1 vulnerabilities that are not exploitable get only the `### Security` changelog entry, not an advisory.

### Advisory template

- **Title:** `<Impact> via <vector>`, with the upstream package in parentheses for a dependency, e.g. `Denial of service via malformed request bodies (<package>)`.
- **Affected product:** ecosystem left empty, package `@roostorg/coop`, affected versions `< x.y.z` (narrower if older versions are not affected), patched versions `x.y.z`.
- **Severity:** CVSS scored for how Coop uses the affected code.
- **Description**, with these sections:
  - `### Summary`: one or two sentences.
  - `### Details`: the affected component and why Coop is affected.
  - `### Proof of concept`: the steps in prose. No exploit code.
  - `### Impact`: who can exploit it and what they get.
  - `### Patches`: the fixed version and the fixing change.
  - `### Workarounds`: mitigations for deployments that cannot upgrade yet, or "None".
  - `### References`: the upstream advisory and CVE, the release, and the fix.

### Before publishing

- [ ] The description is rewritten in the template's form; a reporter's draft is source material, not the published text.
- [ ] Affected and patched versions match the release.
- [ ] Credits are listed and every credited person has accepted.
- [ ] For a vulnerability in Coop's own code, a CVE is requested from the advisory.
- [ ] The release and changelog link the advisory.

## 7. Notify

### Hosted vendors early notice

Vendors who host Coop so that their users cannot self-patch can receive early notice (see [Security releases](https://community.roost.tools/software-development-practices/security#security-releases)).

- For an undisclosed vulnerability, tell them the release date and what to update before the release, under embargo.
- For an upstream CVE that is already public, tell them as soon as impact on Coop is confirmed, without waiting for the release.

### security-announce@roost.tools

Post to [security-announce@roost.tools](https://groups.google.com/a/roost.tools/g/security-announce) once the release and its advisories are published. The email lists only Coop advisories; upstream advisories that do not affect Coop stay in the release notes.

| Situation               | Advisory | security-announce                                                                       | Changelog  |
| ----------------------- | -------- | --------------------------------------------------------------------------------------- | ---------- |
| Tier 1, exploitable     | Yes      | Yes                                                                                     | `Security` |
| Tier 1, not exploitable | No       | No                                                                                      | `Security` |
| Tier 2                  | No       | Yes: pull the new `docker-compose.yaml`, or update the image tag in your own deployment | `Security` |
| Tier 3                  | No       | Yes: the new minimum version and upgrade guidance                                       | `Security` |
| Tier 4                  | No       | No                                                                                      | If notable |

### Upgrade wording

**Pending decision ([#1520](https://github.com/roostorg/coop/issues/1520), item 18):**

- An advisory rated High or Critical: "All deployments should upgrade."
- Otherwise: "We recommend you upgrade."

Don't qualify the wording by exposure (e.g. "if your API is public").

### Email templates

One advisory:

```text
Subject: Coop x.y.z security release

Coop x.y.z fixes a security vulnerability:

- <Advisory title>: https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx (<Severity>, CVSS <n.n>)

<Upgrade wording>

Release notes and images: https://github.com/roostorg/coop/releases/tag/x.y.z
```

More than one advisory:

```text
Subject: Coop x.y.z security release

Coop x.y.z fixes N security vulnerabilities:

- <Advisory title>: https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx (<Severity>, CVSS <n.n>)
- <Advisory title>: https://github.com/roostorg/coop/security/advisories/GHSA-yyyy-yyyy-yyyy (<Severity>, CVSS <n.n>)

<Upgrade wording, for the highest severity listed>

Release notes and images: https://github.com/roostorg/coop/releases/tag/x.y.z
```

No advisory (tier 2 or 3):

```text
Subject: Coop x.y.z: <component> security update

Coop x.y.z updates <component> to <version>, which fixes <CVE-…>. <What adopters need to do, e.g. pull the new docker-compose.yaml, or the new minimum version>.

Release notes: https://github.com/roostorg/coop/releases/tag/x.y.z
```

## 8. Forward-port to `main`

On option B, open a PR to `main` that brings over the release, as in [#1510](https://github.com/roostorg/coop/pull/1510):

- Add the `## [x.y.z]` section and its compare link to `CHANGELOG.md` below `## [Unreleased]`, matching the release notes, and remove from `## [Unreleased]` the entries that shipped in it.
- Cherry-pick any fix that merged into `release/x.y` from a private fork and is not yet on `main`.

## Checklist

- [ ] Every vulnerability in the release triaged privately; reachable ones have draft advisories
- [ ] Release base agreed (`main` or `release/x.y`) before any private-fork merge
- [ ] Fix merged (private fork or normal PR), with a regression test where possible; cherry-picks leave the lockfile unchanged under `pnpm install`
- [ ] Changelog `### Security` entries and version bump merged
- [ ] Release `x.y.z` published from the agreed base
- [ ] Images (and npm packages, if changed) confirmed published
- [ ] Advisories published after the pre-publish checks
- [ ] Hosted vendors notified
- [ ] security-announce posted, if required
- [ ] If released from `release/x.y`: release forward-ported to `main`
