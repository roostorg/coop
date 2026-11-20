# Security backports

The **Security backports** workflow (`.github/workflows/security-backport.yml`) keeps a branch ready for the next security patch release. For the latest release `x.y.z`, that branch is `release/x.y`, and the next release from it is `x.y.(z+1)`. A maintainer reviews and merges the backport PR it keeps for that release, then cuts the release by following the [security release runbook](security-releases.md).

## What it does

- **Asks for `release/x.y`** if it doesn't exist, e.g. after `x.y.0` is released from `main`. Only the release branch ruleset's bypass actors can create release branches, so the run warns with the command to run and backports nothing until the branch exists:

  ```bash
  git push origin 'x.y.0^{commit}:refs/heads/release/x.y'
  ```

  After a release from `release/x.y` the branch is already at the tag, so it needs no change. Once `x.(y+1).0` is released, the workflow moves on to `release/x.(y+1)` and leaves `release/x.y` alone. Its open backport PRs and its draft release stay too: release `x.y.(z+1)`, or close the PRs and delete the draft.

- **Keeps one draft backport PR** to `release/x.y`, from the `backport/security-to-release/x.y` branch, with every PR merged to `main` with the `security-update` label. A PR qualifies whether the label came from the [labeling workflow](https://github.com/roostorg/coop/pull/1519) or from a person, and whether it was added before or after the merge. The workflow cherry-picks each PR's merge commit onto the branch with `git cherry-pick -x`, labels the backport PR `security-update`, and rewrites its description on every run: the source PRs, their lockfile changes, and their `## Release notes` sections, each credited to its source PR and author. Release Drafter reads the credit of the last note from an `<!-- original-credit: … -->` comment, which takes the place of the backport PR's own credit.

  Don't push to the branch or edit the description. To change a release note, edit the source PR's `## Release notes` section, e.g. to add one to a Dependabot PR, and rerun the workflow. Mark the backport PR ready and merge it with **Rebase and merge** when the release is due; the next security PR starts a new one. The workflow keeps adding fixes while the PR is open, so check its list again right before merging.

- **Keeps a draft release** for `x.y.(z+1)` targeting `release/x.y`. Release Drafter collects the release notes of the PRs merged into `release/x.y` since `x.y.z`. Draft releases are visible only to people with write access.

It runs when a PR to `main` is merged or labelled or unlabelled `security-update` or `no-backport`, when a PR to `release/**` is merged, when a release is published, daily, and on demand. Every run checks all `security-update` PRs merged since `release/x.y` diverged from `main`. A run skips a PR that is already on `release/x.y`, that has its own backport PR (open, merged or closed), that is labelled `no-backport`, or whose backport already failed.

When `release/x.y` moves, e.g. after a manual backport is merged, or a PR in the backport PR is labelled `no-backport` or loses its `security-update` label, the workflow rebuilds the branch from `release/x.y` and force-pushes it with a lease. It never force-pushes another branch. If the branch has commits the workflow didn't add, the run fails instead of dropping them: remove them, or merge or close the PR. A rebuild that leaves nothing in the PR closes it.

To decline a backport, label its source PR `no-backport`; for a fix in its own backport PR, close that PR without merging. The workflow won't backport it again.

## Lockfile changes

A cherry-pick that applies cleanly changes the same lines of `pnpm-lock.yaml` as the source PR. The workflow then checks that:

- every package version the backport adds was also added by the source PR, and every version the source PR upgrades to is present when the branch has that package;
- `pnpm install --frozen-lockfile --lockfile-only` passes;
- `scripts/check-lockfile-backport.mjs origin/main` passes, when that script is on `main`.

It never re-resolves the lockfile. If a check fails or the lockfile conflicts, the PR goes to the manual path below.

If a source PR changes more than one direct dependency, as with a grouped Dependabot PR, its backport gets its own draft PR from a `backport/<n>-to-release/x.y` branch, with a warning that lists the version changes. Keep only the security updates before marking it ready. Its `## Release notes` section ends with the `original-credit` comment; keep that as the section's last line.

## When it fails

If a cherry-pick conflicts or a check fails, the workflow comments on the source PR with the reason and the commands to backport it by hand, and the run fails. It leaves that PR out of the release's backport PR, and never pushes to `release/*`. Backport by hand following "Cherry-picking deterministically" in the [runbook](security-releases.md). Use the `backport/<n>-to-release/x.y` branch name and `git cherry-pick -x`, so the workflow recognizes the result, and copy the release notes and the credit line the comment gives. Alternatively, fix the cause and run the workflow with `pr` set to the PR number and `retry` checked.

## What it doesn't handle

- **Fixes from a private GHSA fork.** Merge the fix into `main` from the advisory. It lands as a commit with no PR in this repository, so the workflow never sees it, and it never publishes anything about an advisory. The fix is public from that merge, so follow the private fork path in the [runbook](security-releases.md) and release straight after. Cherry-pick it to `release/x.y` by hand with `git cherry-pick -x` in a public backport PR. Write its release note, linking only the advisory, in that PR's `## Release notes` section and label it `security-update` and `has-release-notes`, so that Release Drafter collects it; the draft release is regenerated on every run, so edits to it by hand are lost. The note credits whoever opens the backport PR.
- **Rebase-merged PRs with several commits.** The workflow cherry-picks only the merge commit GitHub records, so backport these by hand.
- **Publishing.** Cutting `x.y.(z+1)` stays manual: review the draft release, then publish it with `release/x.y` as its target.

## Setup

- A GitHub App installed on this repository with **Contents**, **Pull requests**, **Issues** and **Workflows** read and write permissions. The workflow uses it instead of `GITHUB_TOKEN` so that CI runs on the backport PRs. GitHub requires **Workflows** to push a backport that changes `.github/workflows/`. Store its client ID in the `BACKPORT_APP_CLIENT_ID` variable and its private key in the `BACKPORT_APP_PRIVATE_KEY` secret of the `security-backport` environment, with deployment branches limited to `main` and no required reviewers or wait timer.
- The `security-update`, `has-release-notes` and `no-backport` labels.
- Don't add the app as a bypass actor on the release branch ruleset. A bypass actor skips every rule in it, including the PR requirement, and the app needs none of them.
