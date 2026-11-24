#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/embargo/sync-upstream.sh [options]

Fast-forward a private copy's branch to upstream roostorg/coop, and copy
upstream tags it doesn't have yet. Run it from any clone of the private copy.

It never merges, rebases or force-pushes. If the private branch has commits
that aren't on upstream (it isn't an ancestor of upstream), the script stops
with an error: someone committed to the mirror, and a human has to look.
An existing tag that points somewhere else than upstream's tag of the same
name is also an error; it is never moved.

The branch and the new tags are pushed in one atomic push: if the private
copy rejects any of them (for example a tag ruleset), nothing is pushed.

Without --yes it only reports what it would push.

Options:
  --upstream <url>   Upstream repository (default: https://github.com/roostorg/coop.git)
  --remote <name>    Remote or URL of the private copy (default: origin)
  --branch <name>    Branch to fast-forward, on both sides (default: main)
  --yes              Push. Without it, nothing is pushed.
  -h, --help         Show this help.

Exit status: 0 when the private copy is (or would be) in sync, 1 when the
branch has diverged, a tag conflicts or the push fails, 2 on a usage error.
EOF
}

usage_error() {
  echo "$1" >&2
  usage >&2
  exit 2
}

upstream=https://github.com/roostorg/coop.git
remote=origin
branch=main
apply=false

option_value() {
  if [[ $# -lt 2 || -z $2 || $2 == -* ]]; then
    usage_error "$1 needs a value"
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --upstream)
      option_value "$@"
      upstream=$2
      shift 2
      ;;
    --remote)
      option_value "$@"
      remote=$2
      shift 2
      ;;
    --branch)
      option_value "$@"
      branch=$2
      shift 2
      ;;
    --yes)
      apply=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage_error "Unknown argument: $1"
      ;;
  esac
done

summary() {
  echo "$*"
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    echo "$*" >>"$GITHUB_STEP_SUMMARY"
  fi
}

error() {
  if [[ ${GITHUB_ACTIONS:-} == true ]]; then
    echo "::error::$*"
  else
    echo "error: $*" >&2
  fi
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    echo "**Error:** $*" >>"$GITHUB_STEP_SUMMARY"
  fi
}

git rev-parse --git-dir >/dev/null

# Work in a temporary ref namespace so nothing touches the clone's own
# branches, tags or remote-tracking refs, and remove it on exit.
ns=refs/embargo-sync
clean_refs() {
  git for-each-ref --format='delete %(refname)' "$ns/" | git update-ref --stdin
}
clean_refs
trap clean_refs EXIT

if ! git fetch --quiet --no-tags "$upstream" \
  "+refs/heads/$branch:$ns/upstream/branch" \
  "+refs/tags/*:$ns/upstream/tags/*"; then
  error "Could not fetch $branch and tags from upstream $upstream."
  exit 1
fi
if ! git fetch --quiet --no-tags "$remote" "+refs/heads/$branch:$ns/private/branch"; then
  error "Could not fetch $branch from the private copy ($remote). Does the branch exist there?"
  exit 1
fi

upstream_sha=$(git rev-parse "$ns/upstream/branch")
private_sha=$(git rev-parse "$ns/private/branch")
push_branch=false

if [[ $private_sha == "$upstream_sha" ]]; then
  summary "$branch is up to date with upstream ($upstream_sha)."
elif git merge-base --is-ancestor "$private_sha" "$upstream_sha"; then
  push_branch=true
  count=$(git rev-list --count "$private_sha..$upstream_sha")
  summary "$branch can fast-forward $count commit(s): $private_sha -> $upstream_sha."
else
  ahead=$(git rev-list --count "$upstream_sha..$private_sha")
  error "$branch has diverged from upstream: it has $ahead commit(s) that upstream $branch doesn't. Nothing was pushed. Commits on the mirror's $branch must come from upstream; a human has to look at these and move them to another branch."
  commits=$(git log --oneline --no-decorate --max-count=50 "$upstream_sha..$private_sha")
  echo "$commits" >&2
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    fence='```'
    printf '\n%s\n%s\n%s\n' "$fence" "$commits" "$fence" >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 1
fi

# Tags: copy the ones the private copy lacks, report the ones that differ.
declare -A private_tags=()
while read -r sha ref; do
  private_tags[${ref#refs/tags/}]=$sha
done < <(git ls-remote --tags --refs "$remote")

new_tags=()
conflicts=()
while read -r sha ref; do
  name=${ref#"$ns"/upstream/tags/}
  if [[ -z ${private_tags[$name]+set} ]]; then
    new_tags+=("$name")
  elif [[ ${private_tags[$name]} != "$sha" ]]; then
    conflicts+=("$name")
  fi
done < <(git for-each-ref --format='%(objectname) %(refname)' "$ns/upstream/tags/")

if [[ ${#new_tags[@]} -gt 0 ]]; then
  summary "${#new_tags[@]} upstream tag(s) to copy: ${new_tags[*]}"
fi

refspecs=()
if $push_branch; then
  refspecs+=("$ns/upstream/branch:refs/heads/$branch")
fi
for name in "${new_tags[@]}"; do
  refspecs+=("$ns/upstream/tags/$name:refs/tags/$name")
done

if [[ ${#refspecs[@]} -eq 0 ]]; then
  :
elif $apply; then
  # Never --force and never a '+' refspec: git itself refuses to push a
  # branch update that isn't a fast-forward or to move an existing tag,
  # including when another push lands between the fetch and this push.
  if ! git push --atomic "$remote" "${refspecs[@]}"; then
    error "Push to the private copy failed; nothing was pushed. If another push landed on $branch since the fetch, re-run; if the copy rejected a ref, check its rulesets."
    exit 1
  fi
  summary "Pushed ${#refspecs[@]} ref(s)."
else
  summary "Dry run, nothing pushed. Re-run with --yes to push."
fi

if [[ ${#conflicts[@]} -gt 0 ]]; then
  error "${#conflicts[@]} tag(s) exist in the private copy but point somewhere other than upstream's tag of the same name: ${conflicts[*]}. They were left alone; a human has to look."
  exit 1
fi
