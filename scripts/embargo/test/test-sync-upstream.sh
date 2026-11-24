#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/embargo/test/test-sync-upstream.sh [-h|--help]

Tests scripts/embargo/sync-upstream.sh against two local bare repositories,
one standing in for upstream and one for the private copy. Needs only git and
bash; no network. Exits non-zero if any case fails.
EOF
}

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
  usage
  exit 0
fi

sync=$(cd "$(dirname "$0")/.." && pwd)/sync-upstream.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
unset GITHUB_ACTIONS GITHUB_STEP_SUMMARY

failures=0
pass() { echo "ok - $*"; }
fail() {
  echo "not ok - $*"
  failures=$((failures + 1))
}

# Fresh upstream and private bare repos with the same history, a work clone
# of each to make commits, and a runner clone of the private copy to run the
# script from, like the workflow's checkout.
setup() {
  rm -rf "$tmp/case"
  mkdir -p "$tmp/case"
  cd "$tmp/case"
  git init --quiet --bare --initial-branch=main upstream.git
  git clone --quiet upstream.git up 2>/dev/null
  commit up base
  git -C up tag 1.0.0
  git -C up tag -a -m 'release 1.1.0' 1.1.0
  git -C up push --quiet origin main --tags
  git clone --quiet --bare upstream.git private.git
  git clone --quiet private.git priv
  git clone --quiet private.git runner
}

commit() {
  echo "$2" >>"$1/file"
  git -C "$1" add file
  git -C "$1" commit --quiet -m "$2"
}

run_sync() {
  (cd runner && bash "$sync" --upstream ../upstream.git "$@")
}

ref() { git -C "$1" rev-parse --verify --quiet "$2" || echo none; }

expect_exit() {
  local want=$1 name=$2
  shift 2
  local got=0
  run_sync "$@" >"$tmp/out" 2>&1 || got=$?
  if [[ $got == "$want" ]]; then
    pass "$name exits $want"
  else
    fail "$name exits $got, want $want"
    sed 's/^/    /' "$tmp/out"
  fi
}

expect_eq() {
  if [[ $2 == "$3" ]]; then pass "$1"; else fail "$1: got '$2', want '$3'"; fi
}

# Up to date: nothing to do.
setup
before=$(ref private.git main)
expect_exit 0 'up to date'
expect_eq 'up to date leaves main alone' "$(ref private.git main)" "$before"

# Behind: dry run pushes nothing; --yes fast-forwards and copies new tags.
setup
commit up feature-1
commit up feature-2
git -C up tag 1.2.0
git -C up tag -a -m 'release 1.3.0' 1.3.0
git -C up push --quiet origin main --tags
before=$(ref private.git main)
expect_exit 0 'behind, dry run'
expect_eq 'dry run leaves main alone' "$(ref private.git main)" "$before"
expect_eq 'dry run copies no tags' "$(ref private.git refs/tags/1.2.0)" none
expect_exit 0 'behind, --yes' --yes
expect_eq 'fast-forwards main to upstream' "$(ref private.git main)" "$(ref upstream.git main)"
expect_eq 'copies lightweight tag' "$(ref private.git refs/tags/1.2.0)" "$(ref upstream.git refs/tags/1.2.0)"
expect_eq 'copies annotated tag' "$(ref private.git refs/tags/1.3.0)" "$(ref upstream.git refs/tags/1.3.0)"
expect_exit 0 'second run after sync'

# Diverged: both sides have new commits. Fails and pushes nothing.
setup
commit up upstream-change
git -C up push --quiet origin main
commit priv mirror-change
git -C priv push --quiet origin main
before=$(ref private.git main)
expect_exit 1 'diverged' --yes
expect_eq 'diverged leaves main alone' "$(ref private.git main)" "$before"
if grep -q 'mirror-change' "$tmp/out"; then
  pass 'diverged lists the mirror-only commit'
else
  fail 'diverged lists the mirror-only commit'
fi

# Ahead: a commit on the mirror, upstream unchanged. Also divergence.
setup
commit priv mirror-change
git -C priv push --quiet origin main
before=$(ref private.git main)
expect_exit 1 'ahead of upstream' --yes
expect_eq 'ahead leaves main alone' "$(ref private.git main)" "$before"

# Diverged with new upstream tags: the tags aren't copied either.
setup
commit up upstream-change
git -C up tag 1.2.0
git -C up push --quiet origin main --tags
commit priv mirror-change
git -C priv push --quiet origin main
expect_exit 1 'diverged with new tags' --yes
expect_eq 'diverged copies no tags' "$(ref private.git refs/tags/1.2.0)" none

# Tag conflict: the private copy has its own tag with an upstream tag's name.
# main still fast-forwards and other tags are copied; the conflicting tag
# stays where it was and the run fails.
setup
commit priv private-release
git -C priv tag 1.2.0
git -C priv push --quiet origin refs/tags/1.2.0
private_tag=$(ref private.git refs/tags/1.2.0)
commit up upstream-change
git -C up tag 1.2.0
git -C up tag 1.3.0
git -C up push --quiet origin main --tags
expect_exit 1 'tag conflict' --yes
expect_eq 'tag conflict leaves the tag alone' "$(ref private.git refs/tags/1.2.0)" "$private_tag"
expect_eq 'tag conflict still fast-forwards main' "$(ref private.git main)" "$(ref upstream.git main)"
expect_eq 'tag conflict still copies other tags' "$(ref private.git refs/tags/1.3.0)" "$(ref upstream.git refs/tags/1.3.0)"

# The runner clone's own branches and tags are untouched.
setup
commit up upstream-change
git -C up push --quiet origin main
runner_main=$(ref runner main)
expect_exit 0 'runner clone' --yes
expect_eq 'runner main untouched' "$(ref runner main)" "$runner_main"
expect_eq 'runner gets no tags' "$(git -C runner tag --list 1.2.0)" ''

# Usage.
setup
expect_exit 2 'unknown argument' --bogus
expect_exit 0 '--help' --help

if [[ $failures -gt 0 ]]; then
  echo "$failures failure(s)"
  exit 1
fi
echo 'all passed'
