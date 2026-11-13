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

- [ ] Every vulnerability going into the release has been triaged: the reported one, and every upstream advisory fixed by a dependency update in the release (see [Finding a release's security fixes](#finding-a-releases-security-fixes)), including Dependabot alerts that closed when their fix merged. For each, record which released versions ship it, whether it is reachable from Coop's code, whether it is exploitable in the documented default configuration, and whether it is [known exploited](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) or has a high EPSS score. Reproduce it against Coop where feasible.
- [ ] Each reachable vulnerability has a draft [security advisory](https://github.com/roostorg/coop/security/advisories/new), scored for how Coop uses the affected code rather than copied from the upstream score. So does every vulnerability in Coop's own code. Upstream advisories that are not reachable get no Coop advisory; the release notes list them under **Other security updates**, without saying whether they affect Coop.
- [ ] You know which path in step 1 applies.

Proposed response targets:

| Situation                                                | Triage          | Fix or mitigate                             |
| -------------------------------------------------------- | --------------- | ------------------------------------------- |
| Critical/high, tier 1 or 2, reachable or known exploited | 1 business day  | 72 hours                                    |
| Critical/high, tier 1 or 2, reachability unclear         | 1 business day  | 7 days                                      |
| Critical/high, tier 3                                    | 2 business days | Update the documented minimum within 7 days |
| Moderate, or tier 4                                      | Weekly          | Next scheduled release                      |
| Low, or not reachable                                    | Weekly          | Dismissed with a reason                     |

Reachability and exploitability details stay in the draft advisory or the private triage queue until the fix is released. Never put them in a public issue, PR, commit message or release note.

The steps run in this order: choose the release base (step 2) before merging anything from a private fork; then merge the fix, publish the release, publish the advisories, and announce.

### Finding a release's security fixes

Security fixes carry the `security-update` label: Dependabot PRs that fix a published advisory get it automatically, and authors or maintainers add it to manual fixes. Only fixes already merged to `main`, or merged from an advisory fork, are eligible for a patch release; open PRs wait for the next release. To list the fixes merged to `main` since the last release `x.y.z` of the line being patched:

```bash
LAST=$(gh release view x.y.z --repo roostorg/coop --json publishedAt --jq .publishedAt)
gh pr list --repo roostorg/coop --state merged --base main --label security-update --search "merged:>=${LAST%%T*}" --limit 200
```

Without a tag, `gh release view` returns the repository's **Latest** release, which may belong to another line.

On option B, the date alone is not enough: a fix merged to `main` before `x.y.z` may not have shipped in it. Compare the fixes with what `release/x.y` already has, by the commits cherry-picked to it and by its lockfile:

```bash
git log origin/release/x.y --grep 'cherry picked from commit' --format='%h %s'
git log origin/release/x.y --format='%h %s' | grep -i backport
git diff origin/release/x.y origin/main -- pnpm-lock.yaml
```

A squash-merged backport has no cherry-pick line; the second command finds it by its title, and its PR description names the source PR. The Security backports workflow does not recognize a squashed backport and may open a duplicate for it.

This depends on the labeling workflow in [#1519](https://github.com/roostorg/coop/pull/1519) and on the `security-update` label existing ([#1520](https://github.com/roostorg/coop/issues/1520), items 1 and 15). PRs merged before both are in place are not labeled, so also check the unlabeled PRs merged since the last release:

```bash
gh pr list --repo roostorg/coop --state merged --base main --search "merged:>=${LAST%%T*} -label:security-update" --limit 200 --json number,title
```

Dependabot security groups merged before the labeling workflow are titled after their group, e.g. `npm-prod-security`, so also search titles:

```bash
gh pr list --repo roostorg/coop --state merged --base main --search "merged:>=${LAST%%T*} in:title security" --limit 200 --json number,title
```

For each dependency update, read the release notes or advisories of every package version it changes. To find which updates in a group are tier 1, check what depends on each package:

```bash
pnpm why -r --prod <package>
```

A package counts as tier 1 only through a workspace package that ships in one of the four images or in `@roostorg/coop-types`; for example, `nodejs-instrumentation` is not built by `publish-docker.yaml`. A package reached only through dev dependencies is tier 4.

Dependabot closes an alert when its fix merges, so it no longer shows as open. List the alerts fixed since the last release and check that each was triaged:

```bash
gh api --paginate "repos/roostorg/coop/dependabot/alerts?state=fixed&per_page=100" --jq ".[] | select(.fixed_at >= \"$LAST\") | [.number, .security_advisory.ghsa_id, .dependency.package.name] | @tsv"
```

## 1. Prepare the fix

### Undisclosed vulnerability: private fork

Use this path for a vulnerability in Coop's own code, or any issue not yet public.

1. Choose the release base (step 2). On option B, create `release/x.y` first if it does not exist.
2. In the draft advisory, select **Start a temporary private fork**. Fine-grained personal access tokens cannot reach the fork, even with it added to the token. Use a short-lived classic token with the `repo` and `workflow` scopes, and revoke it when the release is done.
3. Bring the fork's target branch up to date. Its branches are a snapshot from when the fork was created, and **Sync fork** does not work on advisory forks, so push the upstream commit to it as a fast-forward, without force:

   ```bash
   git push https://github.com/roostorg/<fork>.git <upstream sha>:refs/heads/main
   ```

   Do the same for `release/x.y` on option B. The push is rejected without the `workflow` scope if the new commits change `.github/workflows/`.

4. Clone the fork and open a PR against it with the fix and a regression test. Target `main` on option A, or `release/x.y` on option B. If on option B you also want the `main` version reviewed in the fork, open it as a second PR and keep both in sync: add every commit to both before review. Only one of them can be merged from the advisory, so before merging, export the other with `git format-patch` for the forward-port in step 8.
5. GitHub Actions does not run in temporary private forks. Run the [CI checks](https://github.com/roostorg/coop/blob/main/AGENTS.md#ci) locally and record the results in the PR. The required checks stay at "Expected — Waiting for status to be reported", so merging needs a branch protection bypass. **Pending decision:** a narrow bypass for security releases, or a private mirror repository where Actions runs.
6. Before merging, update the fork's target branch again as in step 3, rebase the fix onto it, and rerun the local CI checks. The fork checks mergeability against its own stale branch, so a PR it shows as mergeable can still conflict upstream. Force-pushing the rebase does not dismiss existing approvals, so ask for a new review.
7. Copy anything you need from the fork PR, such as review comments and CI results, into the draft advisory. GitHub deletes the fork when the PR is merged.
8. Once the PR is reviewed, select **Merge pull request** in the advisory. The fix is public from this point, so publish the release (step 4) straight after.
9. The merge lands as one squashed commit titled "Merge commit from fork", with the PR's title only in the commit body, so `git log --oneline` does not show it as a security fix. Whoever merges it tells the release owner the commit SHA.

If a fork fix for option B merged into `main` instead of `release/x.y`, the fix is public from that merge, and the response clock runs from it. Cherry-pick it to `release/x.y` with `git cherry-pick -x` in a public backport PR:

- Title it `fix(<scope>): backport <sha> to release/x.y`, with the one-line description below, nothing about the vulnerability. The commit's own title, "Merge commit from fork", does not pass the PR title check.
- Write its entry in the release notes directly (step 3).
- Skip step 8's forward-port; the fix is already on `main`.

### Public upstream CVE: normal PR

Use this path when the vulnerability is already public, e.g. a CVE in a dependency or base image. Open a normal PR against `main` that bumps the dependency or pin, with a `fix` title (e.g. `fix(deps): update <package> to <x.y.z>`) and its release note in the PR description's `## Release notes` section, in the format from step 3. The PR can name the upstream CVE, but not Coop-specific reachability or exploitability details.

If Dependabot has already opened the bump, use its PR. If its PR groups the security update with other updates, release only the security update (on option B, a separate PR to `release/x.y` that applies the same specifier and version as `main`).

## 2. Choose the release base

If nothing else has merged to `main` since the last release, release from `main` as usual and skip to step 3.

If `main` has unreleased changes, choose one of the options below. **Pending decision ([#1520](https://github.com/roostorg/coop/issues/1520), item 11):** option B as a standing model is a proposal; until it is decided, agree the base with a maintainer for each release.

**A. Release from `main`.** Ship the fix together with everything already on `main`.

- Uses the existing release process and workflows unchanged.
- The release contains changes that were not planned for release yet. If the draft release on [GitHub Releases](https://github.com/roostorg/coop/releases) has entries under **Added**, or `main` has any backward-incompatible change, the next version is a minor or major release, not a patch, under [Versioning](releases.md#versioning).
- Unreleased migrations and behavior changes reach adopters who only wanted the security fix.

**B. Release from `release/x.y`.** Ship only the fixes as `x.y.(z+1)`, from a release branch kept for the latest minor version.

- Create the branch once per minor version, from its first release tag: `git switch -c release/x.y x.y.0`, then push it to `origin`. Only the ruleset's bypass actors can create it.
- Fixes land on `main` first, then are cherry-picked to `release/x.y` with `git cherry-pick -x`. The exception is a private-fork fix, which merges into `release/x.y` directly and is forward-ported to `main` in step 8.
- Clean `-x` cherry-picks of exact `main` commits were already reviewed on `main`, so batch them into one backport PR per release. Open a separate PR for each backport that does not map exactly to a `main` commit: one update split out of a Dependabot group, a lockfile regenerated with `pnpm update`, or a cherry-pick with conflicts resolved by hand.
- If a security fix adds or bumps a dependency, the backport takes that change as part of the fix, even when the dependency change is not itself a security update. It uses the same specifier and version as `main`, counts among the packages being fixed in the lockfile steps below, and passes the lockfile check, and approving the fix approves it without a separate dependency approval. Check its license and known CVEs as usual, and list the change under **Upgrade notes** if deployers need to know about it.
- A ruleset on `release/*` requires a PR for every change, allows only rebase merges, requires the server, client, codegen, integration and E2E checks to pass, and blocks force pushes and branch deletion. Only its bypass actors can create or update the branch, so one of them merges each backport PR.
- The [Security backports](security-backports.md) workflow creates `release/x.y` and opens a backport PR for each `security-update`-labelled PR merged to `main`, from a `backport/<n>-to-release/x.y` branch. Its app must be a bypass actor for creating `release/*` branches. It depends on [#1550](https://github.com/roostorg/coop/pull/1550); without it, cherry-pick by hand as below.
- Open each backport PR with `gh pr create --base release/x.y`; `gh` defaults to `main`. Its description is one line, `Backporting PR #<n> to <x.y> security release branch` (or `Backporting <sha> …` for a fix with no PR), with no template sections; an agent may write this line. Release Drafter does not run on `release/x.y` until [#1548](https://github.com/roostorg/coop/pull/1548) and [#1550](https://github.com/roostorg/coop/pull/1550) are in, so write the release's notes directly in step 3.
- Merge backport PRs with **Rebase and merge**. Merge commits are disabled in this repository, and a squash merge uses the PR title with an empty body, which drops the `(cherry picked from commit …)` line that marks a commit as backported.
- `release/x.y` keeps the `AGENTS.md`, PR template and `CHANGELOG.md` of its `x.y.0` tag, which may predate release notes in PR descriptions. Its release notes go only in the GitHub release: don't add entries to its `CHANGELOG.md`, and don't forward-port any to `main`.
- A release runs the workflow files at its tag, and PR checks run the workflow files on the PR's base branch, so fixes to `.github/workflows/` on `main` must also be cherry-picked to `release/x.y` before they apply to it. When creating `release/x.y`, check that it has [#1462](https://github.com/roostorg/coop/pull/1462), which runs the server and client checks when `pnpm-lock.yaml` changes.
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

   It reads the committed lockfiles, and exits 1 and lists each package that pnpm resolved to a version newer than `main` has. If it does, redo the conflict resolution from step 1 so those packages keep the branch's versions. If the script is on `main` but not yet on `release/x.y`, run `main`'s copy: `D=$(mktemp -d) && git show origin/main:scripts/check-lockfile-backport.mjs > "$D/check-lockfile-backport.mjs" && node "$D/check-lockfile-backport.mjs" origin/main`.

The script depends on [#1524](https://github.com/roostorg/coop/pull/1524) ([#1520](https://github.com/roostorg/coop/issues/1520), item 5).

For a fix that only changes `pnpm-lock.yaml`, regenerating on the branch is simpler than resolving the cherry-pick:

```bash
pnpm update -r <package>... --lockfile-only --no-save
```

pnpm rejects a version for a transitive dependency, so the update resolves the newest version that has cleared `minimumReleaseAge`, which can be newer than `main`'s. Confirm each package resolved to exactly `main`'s version; the check in step 5 catches anything newer. If it did not, add a temporary entry to `overrides` in `pnpm-workspace.yaml` pinning `main`'s version, run the update again, then remove the entry and confirm `pnpm install --frozen-lockfile` still passes. Then run steps 3 to 5 above, and end the commit message with `(cherry picked from commit <sha on main>)` by hand, as `git cherry-pick -x` would. The Security backports workflow skips a fix whose commit carries that line; without it, the workflow opens a duplicate backport.

On a `release/x.y` without [#1462](https://github.com/roostorg/coop/pull/1462), PR checks skip the server and client jobs for a lockfile-only change, so run `docker compose run --rm --build test`, `docker compose run --rm --build backend pnpm run build` and `docker compose run --rm --build backend pnpm run typecheck` locally and keep the results in the release log, to share with the reviewer on request, or cherry-pick #1462 first.

## 3. Write the release notes

Each fix's release note goes in its PR description's `## Release notes` section, one line per fix, in the formats from [`AGENTS.md`](https://github.com/roostorg/coop/blob/main/AGENTS.md#release-notes). Release Drafter collects these into the draft release for `main` and adds the PR and author links:

```markdown
## Release notes

- Prevent <impact> ([GHSA-xxxx-xxxx-xxxx](https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx))
- Update <package> to <x.y.z> to fix <issue> ([CVE-…](https://github.com/advisories/GHSA-…))
```

The release itself gets notes written from the [release notes template](#release-notes-template), using these entries as source material:

- On option A, edit the draft release for `main`.
- On option B, edit the draft release for `x.y.(z+1)` that the Security backports workflow keeps for `release/x.y`, and publish it in step 4. Without that draft (it depends on [#1548](https://github.com/roostorg/coop/pull/1548) and [#1550](https://github.com/roostorg/coop/pull/1550)), write the notes in a file for step 4, copying the fixes' entries from the draft release for `main`.
- Release Drafter only collects PRs with a `## Release notes` section. Dependabot PRs have none, so write their entries by hand in the format above.
- [#1548](https://github.com/roostorg/coop/pull/1548) adds a **Security** category for PRs labelled `security-update`, and sets `filter-by-commitish: true` so that the draft release for `main` and the draft for `release/x.y` stay separate. Without it, Release Drafter for `main` updates whichever draft it finds first.
- A fix from a private fork has no PR in this repository, so write its entry in the release notes directly, linking only the advisory:

```markdown
- Prevent <impact> ([GHSA-xxxx-xxxx-xxxx](https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx))
```

If the fix touches `types/` or `migrator/`, bump `version` in `types/package.json` or `migrator/package.json` in the same PR; npm publishing is skipped when the version already exists.

## 4. Tag and publish the release

On option A, follow [Creating a release](releases.md#creating-a-release), with the notes from step 3.

On option B, first check that `release/x.y` holds exactly the reviewed backports, whatever merge method was used: its tree must match the reviewed PR heads merged together. For two PRs, compare these; for a single PR, use `git rev-parse <pr head>^{tree}` instead of `git merge-tree`:

```bash
git merge-tree --write-tree <first pr head> <second pr head>
git rev-parse origin/release/x.y^{tree}
```

Then check that no other draft release uses the tag or title `x.y.z`; the draft release for `main` may name the next patch version:

```bash
gh release list --repo roostorg/coop --json tagName,name,isDraft
```

If the draft for `main` holds `x.y.z`, rename it immediately before publishing, and run `gh release list` again just before you publish: every push to `main` runs Release Drafter, which sets the draft back to the next patch version until `x.y.z` is published. After publishing, the draft for `main` moves to `x.y.(z+1)`; if `main` has unreleased **Added** entries, rename it to the next minor version. [#1548](https://github.com/roostorg/coop/pull/1548) takes the version from `main` instead. Then publish the draft release for `x.y.(z+1)` after checking that its target is `release/x.y`. Without a draft, create the release from the branch; the web UI's target defaults to `main`:

```bash
gh release create x.y.z --target release/x.y --title "Coop x.y.z" --notes-file notes.md
```

`--notes-file` publishes only the file's text, so check that it ends with the **Full Changelog** compare link from the template.

If a newer minor version has already been released, add `--latest=false` so that GitHub's **Latest** release does not move back to `x.y.z`.

If `gh release create` fails, for example with HTTP 500, check that it created neither a release nor a tag before retrying; otherwise a retry can leave a duplicate release or an orphaned tag:

```bash
gh release list --repo roostorg/coop --limit 3 --json tagName,isDraft
git ls-remote --tags origin x.y.z
```

Publishing the release, from `main` or from `release/x.y`, triggers the following at once, so the notes must be final before you publish:

- `.github/workflows/publish-docker.yaml` on the `release` event, which pushes the `x.y.z`, `x.y` and commit SHA tags of each image, and moves `latest` only when `x.y.z` is the highest stable release tag. The `latest` check depends on [#1535](https://github.com/roostorg/coop/pull/1535); a release without that change at its tag, such as one from a `release/x.y` branched before it, moves `latest` regardless. That is correct only while `x.y.z` is the highest release; otherwise cherry-pick #1535 to `release/x.y` first.
- `.github/workflows/mdbook.yml` on the tag push, which adds the docs snapshot for the release.
- `.github/workflows/discord-bot.yml` on the `release` event, which announces the release on Discord.

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

## Upgrade notes

- Images: `ghcr.io/roostorg/coop-server:x.y.z`, `coop-worker:x.y.z`, `coop-client:x.y.z` and `coop-migrations:x.y.z`.

**Full Changelog**: https://github.com/roostorg/coop/compare/x.y.(z-1)...x.y.z
```

For a release with no Coop advisory, replace everything above **Other security updates** with:

```markdown
> [!IMPORTANT]
> **This is a security release.** It updates dependencies to versions that fix published upstream advisories, listed below. <Upgrade wording>. For security announcements, we encourage adopters to subscribe to the [security-announce@roost.tools mailing list](https://groups.google.com/a/roost.tools/g/security-announce).
```

List every upstream advisory fixed by a dependency update that has no Coop advisory under **Other security updates**, without saying whether it affects Coop: reachability stays private (see [Before you start](#before-you-start)). A backport resolved by hand can change behavior beyond the fix; list any such change under **Upgrade notes**. Leave out sections that do not apply. For upgrade wording, see [Upgrade wording](#upgrade-wording).

## 5. Confirm artifacts published

- [ ] The **Publish Docker Images** run for the tag succeeded, and `ghcr.io/roostorg/coop-server:x.y.z`, `coop-worker:x.y.z`, `coop-client:x.y.z` and `coop-migrations:x.y.z` exist, e.g. `docker buildx imagetools inspect ghcr.io/roostorg/coop-server:x.y.z`. The run's tag list includes `latest` only if `x.y.z` is the highest stable release, and when it does, `x.y.z`, `x.y` and `latest` share one digest.
- [ ] The fix is inside `coop-server` and `coop-worker` at `x.y.z`, checked against the previous release `x.y.(z-1)` as a control, which should still show the old code or version. For a code fix, count the compiled files that still contain a string the fix removed (0 at `x.y.z`); for a dependency, read the installed version:

  ```bash
  docker run --rm --entrypoint sh ghcr.io/roostorg/coop-server:x.y.z -c 'grep -rl "<removed string>" /app --include=*.js | grep -v node_modules | wc -l'
  docker run --rm --entrypoint sh ghcr.io/roostorg/coop-server:x.y.z -c 'find /app -path "*/node_modules/<package>/package.json" -exec grep -H "\"version\"" {} +'
  ```

- [ ] If a tier 1 dependency or base image was fixed, the new images no longer contain the vulnerable version, using the image scan or SBOM attached to the release where available.
- [ ] If `types/` or `migrator/` changed, the **Publish Packages** run on `main` succeeded and `pnpm view @roostorg/coop-types version` or `pnpm view @roostorg/db-migrator version` shows the new version.

## 6. Publish the advisory

Publish each Coop advisory after the release, so that its patched version exists. Tier 1 vulnerabilities that are not exploitable get only a release note, not an advisory.

### Advisory template

- **Title:** `<Impact> via <vector>`, with the upstream package in parentheses for a dependency, e.g. `Denial of service via malformed request bodies (<package>)`.
- **Affected product:** ecosystem left empty, package `@roostorg/coop`, affected versions `< x.y.z` (narrower if older versions are not affected), patched versions `x.y.z`. Set these and the severity in the draft before step 4; a draft can be saved with them blank.
- **Severity:** CVSS scored for how Coop uses the affected code.
- **Description**: don't describe related components the release does not fix; if one needs its own fix, give it its own advisory. Use these sections:
  - `### Summary`: one or two sentences.
  - `### Details`: the affected component and why Coop is affected.
  - `### Proof of concept`: the steps in prose. No exploit code.
  - `### Impact`: who can exploit it and what they get.
  - `### Patches`: the fixed version and the fixing change.
  - `### Workarounds`: mitigations for deployments that cannot upgrade yet, or "None".
  - `### References`: the upstream advisory and CVE, the release, and the fix.

### CVEs

- Request a CVE only for a vulnerability in Coop's own code. For an upstream dependency issue that already has a CVE, reference the upstream CVE instead of requesting a new one.
- Requesting a CVE sends the advisory's content to GitHub for review, so request it from the draft advisory only once the draft passes the content checks in [Before publishing](#before-publishing), and before publishing it. GitHub usually reviews requests within 72 hours. Requesting does not make the advisory public, and GitHub publishes the CVE when the advisory is published. GitHub does not document requesting a CVE after publication, so request it while the advisory is a draft.
- Don't hold the release, the advisory or the announcement for the CVE. If it is assigned after publication, edit the GitHub release notes to add it next to the advisory. The email links the advisory page, which shows the CVE, so it need not be resent.

### Before publishing

- [ ] The description is rewritten in the template's form, including References; a reporter's draft is source material, not the published text.
- [ ] Affected and patched versions match the release.
- [ ] Severity and CVSS score are consistent with the Impact section, and the CWE is set.
- [ ] Credits are listed and every credited person has accepted.
- [ ] Then, for a vulnerability in Coop's own code, a CVE is requested from the draft (see [CVEs](#cves)).
- [ ] The release notes link the advisory.

## 7. Notify

### Hosted vendors early notice

Vendors who host Coop so that their users cannot self-patch can receive early notice (see [Security releases](https://community.roost.tools/software-development-practices/security#security-releases)).

- For an undisclosed vulnerability, tell them the release date and what to update before the release, under embargo.
- For an upstream CVE that is already public, tell them as soon as impact on Coop is confirmed, without waiting for the release.

### security-announce@roost.tools

Post to [security-announce@roost.tools](https://groups.google.com/a/roost.tools/g/security-announce) once the release and its advisories are published. The email lists only Coop advisories; upstream advisories without a Coop advisory are listed only in the release notes. A sent email cannot be corrected, so keep it to the facts in the templates below. Workarounds, impact details and upgrade caveats go in the release notes and the advisory, which can be edited.

| Situation               | Advisory | security-announce                                                                       | Release note |
| ----------------------- | -------- | --------------------------------------------------------------------------------------- | ------------ |
| Tier 1, exploitable     | Yes      | Yes                                                                                     | Yes          |
| Tier 1, not exploitable | No       | No                                                                                      | Yes          |
| Tier 2                  | No       | Yes: pull the new `docker-compose.yaml`, or update the image tag in your own deployment | Yes          |
| Tier 3                  | No       | Yes: the new minimum version and upgrade guidance                                       | Yes          |
| Tier 4                  | No       | No                                                                                      | If notable   |

### Upgrade wording

**Pending decision ([#1520](https://github.com/roostorg/coop/issues/1520), item 18):**

- An advisory rated High or Critical: "All deployments should upgrade."
- Otherwise: "We recommend you upgrade."

Don't qualify the wording by exposure (e.g. "if your API is public").

### Email templates

With one or more advisories:

```text
Subject: Security advisory for Coop: User action required

This is a security advisory for vulnerabilities discovered in the Coop project. Patches have been applied in the latest Coop release, version x.y.z. We recommend users upgrade.

The following vulnerabilities affect versions earlier than x.y.z:

* [GHSA-xxxx-xxxx-xxxx](https://github.com/roostorg/coop/security/advisories/GHSA-xxxx-xxxx-xxxx) (<Severity>, CVSS <n.n>)

Release notes: https://github.com/roostorg/coop/releases/tag/x.y.z
```

Keep the email to these lines, with one bullet per advisory: no workarounds, impact or remediation details.

No advisory (tier 2 or 3):

```text
Subject: Coop x.y.z: <component> security update

Coop x.y.z updates <component> to <version>, which fixes <CVE-…>. <What adopters need to do, e.g. pull the new docker-compose.yaml, or the new minimum version>.

Release notes: https://github.com/roostorg/coop/releases/tag/x.y.z
```

## 8. Forward-port to `main`

On option B:

- Cherry-pick any fix that merged into `release/x.y` from a private fork and is not yet on `main`, in a PR to `main` with a blank `## Release notes` section, since the fix shipped in `x.y.z`.
- Check the draft release for `main` and remove any entry for a fix that shipped in `x.y.z`.

## Checklist

- [ ] Every vulnerability in the release triaged privately; reachable ones have draft advisories
- [ ] Release base agreed (`main` or `release/x.y`) before any private-fork merge
- [ ] Fix merged (private fork or normal PR), with a regression test where possible; cherry-picks leave the lockfile unchanged under `pnpm install`
- [ ] Release notes written, in each fix PR and for the release
- [ ] Release `x.y.z` published from the agreed base
- [ ] Images (and npm packages, if changed) confirmed published
- [ ] Advisories published after the pre-publish checks
- [ ] Hosted vendors notified
- [ ] security-announce posted, if required
- [ ] If released from `release/x.y`: private-fork fixes forward-ported to `main`, and its draft release checked
