# Security backports

The **Security backports** workflow (`.github/workflows/security-backport.yml`) keeps a branch ready for the next security patch release. For the latest release `x.y.z`, that branch is `release/x.y`, and the next release from it is `x.y.(z+1)`. A maintainer reviews and merges the backport PRs it opens, then cuts the release by following the [security release runbook](security-releases.md).

## What it does

- **Creates `release/x.y`** at the `x.y.z` tag if it doesn't exist, e.g. after `x.y.0` is released from `main`. After a release from `release/x.y` the branch is already at the tag, so it needs no change. Once `x.(y+1).0` is released, the workflow moves on to `release/x.(y+1)` and leaves `release/x.y` alone.
- **Opens a backport PR** to `release/x.y` for each PR merged to `main` with the `security` label, from a `backport/<n>-to-release-x.y` branch. It cherry-picks the PR's merge commit with `git cherry-pick -x`, copies the PR's `## Release notes` section, and labels the backport `security`. A PR qualifies whether the label came from the [labeling workflow](https://github.com/roostorg/coop/pull/1519) or from a person, and whether it was added before or after the merge.
- **Keeps a draft release** for `x.y.(z+1)` targeting `release/x.y`. Release Drafter collects the release notes of the PRs merged into `release/x.y` since `x.y.z`. Draft releases are visible only to people with write access.

It runs when a PR to `main` is merged or labelled `security`, when a PR to `release/**` is merged, when a release is published, daily, and on demand. Every run checks all `security` PRs merged since `release/x.y` diverged from `main`. A run skips a PR that is already on the branch, that has a backport PR (open, merged or closed), or whose backport already failed.

To decline a backport, close its PR without merging; the workflow won't open it again.

## Lockfile changes

A cherry-pick that applies cleanly changes the same lines of `pnpm-lock.yaml` as the source PR. The workflow then checks that:

- every package version the backport adds was also added by the source PR, and every version the source PR upgrades to is present when the branch has that package;
- `pnpm install --frozen-lockfile --lockfile-only` passes;
- `scripts/check-lockfile-backport.mjs origin/main` passes, when that script is on `main`.

It never re-resolves the lockfile. If a check fails or the lockfile conflicts, the PR goes to the manual path below.

If a backport changes more than one package, as with a grouped Dependabot PR, it opens as a draft with a warning that lists the version changes. Keep only the security updates before marking it ready.

## When it fails

If a cherry-pick conflicts or a check fails, the workflow comments on the source PR with the reason and the commands to backport it by hand, and the run fails. It never force-pushes, and never pushes to `release/x.y` directly. Backport by hand following "Cherry-picking deterministically" in the [runbook](security-releases.md). Use the `backport/<n>-to-release-x.y` branch name and `git cherry-pick -x`, so the workflow recognizes the result. Alternatively, fix the cause and run the workflow with `pr` set to the PR number and `retry` checked.

## What it doesn't handle

- **Fixes from a private GHSA fork.** These aren't PRs in this repository, so the workflow never sees them, and it never publishes anything about an advisory. Follow the private fork path in the runbook: merge the fix into `release/x.y` directly, add its release note to the draft release by hand, and forward-port it to `main` after the release.
- **Rebase-merged PRs with several commits.** The workflow cherry-picks only the merge commit GitHub records, so backport these by hand.
- **Publishing.** Cutting `x.y.(z+1)` stays manual: review the draft release, then publish it with `release/x.y` as its target.

## Setup

- A GitHub App installed on this repository with **Contents**, **Pull requests**, **Issues** and **Workflows** read and write permissions. The workflow uses it instead of `GITHUB_TOKEN` so that CI runs on the backport PRs. GitHub requires **Workflows** to create `release/x.y` at a tag whose workflow files differ from `main`'s, and to push a backport that changes `.github/workflows/`. Store its ID in the `BACKPORT_APP_ID` Actions variable and its private key in the `BACKPORT_APP_PRIVATE_KEY` secret.
- The `security` and `has-release-notes` labels.
- If a ruleset restricts creating `release/**` branches, add the app as a bypass actor for branch creation only.
