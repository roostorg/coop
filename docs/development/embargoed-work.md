# Embargoed work

Some changes can't be public until a set date: a fix for an undisclosed vulnerability, or a feature built with a partner under NDA. That work happens in a private copy of this repository and lands here when the embargo ends.

A private copy is a separate private repository, created by pushing this repository's history to it. It is not a GitHub fork: a fork of a public repository is always public. Because it is not a fork, GitHub can't open a PR from it to `roostorg/coop`, so landing is a separate step ([Landing](#landing)).

There are two kinds:

- **Security copies** hold pre-disclosure security fixes.
- **Partner copies** hold features under a partner embargo.

In the commands below, `<private-repo>` is the private copy as `owner/name`, and `<ghsa-fork-url>` is the URL of a security advisory's temporary private fork.

The tooling lives in this repository, so every private copy gets it with the history:

| Tool                                          | What it does                                                 |
| --------------------------------------------- | ------------------------------------------------------------ |
| `scripts/embargo/new-embargo-repo.sh`         | Creates and configures a private copy                        |
| `.github/workflows/embargo-upstream-sync.yml` | Keeps the private copy's `main` in step with `roostorg/coop` |
| `scripts/embargo/sync-upstream.sh`            | Does the sync; also runs by hand                             |
| `scripts/embargo/check-lineage.sh`            | Checks that a branch builds on `roostorg/coop`'s `main`      |
| `.github/workflows/embargo-lineage.yml`       | Runs the lineage check on PRs in the private copy            |
| `scripts/embargo/land.sh`                     | Moves reviewed work from the private copy to `roostorg/coop` |

The workflows only run in private copies, never in `roostorg/coop`. Workflows that publish (Docker images, npm packages, docs, notifications) only run in `roostorg/coop`, so a private copy never publishes anything.

Everything in this repository is public. Never name a private copy, a partner or an undisclosed vulnerability in an issue, PR, commit message, branch name or doc here.

## Choosing where to work

| Situation                                                                              | Where                                               |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Small security fix: one PR, reviewed in days, local CI is enough                       | The advisory's temporary private fork               |
| Security fix that needs CI, several PRs, several weeks, or people outside the advisory | A security copy, landed through the advisory's fork |
| Feature under a partner embargo                                                        | A partner copy                                      |
| Anything already public                                                                | A normal PR to `roostorg/coop`                      |

A GitHub security advisory's temporary private fork is the default for security fixes: see [Undisclosed vulnerability: private fork](security-releases.md#undisclosed-vulnerability-private-fork). It has limits: GitHub Actions doesn't run in it, its branches are a snapshot from when it was created, and GitHub deletes it once the fix merges. Use a security copy when those limits get in the way. The fix still lands through the advisory's fork, so the advisory records it.

Partner work has no advisory, so it always uses a partner copy.

## Creating a private copy

Run the script from a clone of `roostorg/coop`'s `main`. It does a dry run by default; check what it prints, then rerun it with `--yes`:

```bash
scripts/embargo/new-embargo-repo.sh --help
scripts/embargo/new-embargo-repo.sh <private-repo>
scripts/embargo/new-embargo-repo.sh <private-repo> --yes
```

Then set up your clone as in [Local clone setup](#local-clone-setup).

## Keeping `main` in sync

The private copy's `main` mirrors `roostorg/coop`'s `main`; nobody pushes or merges to it. The **Embargo upstream sync** workflow fast-forwards it daily and copies `roostorg/coop`'s tags. To sync sooner, run the workflow from the **Actions** tab, or run the script from your clone (dry run by default):

```bash
scripts/embargo/sync-upstream.sh --help
scripts/embargo/sync-upstream.sh
scripts/embargo/sync-upstream.sh --yes
```

If the private copy's `main` has commits that `roostorg/coop`'s `main` lacks, the sync fails, lists them and pushes nothing. Move those commits to a branch and open a PR for them, then reset `main` to `roostorg/coop`'s `main`. A private tag with the same name as an upstream tag but a different commit is never moved; the sync fails after pushing everything else. Rename or delete the private tag.

## Reviewing work

1. Branch from the private copy's `main`. Keep one branch per change: don't merge other branches into it, and don't build it on another private branch.
2. Open a PR in the private copy against its `main`. CI runs there as it does here, together with the **Lineage** check.
3. Review it as you would a PR to `roostorg/coop`, with the same title format, tests and checks.
4. Don't merge it. Merging would put the private copy's `main` ahead of `roostorg/coop`, and the sync would stop. Keep the approved PR open until [landing](#landing).

While the PR waits, the sync keeps `main` current. Rebase the branch onto it from time to time, and run the lineage check, which fetches `roostorg/coop`'s `main` itself:

```bash
git fetch origin
git rebase origin/main
scripts/embargo/check-lineage.sh <branch>
```

It exits 1 and prints each failed rule with a code:

| Code      | Problem                                                     | Fix                                                                                                                 |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `[1]`     | The private copy's `main` has commits `roostorg/coop` lacks | Reset it to `roostorg/coop`'s `main`; it only mirrors                                                               |
| `[2a]`    | The branch doesn't build on `roostorg/coop`'s `main`        | Rebase onto `main`                                                                                                  |
| `[2b]`    | The branch shares commits with another private branch       | Land the other branch first, or rebase so the branch holds only its own commits; same for a branch stacked on yours |
| `[3]`     | The branch has merge commits                                | Rebase onto `main`                                                                                                  |
| `[range]` | The branch has nothing to land                              | Nothing to do                                                                                                       |

Force-pushing a rebase does not dismiss existing approvals, so ask for a new review if the rebase changed anything.

## Landing

Land the work when its embargo ends:

- **Security fixes** land in the same window as the release that ships them, not earlier. A fix merged to `roostorg/coop` is public, so landing it before the release is ready discloses the vulnerability with no fixed version to upgrade to. Agree the release base first, then land and release straight after: see [Security releases](security-releases.md), steps 1, 2 and 4.
- **Partner features** land on the date agreed with the partner.

Run the landing script from your clone of the private copy, with the PR's branch checked out locally. It needs git 2.40 or later. It checks the branch's lineage, replays it onto `roostorg/coop`'s current `main` without touching your working tree, squashes it into one commit and pushes that commit to a new branch on the target. It does not open the PR.

Run it without `--yes` first. It opens your editor with the branch's commit messages, which become the squashed commit's message; that message is public once the commit lands, so remove anything about the embargo. Check the author, message, diff stat, target and branch name it prints, then rerun with `--yes`. The pushed branch takes the private branch's name unless you pass `--remote-branch`; the name becomes public too, so pick a neutral one.

For a security fix, the target is the advisory's temporary private fork. Bring the fork's `main` up to date first, as in [Undisclosed vulnerability: private fork](security-releases.md#undisclosed-vulnerability-private-fork), step 3, since the squashed commit builds on `roostorg/coop`'s current `main`:

```bash
scripts/embargo/land.sh --help
scripts/embargo/land.sh <branch> --ghsa <ghsa-fork-url> --remote-branch <public-branch>
scripts/embargo/land.sh <branch> --ghsa <ghsa-fork-url> --remote-branch <public-branch> --yes
```

Open the PR from the link the script prints, and follow the rest of the private-fork steps in [Security releases](security-releases.md). Actions doesn't run in the fork, so link or copy the private copy's CI results into the fork PR.

For a partner feature, the target is `roostorg/coop`. With `--yes`, the script asks you to type the branch name to confirm:

```bash
scripts/embargo/land.sh <branch> --public --remote-branch <public-branch>
scripts/embargo/land.sh <branch> --public --remote-branch <public-branch> --yes
```

Open the PR from the link the script prints. It gets the usual review and CI.

Either way, the PR's title and description say nothing about the embargo or the private copy. If the script reports a lineage failure or a conflict, it changes nothing: rebase the branch in the private copy, have it reviewed again, and rerun.

After the PR merges, the sync brings the commit into the private copy's `main`. Close the private PR and delete its branch.

## Local clone setup

Set up every clone of a private copy so that it can't push to `roostorg/coop` or open a PR there by accident:

```bash
git clone https://github.com/<private-repo>.git
cd "$(basename <private-repo>)"
git remote add upstream https://github.com/roostorg/coop.git
git remote set-url --push upstream DISABLED
gh repo set-default <private-repo>
```

Check it:

```bash
git remote -v              # upstream's push URL is DISABLED
gh repo set-default --view # prints <private-repo>
```

`git push upstream` then fails, and `gh pr create`, `gh issue create` and other `gh` commands target the private copy. `git` and `gh` defaults are per clone, so repeat this for every clone and worktree checkout.

AI coding agents working in these clones need the same setup. Check it before the agent starts, and tell it that the repository is private and that nothing from it goes to `roostorg/coop`, or to any other public place, until it lands.
