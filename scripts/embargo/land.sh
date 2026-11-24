#!/usr/bin/env bash
set -euo pipefail

# Lands reviewed embargoed work from a private copy of roostorg/coop as one
# squashed commit on top of current upstream main, pushed by explicit URL to a
# new branch on a GHSA temporary private fork or on roostorg/coop itself.

readonly PROG=land.sh
readonly UPSTREAM_URL=https://github.com/roostorg/coop.git
readonly PUBLIC_REPO=roostorg/coop
readonly GHSA_REPO_RE='^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)(roostorg/coop-ghsa-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4})(\.git)?/?$'

usage() {
  cat <<'EOF'
Usage:
  land.sh <branch> --ghsa <ghsa-fork-url> [options]
  land.sh <branch> --public [options]

Squashes a reviewed branch of a private copy of roostorg/coop into a single
commit on top of current upstream main and pushes it to a new branch on the
target: a GHSA temporary private fork (security fixes) or roostorg/coop itself
(partner features at embargo lift). Runs check-lineage.sh first and stops if
it fails. The rebase and squash happen in memory (git merge-tree): the working
tree, index and local branches are never changed, and a conflict leaves the
repository exactly as it was. Opens your git editor for the commit message,
which will be public once the work is disclosed. Dry-run unless --yes.
Needs git 2.40 or later.

Arguments:
  <branch>               Local branch with the reviewed work.

Options:
  --ghsa <url>           Push to this GHSA temporary private fork. Must be a
                         https://github.com/roostorg/coop-ghsa-xxxx-xxxx-xxxx
                         (or git@github.com:...) URL.
  --public               Push to https://github.com/roostorg/coop. Asks you
                         to type the target branch name to confirm.
  --remote-branch <name> Branch name to create on the target (default:
                         <branch>). It must not exist yet; never main.
  --yes                  Push. Without it, everything up to the push runs
                         and the push command is printed.
  --dry-run              Explicit default; no effect.
  -h, --help             Show this help.

Exactly one of --ghsa and --public is required.

Examples:
  land.sh fix-signal-validation --ghsa https://github.com/roostorg/coop-ghsa-abcd-efgh-ijkl
  land.sh fix-signal-validation --ghsa <ghsa-fork-url> --yes
  land.sh partner-feature --public --remote-branch feat/new-signal --yes
EOF
}

log() { printf '%s: %s\n' "$PROG" "$*" >&2; }
die() {
  printf '%s: error: %s\n' "$PROG" "$*" >&2
  exit 1
}
usage_error() {
  printf '%s: error: %s\n\n' "$PROG" "$*" >&2
  usage >&2
  exit 2
}

yes=0
run() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
  if ((yes)); then
    "$@"
  fi
}

branch=
ghsa_url=
public=0
remote_branch=
while (($#)); do
  case $1 in
    -h | --help)
      usage
      exit 0
      ;;
    --ghsa)
      (($# >= 2)) || usage_error "--ghsa needs a URL"
      ghsa_url=$2
      shift 2
      ;;
    --ghsa=*)
      ghsa_url=${1#--ghsa=}
      shift
      ;;
    --public)
      public=1
      shift
      ;;
    --remote-branch)
      (($# >= 2)) || usage_error "--remote-branch needs a name"
      remote_branch=$2
      shift 2
      ;;
    --remote-branch=*)
      remote_branch=${1#--remote-branch=}
      shift
      ;;
    --yes)
      yes=1
      shift
      ;;
    --dry-run) shift ;;
    -*) usage_error "unknown option: $1" ;;
    *)
      [[ -z $branch ]] || usage_error "unexpected argument: $1"
      branch=$1
      shift
      ;;
  esac
done

[[ -n $branch ]] || usage_error "missing <branch>"
if { [[ -n $ghsa_url ]] && ((public)); } || { [[ -z $ghsa_url ]] && ((!public)); }; then
  usage_error "exactly one of --ghsa and --public is required"
fi

command -v git >/dev/null || die "git is required"
git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository"

