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

- [ ] The vulnerability has been triaged: which released versions ship it, whether it is reachable from Coop's code, whether it is exploitable in the documented default configuration, and whether it is [known exploited](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) or has a high EPSS score.
- [ ] A draft [security advisory](https://github.com/roostorg/coop/security/advisories/new) exists for any tier 1 issue that is exploitable, and for every vulnerability in Coop's own code. It is the private record of the triage.
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

## 1. Prepare the fix

### Undisclosed vulnerability: private fork

Use this path for a vulnerability in Coop's own code, or any issue not yet public.

1. In the draft advisory, select **Start a temporary private fork**.
2. Clone the fork and open a PR against it with the fix, a regression test, and the version and changelog changes from step 3, so that a single merge makes everything public.
3. GitHub Actions does not run in temporary private forks. Run the [CI checks](https://github.com/roostorg/coop/blob/main/AGENTS.md#ci) locally and record the results in the PR.
4. Once the PR is reviewed and the release base is agreed (step 2), select **Merge pull request** in the advisory. The fix is public from this point, so tag the release (step 4) straight after.

### Public upstream CVE: normal PR

Use this path when the vulnerability is already public, e.g. a CVE in a dependency or base image. Open a normal PR that bumps the dependency or pin, and add a `### Security` changelog entry for it under `## [Unreleased]`. The PR can name the upstream CVE, but not Coop-specific reachability or exploitability details.

If Dependabot has already opened the bump, use its PR.

## 2. Choose the release base

If `## [Unreleased]` in `CHANGELOG.md` contains only the fix, release from `main` as usual and skip to step 3.

If `main` has unreleased changes, choose one of the options below. This choice is not yet settled policy; agree it with a maintainer for each release.

**A. Release from `main`.** Ship the fix together with everything already on `main`.

- Uses the existing release process and workflows unchanged.
- The release contains changes that were not planned for release yet. If `## [Unreleased]` has entries under `### Added`, or any backward-incompatible change, the next version is a minor or major release, not a patch, under [Versioning](releases.md#versioning).
- Unreleased migrations and behavior changes reach adopters who only wanted the security fix.

**B. Branch from the latest tag.** Ship only the fix as `x.y.(z+1)`.

1. Create a branch from the latest release tag, e.g. `git switch -c release/x.y x.y.z`, and push it to `origin`.
2. Open the fix and step 3 PRs against `release/x.y`. On the private fork path, push `release/x.y` before starting the fork, and target the fork PR at it.
3. Tag the release from `release/x.y` in step 4.
4. In a follow-up PR to `main`, cherry-pick the fix (if it is not already on `main`), and add the `## [x.y.(z+1)]` section and its compare link to `CHANGELOG.md` below `## [Unreleased]`, without the fix's entry in `## [Unreleased]`.

- Adopters get only the fix, as a true patch release.
- PR checks run on PRs against `release/x.y`, but `main`'s branch protection rules do not cover it.
- `@roostorg/coop-types` and `@roostorg/db-migrator` only publish from `main` (see step 5), so a fix in `types/` or `migrator/` still has to land on `main` to reach npm.

## 3. Bump the version and changelog

Follow step 1 of [Creating a release](releases.md#creating-a-release) with the patch version `x.y.z`, in a PR against the release base from step 2 (on the private fork path, in the fork PR). In the new `## [x.y.z]` section, the fix goes under `### Security` as a single line:

```markdown
### Security

- Update <dependency> to <version> to fix <CVE-ID> ([#123](https://github.com/roostorg/coop/pull/123) by [@user](https://github.com/user))
```

For an undisclosed vulnerability, describe the impact in a few words and link the advisory (`https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx`) instead of a PR, with no reproduction details.

If the fix touches `types/` or `migrator/`, bump `version` in `types/package.json` or `migrator/package.json` in the same PR; npm publishing is skipped when the version already exists.

## 4. Tag and publish the release

Follow steps 2–6 of [Creating a release](releases.md#creating-a-release), creating the tag from the release base chosen in step 2. Publishing the release triggers:

- `.github/workflows/publish-docker.yaml` on the `release` event, which pushes the `x.y.z` and `x.y` tags of each image and moves `latest`
- `.github/workflows/mdbook.yml` on the tag push, which adds the docs snapshot for the release

## 5. Confirm artifacts published

- [ ] The **Publish Docker Images** run for the tag succeeded, and `ghcr.io/roostorg/coop-server:x.y.z`, `coop-worker:x.y.z`, `coop-client:x.y.z` and `coop-migrations:x.y.z` exist, e.g. `docker buildx imagetools inspect ghcr.io/roostorg/coop-server:x.y.z`.
- [ ] If a tier 1 dependency or base image was fixed, the new images no longer contain the vulnerable version, using the image scan or SBOM attached to the release where available.
- [ ] If `types/` or `migrator/` changed, the **Publish Packages** run on `main` succeeded and `pnpm view @roostorg/coop-types version` or `pnpm view @roostorg/db-migrator version` shows the new version.

## 6. Publish the advisory

For a vulnerability in Coop's own code, and for tier 1 vulnerabilities that are exploitable, publish a GitHub Security Advisory:

1. In the draft advisory, set the affected product to package `@roostorg/coop`, affected versions to `< x.y.z` (narrower if older versions are not affected) and patched versions to `x.y.z`.
2. For an upstream CVE, name it and link the upstream advisory in the description, and say which Coop component ships it and what adopters need to do.
3. For an undisclosed vulnerability in Coop's own code, request a CVE from the advisory.
4. Publish the advisory.

Tier 1 vulnerabilities that are not exploitable get only the `### Security` changelog entry, not an advisory.

## 7. Notify

### Hosted vendors early notice

Vendors who host Coop so that their users cannot self-patch can receive early notice (see [Security releases](https://community.roost.tools/software-development-practices/security#security-releases)).

- For an undisclosed vulnerability, tell them the release date and what to update before the release, under embargo.
- For an upstream CVE that is already public, tell them as soon as impact on Coop is confirmed, without waiting for the release.

### security-announce@roost.tools

Post to [security-announce@roost.tools](https://groups.google.com/a/roost.tools/g/security-announce) once the release and any advisory are published. Describe the vulnerability, the affected versions and what adopters need to do, and link the release and the advisory.

| Situation               | Advisory | security-announce                                                                       | Changelog  |
| ----------------------- | -------- | --------------------------------------------------------------------------------------- | ---------- |
| Tier 1, exploitable     | Yes      | Yes                                                                                     | `Security` |
| Tier 1, not exploitable | No       | No                                                                                      | `Security` |
| Tier 2                  | No       | Yes: pull the new `docker-compose.yaml`, or update the image tag in your own deployment | `Security` |
| Tier 3                  | No       | Yes: the new minimum version and upgrade guidance                                       | `Security` |
| Tier 4                  | No       | No                                                                                      | If notable |

## Checklist

- [ ] Triage recorded privately; path chosen
- [ ] Fix merged (private fork or normal PR), with a regression test where possible
- [ ] Release base agreed (`main` or `release/x.y`)
- [ ] Changelog `### Security` entry and version bump merged
- [ ] Release `x.y.z` published from the agreed base
- [ ] Images (and npm packages, if changed) confirmed published
- [ ] Advisory published, if required
- [ ] Hosted vendors notified
- [ ] security-announce posted, if required
- [ ] If released from `release/x.y`: fix and changelog forward-ported to `main`
