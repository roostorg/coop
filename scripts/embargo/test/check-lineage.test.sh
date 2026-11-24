#!/usr/bin/env bash
#
# Tests for scripts/embargo/check-lineage.sh against throwaway repositories:
# an "upstream" bare repo, a "private" bare repo mirroring it, and a working
# clone of the private repo.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/embargo/test/check-lineage.test.sh [-h|--help]

Builds throwaway git repositories in a temporary directory and runs
scripts/embargo/check-lineage.sh against a passing branch and each failure
mode. Prints one ok/not ok line per case; exits non-zero if any case fails.
EOF
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  '') ;;
  *)
    usage >&2
    exit 2
    ;;
esac

script="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-lineage.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
unset GITHUB_ACTIONS

failed=0
case_no=0
out=''
status=0

ok() {
  case_no=$((case_no + 1))
  echo "ok $case_no - $1"
}

not_ok() {
  case_no=$((case_no + 1))
  failed=1
  echo "not ok $case_no - $1"
  echo "# ${out//$'\n'/$'\n# '}"
}

# commit <message>: makes a commit touching a file named after the message.
commit() {
  echo "$1" >"${1// /-}.txt"
  git add -A
  git commit -q -m "$1"
}

# setup: fresh upstream (with a --no-ff merge on main), private mirror and work
# clone; leaves the shell in the work clone with `upstream` as a remote.
setup() {
  local dir
  dir=$(mktemp -d "$tmp/case.XXXX")
  git init -q --bare -b main "$dir/upstream.git"
  git init -q --bare -b main "$dir/private.git"
  git clone -q "$dir/upstream.git" "$dir/seed" 2>/dev/null
  (
    cd "$dir/seed"
    commit 'up one'
    git checkout -q -b side
    commit 'up side'
    git checkout -q main
    commit 'up two'
    git merge -q --no-ff -m 'up merge side' side
    commit 'up three'
    git push -q origin main
    git push -q "$dir/private.git" main
  )
  git clone -q "$dir/private.git" "$dir/work"
  cd "$dir/work"
  git remote add upstream "$dir/upstream.git"
  git fetch -q upstream
  upstream_url="$dir/upstream.git"
}

run() {
  status=0
  out=$("$script" --upstream-url "$upstream_url" "$@" 2>&1) || status=$?
}

# expect <name> <status> [<regex>...]: the last run exited <status> and its
# output matched every regex.
expect() {
  local name="$1" want="$2" re
  shift 2
  if [[ "$status" -ne "$want" ]]; then
    not_ok "$name (exit $status, want $want)"
    return
  fi
  for re in "$@"; do
    if ! grep -qE -- "$re" <<<"$out"; then
      not_ok "$name (output does not match: $re)"
      return
    fi
  done
  ok "$name"
}

# --- pass ---------------------------------------------------------------------

setup
git checkout -q -b fix upstream/main
commit 'fix one'
commit 'fix two'
git push -q origin fix
run fix
expect 'clean branch passes' 0 'OK: 2 commit\(s\) on fix' 'PASS \[1\]' 'PASS \[2a\]' 'PASS \[2b\]' 'PASS \[3\]'
if [[ "$(git rev-parse refs/embargo/upstream/main)" == "$(git rev-parse upstream/main)" ]]; then
  ok 'upstream main is left at refs/embargo/upstream/main'
else
  out=''
  not_ok 'upstream main is left at refs/embargo/upstream/main'
fi

setup
git checkout -q -b fix upstream/main
commit 'fix one'
git push -q origin fix
(
  cd ../seed
  commit 'up four'
  git push -q origin main
)
run fix
expect 'passes when private main and the branch are behind upstream main' 0 'OK: 1 commit'

setup
git checkout -q -b fix upstream/main
commit 'fix one'
run --rev HEAD fix
expect '--rev passes for a branch that is not on the remote' 0 'OK: 1 commit'
git push -q origin fix
commit 'fix two'
run --rev HEAD fix
expect '--rev excludes the remote copy of the same branch from 2b' 0 'OK: 2 commit'

# --- failures -----------------------------------------------------------------

setup
git checkout -q main
commit 'private only'
git push -q origin main
git checkout -q -b fix upstream/main
commit 'fix one'
git push -q origin fix
run fix
expect 'private main ahead of upstream fails check 1' 1 'FAIL \[1\]' '^  [0-9a-f]+ private only$' 'PASS \[2b\]'