if [[ -n $ghsa_url ]]; then
  [[ $ghsa_url =~ $GHSA_REPO_RE ]] ||
    die "--ghsa must be a roostorg/coop-ghsa-* repository URL on github.com, got: $ghsa_url"
  target_repo=${BASH_REMATCH[2]}
  target_url="https://github.com/$target_repo.git"
  [[ ${BASH_REMATCH[1]} == https://github.com/ ]] || target_url="git@github.com:$target_repo.git"
else
  target_repo=$PUBLIC_REPO
  target_url=$UPSTREAM_URL
fi

git rev-parse --verify --quiet "refs/heads/$branch^{commit}" >/dev/null ||
  die "no local branch named '$branch'"
branch_sha=$(git rev-parse "refs/heads/$branch^{commit}")

: "${remote_branch:=$branch}"
git check-ref-format --branch "$remote_branch" >/dev/null 2>&1 ||
  die "invalid branch name: $remote_branch"
case $remote_branch in
  main | master | HEAD) die "refusing to push to '$remote_branch'; pick a new branch name with --remote-branch" ;;
esac

# 1-2. check-lineage.sh fetches upstream main by URL into
# refs/embargo/upstream/main and checks the branch against it. Landing onto
# that same ref means the base is exactly the one that was checked.
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
check_lineage=$script_dir/check-lineage.sh
[[ -x $check_lineage ]] || die "missing $check_lineage"
log "running check-lineage.sh (fetches upstream main)"
"$check_lineage" --rev "$branch_sha" "$branch" ||
  die "check-lineage.sh failed for '$branch'; nothing was changed"
upstream_sha=$(git rev-parse --verify --quiet "refs/embargo/upstream/main^{commit}") ||
  die "check-lineage.sh passed but refs/embargo/upstream/main is missing"
log "upstream main is $upstream_sha"

# 3. Rebase onto upstream main, in memory.
revs=$(git rev-list --reverse "$upstream_sha..$branch_sha")
commits=()
[[ -z $revs ]] || mapfile -t commits <<<"$revs"
((${#commits[@]})) || die "'$branch' has no commits that aren't on upstream main"
merge_base=$(git merge-base "$upstream_sha" "$branch_sha") ||
  die "'$branch' shares no history with upstream main"
merge_rc=0
merge_out=$(git merge-tree --write-tree --merge-base="$merge_base" \
  "$upstream_sha" "$branch_sha") || merge_rc=$?
case $merge_rc in
  0) ;;
  1)
    printf '%s\n' "$merge_out" | tail -n +2 >&2
    die "'$branch' conflicts with current upstream main; rebase it in the private copy, get it re-reviewed and run land.sh again. Nothing was changed"
    ;;
  *) die "git merge-tree failed (exit $merge_rc; land.sh needs git 2.40 or later)" ;;
esac
tree=$(head -n 1 <<<"$merge_out")
[[ $tree != "$(git rev-parse "$upstream_sha^{tree}")" ]] ||
  die "'$branch' makes no changes on top of upstream main (already landed?)"

# Checked before the editor so a taken name doesn't cost the message.
ls_remote_rc=0
git ls-remote --exit-code "$target_url" "refs/heads/$remote_branch" >/dev/null || ls_remote_rc=$?
case $ls_remote_rc in
  0) die "branch '$remote_branch' already exists on $target_repo; pick another with --remote-branch" ;;
  2) ;;
  *) log "warning: could not check whether '$remote_branch' exists on $target_repo; the push will refuse to overwrite it" ;;
esac

# 4. Commit message.
msg_dir=$(mktemp -d)
trap 'rm -rf -- "$msg_dir"' EXIT
msg_file=$msg_dir/COMMIT_EDITMSG
{
  for c in "${commits[@]}"; do
    git log -1 --format='%B' "$c"
    echo
  done
  first_author=$(git log -1 --format='%an <%ae>' "${commits[0]}")
  git log --format='%an <%ae>' "$upstream_sha..$branch_sha" | sort -u |
    while IFS= read -r a; do
      [[ $a == "$first_author" ]] || printf 'Co-authored-by: %s\n' "$a"
    done
  cat <<EOF
# WARNING: this message will be public. It becomes the commit message on
# $target_repo, and anyone can read it once the work is published.
# Remove anything that must stay private: vulnerability details beyond the
# advisory, partner names, private repository names, internal links.
#
# Lines starting with '#' are dropped. An empty message aborts.
# Squashing ${#commits[@]} commit(s) from '$branch' onto upstream main ${upstream_sha:0:12}.
EOF
} >"$msg_file"
editor=$(git var GIT_EDITOR)
# Same invocation git uses, so editors configured with arguments work.
sh -c "$editor \"\$@\"" "$editor" "$msg_file" || die "editor exited with an error; nothing was changed"
# The template's comments use '#' whatever core.commentChar says.
message=$(git -c core.commentChar='#' stripspace --strip-comments <"$msg_file")
[[ -n $message ]] || die "empty commit message; nothing was changed"

first=${commits[0]}
new_sha=$(
  GIT_AUTHOR_NAME=$(git log -1 --format=%an "$first") \
    GIT_AUTHOR_EMAIL=$(git log -1 --format=%ae "$first") \
    git commit-tree "$tree" -p "$upstream_sha" <<<"$message"
)

# 5. Show the result.
log "squashed commit $new_sha"
{
  echo
  git --no-pager log -1 --format='Author: %an <%ae>%n%n%B' "$new_sha"
  git --no-pager diff --stat "$upstream_sha" "$new_sha"
  echo
  echo "Target: $target_repo, new branch '$remote_branch'. The branch name and"
  echo "commit become public when the work is published."
  echo
} >&2

# 6. Push to a new branch on the target, by URL only.

if ((public)); then
  cat >&2 <<EOF

############################################################################
##  PUBLIC PUSH
##  This pushes to $PUBLIC_REPO, a public repository. The commit, its
##  message, its author and committer, and the branch name '$remote_branch' become visible
##  to everyone immediately and cannot be taken back.
##  Only continue if the embargo has been lifted.
############################################################################

EOF
  if ((yes)); then
    printf 'Type the branch name (%s) to push publicly: ' "$remote_branch" >&2
    answer=
    read -r answer || true
    [[ $answer == "$remote_branch" ]] || die "confirmation did not match; nothing was pushed"
  fi
fi

# An empty lease makes the push fail if the branch appeared since the check.
run git push --force-with-lease="refs/heads/$remote_branch:" "$target_url" \
  "$new_sha:refs/heads/$remote_branch"

# 7. Where to open the PR.
compare_url="https://github.com/$target_repo/compare/main...$remote_branch?expand=1"
if ((yes)); then
  log "pushed $new_sha to $target_repo as '$remote_branch'"
  printf 'Open the PR: %s\n' "$compare_url"
else
  log "dry run: nothing was pushed. Re-run with --yes to push."
  printf 'After pushing, open the PR: %s\n' "$compare_url"
fi
