Coop is an open-source project. When working on GitHub Actions, remember that PRs will be opened by external contributors who have forked the main repo. Workflows that run on PRs should also work on these forks, i.e. they should not require permissions from the main repo.

Forks and private copies of this repository run these workflows too. Guard every job that publishes or sends anything outside the repository (GHCR, npm, GitHub Pages, Discord) with `if: github.repository == 'roostorg/coop'`; for Codecov, guard only the upload steps so tests still run.