setup
git checkout -q -b fix "$(git rev-parse 'upstream/main^^2')"
commit 'fix one'
git push -q origin fix
run fix
expect 'base on a merged side branch fails check 2a' 1 'FAIL \[2a\]' '^  [0-9a-f]+ up side$'

setup
git checkout -q -b other upstream/main
commit 'other one'
git push -q origin other
git checkout -q -b fix
commit 'fix one'
git push -q origin fix
run fix
expect 'branch built on another unlanded branch fails check 2b' 1 'FAIL \[2b\]' '^  [0-9a-f]+ other one$' 'also on: origin/other'
if grep -qE '^  [0-9a-f]+ fix one$' <<<"$out"; then
  not_ok 'check 2b names only the shared commits'
else
  ok 'check 2b names only the shared commits'
fi
run other
expect 'branch another branch was built on fails check 2b' 1 'FAIL \[2b\]' 'also on: origin/fix'

setup
git checkout -q -b fix upstream/main
commit 'fix one'
git checkout -q -b topic upstream/main
commit 'topic one'
git checkout -q fix
git merge -q --no-ff -m 'merge topic' topic
git push -q origin fix
run fix
expect 'merge commit fails check 3' 1 'FAIL \[3\]' '^  [0-9a-f]+ merge topic$' 'PASS \[2b\]'

setup
git checkout -q -b fix upstream/main
git push -q origin fix
run fix
expect 'branch with nothing to land fails' 1 'FAIL \[range\]: .*nothing to land'

setup
git checkout -q main
commit 'private only'
git push -q origin main
git checkout -q -b other upstream/main
commit 'other one'
git push -q origin other
git checkout -q -b fix
git merge -q --no-ff -m 'merge main' main
git push -q origin fix
run fix
expect 'every violation is reported' 1 'FAIL \[1\]' 'FAIL \[2b\]' 'FAIL \[3\]' '3 check\(s\) failed'

setup
git checkout -q -b fix upstream/main
commit 'fix one'
git push -q origin fix
git checkout -q -b other
commit 'other one'
git push -q origin other
git fetch -q origin
git --git-dir=../private.git branch -q -D other
run --no-fetch-remote fix
expect '--no-fetch-remote uses existing remote-tracking refs' 1 'FAIL \[2b\]' 'also on: origin/other'
run fix
expect 'fetching the remote prunes deleted branches' 0 'OK: 1 commit'

setup
git checkout -q -b fix upstream/main
commit '::error::injected'
git checkout -q -b topic upstream/main
commit 'topic one'
git checkout -q fix
git merge -q --no-ff -m 'merge topic' topic
git push -q origin fix
status=0
out=$(GITHUB_ACTIONS=true "$script" --upstream-url "$upstream_url" fix 2>&1) || status=$?
expect 'emits annotations and stops workflow commands under GitHub Actions' 1 \
  '^::stop-commands::check-lineage-[0-9a-f]{32}$' '^::check-lineage-[0-9a-f]{32}::$' '^::error title=Lineage check 3 failed::'
if [[ "$(grep -c '^::error' <<<"$out")" -eq 1 ]]; then
  ok 'commit text cannot add annotations'
else
  not_ok 'commit text cannot add annotations'
fi

# --- usage and environment errors ----------------------------------------------

setup
run missing
expect 'missing branch is an environment error' 2 'no branch missing on origin'
run
expect 'no branch argument is a usage error' 2 'Usage:'
run --bogus fix
expect 'unknown option is a usage error' 2 'unknown option: --bogus'
run --rev
expect 'option without a value is a usage error' 2 '--rev needs a value'
run a b
expect 'two branch arguments is a usage error' 2 'unexpected argument: b'
run 'bad..name'
expect 'invalid branch name is a usage error' 2 'not a valid branch name'
run --rev no-such-rev main
expect 'unresolvable --rev is an environment error' 2 'could not resolve --rev'
status=0
out=$("$script" --upstream-url "$tmp/does-not-exist.git" main 2>&1) || status=$?
expect 'upstream fetch failure is an environment error' 2 'could not fetch main from'
run --remote nowhere main
expect 'unknown remote is an environment error' 2 'no such remote: nowhere'
git clone -q --depth 1 "file://$(git remote get-url origin)" ../shallow 2>/dev/null
cd ../shallow
run main
expect 'shallow clone is an environment error' 2 'shallow clone'
status=0
out=$("$script" --help 2>&1) || status=$?
expect '--help exits 0' 0 '^Usage: scripts/embargo/check-lineage.sh'

echo "1..$case_no"
exit "$failed"
