#!/usr/bin/env bash
#
# Checks that a branch in a private copy of roostorg/coop contains only
# upstream history plus its own commits, so it can land publicly without
# carrying anything else from the private copy.

set -euo pipefail

readonly DEFAULT_UPSTREAM_URL='https://github.com/roostorg/coop.git'
readonly UPSTREAM_REF='refs/embargo/upstream/main'
readonly PROG='check-lineage'

usage() {
  cat <<'EOF'
Usage: scripts/embargo/check-lineage.sh [options] <branch>

Checks that <branch> in a private copy of roostorg/coop contains only upstream
history plus its own commits. Fetches upstream main itself, into
refs/embargo/upstream/main, and checks:

  1   <remote>/main is an ancestor of, or equal to, upstream main.
  2a  merge-base(<branch>, upstream main) is on upstream main's first-parent
      history.
  2b  Every commit in upstream/main..<branch> is reachable from no other
      branch of <remote>. <remote>/<branch> itself is skipped only when it
      is an ancestor of (or equal to) the tip being checked.
  3   No merge commits in upstream/main..<branch>.

It also fails when upstream/main..<branch> is empty: there is nothing to land.
Every check runs; all violations are reported, naming the offending commits.

Arguments:
  <branch>             Branch name on <remote>, without refs/heads/.

Options:
  --remote NAME        Remote of the private copy (default: origin).
  --rev REV            Check REV as the tip of <branch> instead of
                       <remote>/<branch>.
  --upstream-url URL   Upstream repository to fetch main from
                       (default: https://github.com/roostorg/coop.git).
  --no-fetch-remote    Use the existing refs/remotes/<remote>/* instead of
                       fetching <remote> first. Upstream is always fetched.
  -h, --help           Show this help.

Examples:
  scripts/embargo/check-lineage.sh fix-something
  scripts/embargo/check-lineage.sh --rev "$(git rev-parse fix-something)" fix-something

Exit codes:
  0  All checks passed.
  1  At least one lineage check failed.
  2  Usage or environment error (bad arguments, fetch failure, missing ref,
     shallow clone).

Only refs/embargo/upstream/main and <remote>'s remote-tracking refs are
written; nothing is pushed.
EOF
}

die() {
  echo "$PROG: error: $*" >&2
  exit 2
}

remote='origin'
rev=''
upstream_url="$DEFAULT_UPSTREAM_URL"
fetch_remote=1
branch=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --remote | --rev | --upstream-url)
      [[ $# -ge 2 && -n "$2" ]] || die "$1 needs a value (see --help)"
      case "$1" in
        --remote) remote="$2" ;;
        --rev) rev="$2" ;;
        --upstream-url) upstream_url="$2" ;;
      esac
      shift 2
      ;;
    --no-fetch-remote)
      fetch_remote=0
      shift
      ;;
    --)
      shift
      break
      ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *)
      [[ -z "$branch" ]] || die "unexpected argument: $1 (see --help)"
      branch="$1"
      shift
      ;;
  esac
done
if [[ $# -gt 0 ]]; then
  [[ -z "$branch" && $# -eq 1 ]] || die "unexpected argument: ${2:-$1} (see --help)"
  branch="$1"
fi
[[ -n "$branch" ]] || {
  usage >&2
  exit 2
}
branch="${branch#refs/heads/}"

command -v git >/dev/null || die 'git is required'
git check-ref-format --branch "$branch" >/dev/null 2>&1 || die "not a valid branch name: $branch"
git rev-parse --git-dir >/dev/null 2>&1 || die 'not inside a git repository'
[[ "$(git rev-parse --is-shallow-repository)" == 'false' ]] ||
  die 'the repository is a shallow clone; lineage needs full history (git fetch --unshallow)'

# Any failure not handled explicitly is an environment error, never a pass.
trap 'echo "$PROG: error: unexpected failure at line $LINENO" >&2; exit 2' ERR

if [[ "$fetch_remote" -eq 1 ]]; then
  git remote get-url "$remote" >/dev/null 2>&1 || die "no such remote: $remote"
  echo "$PROG: fetching $remote"
  git fetch --quiet --prune --no-tags "$remote" || die "could not fetch $remote"
fi

echo "$PROG: fetching upstream main from $upstream_url"
git fetch --quiet --no-tags --no-write-fetch-head "$upstream_url" "+refs/heads/main:$UPSTREAM_REF" ||
  die "could not fetch main from $upstream_url"

resolve() {
  git rev-parse --verify --quiet "$1^{commit}" || die "$2"
}

upstream=$(resolve "$UPSTREAM_REF" "could not resolve $UPSTREAM_REF")
private_main=$(resolve "refs/remotes/$remote/main" "no branch main on $remote (refs/remotes/$remote/main)")
if [[ -n "$rev" ]]; then
  tip=$(resolve "$rev" "could not resolve --rev $rev to a commit")
else
  tip=$(resolve "refs/remotes/$remote/$branch" "no branch $branch on $remote (refs/remotes/$remote/$branch)")
fi

# Commit subjects are attacker-influenced text; stop GitHub Actions from
# interpreting them as workflow commands while they are printed.
gha_token=''
if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
  gha_token="check-lineage-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  echo "::stop-commands::$gha_token"
fi

failures=()

fail() {
  local id="$1" summary="$2"
  failures+=("$id"$'\t'"$summary")
  echo "$PROG: FAIL [$id]: $summary" >&2
}

pass() {
  echo "$PROG: PASS [$1]: $2"
}

list_commits() {
  local c line
  for c in "$@"; do
    line=$(git log -1 --no-show-signature --format='%h %s' "$c")
    echo "  $line" >&2
  done
}

short() {
  git rev-parse --short "$1"
}

echo "$PROG: checking $branch ($(short "$tip")) against upstream main ($(short "$upstream")), private main ($(short "$private_main"))"

# 1. Private main mirrors upstream.
if git merge-base --is-ancestor "$private_main" "$upstream"; then
  pass 1 "$remote/main is upstream main or an ancestor of it"
else
  out=$(git rev-list --reverse "$upstream..$private_main")
  extra=()
  [[ -z "$out" ]] || mapfile -t extra <<<"$out"
  fail 1 "$remote/main has ${#extra[@]} commit(s) that are not on upstream main; the private main must only mirror upstream (fix the mirror before landing anything):"
  list_commits "${extra[@]}"
fi

out=$(git rev-list --reverse "$upstream..$tip")
range=()
[[ -z "$out" ]] || mapfile -t range <<<"$out"

if [[ ${#range[@]} -eq 0 ]]; then
  fail range "$branch has no commits that are not already on upstream main: nothing to land"
fi

# 2a. The branch starts from upstream main itself.
out=$(git merge-base --all "$tip" "$upstream") || out=''
bases=()
[[ -z "$out" ]] || mapfile -t bases <<<"$out"
first_parents=$(git rev-list --first-parent "$upstream")
if [[ ${#bases[@]} -eq 0 ]]; then
  fail 2a "$branch shares no history with upstream main"
elif [[ ${#bases[@]} -gt 1 ]]; then
  fail 2a "$branch has ${#bases[@]} merge bases with upstream main; it must start from a single upstream main commit:"
  list_commits "${bases[@]}"
elif grep -qxF "${bases[0]}" <<<"$first_parents"; then
  pass 2a "$branch is based on upstream main commit $(short "${bases[0]}")"
else
  fail 2a "$branch is based on $(short "${bases[0]}"), which is upstream history but not a commit of upstream main itself (it is on a merged side branch); rebase onto upstream main:"
  list_commits "${bases[0]}"
fi

# 2b. No commit in the range is shared with another branch of the private copy.
# <remote>/<branch> is this branch's own pushed copy only when it is an
# ancestor of (or equal to) the tip; otherwise it is compared like any other.
own="refs/remotes/$remote/$branch"
if ! git rev-parse --verify --quiet "$own^{commit}" >/dev/null ||
  ! git merge-base --is-ancestor "$own" "$tip"; then
  own=''
fi
out=$(git for-each-ref --format='%(refname)' "refs/remotes/$remote/")
refs=()
[[ -z "$out" ]] || mapfile -t refs <<<"$out"
others=()
for r in "${refs[@]}"; do
  [[ "$r" == "refs/remotes/$remote/HEAD" || "$r" == "$own" ]] || others+=("$r")
done
shared=0
if [[ ${#range[@]} -gt 0 && ${#others[@]} -gt 0 ]]; then
  for c in "${range[@]}"; do
    out=$(git for-each-ref --contains "$c" --format='%(refname:short)' "${others[@]}")
    holders=()
    [[ -z "$out" ]] || mapfile -t holders <<<"$out"
    [[ ${#holders[@]} -gt 0 ]] || continue
    if [[ "$shared" -eq 0 ]]; then
      fail 2b "commits on $branch are also on other branches of $remote; a branch must hold only its own commits on top of upstream main (e.g. it was built on another unlanded branch, or another branch was built on it):"
    fi
    shared=$((shared + 1))
    list_commits "$c"
    printf '    also on: %s\n' "${holders[@]}" >&2
  done
fi
if [[ "$shared" -eq 0 ]]; then
  pass 2b "no commit on $branch is on any other branch of $remote"
fi

# 3. Linear history only.
out=$(git rev-list --reverse --min-parents=2 "$upstream..$tip")
merges=()
[[ -z "$out" ]] || mapfile -t merges <<<"$out"
if [[ ${#merges[@]} -eq 0 ]]; then
  pass 3 "no merge commits on $branch"
else
  fail 3 "$branch contains ${#merges[@]} merge commit(s); rebase onto upstream main instead of merging:"
  list_commits "${merges[@]}"
fi

if [[ -n "$gha_token" ]]; then
  echo "::$gha_token::"
  for f in "${failures[@]}"; do
    msg=${f#*$'\t'}
    msg=${msg//%/%25}
    msg=${msg//$'\r'/%0D}
    msg=${msg//$'\n'/%0A}
    echo "::error title=Lineage check ${f%%$'\t'*} failed::$msg"
  done
fi

if [[ ${#failures[@]} -gt 0 ]]; then
  echo "$PROG: ${#failures[@]} check(s) failed for $branch; details above"
  exit 1
fi
echo "$PROG: OK: ${#range[@]} commit(s) on $branch, based on upstream main $(short "${bases[0]}")"
