#!/usr/bin/env bash
set -euo pipefail

# Exercises new-embargo-repo.sh without touching GitHub. gh is replaced by a
# stub that logs every call and answers the read-only checks per $GH_SCENARIO;
# git is real, with the upstream and target URLs rewritten to local bare repos
# via url.<base>.insteadOf.

usage() {
  cat <<'EOF'
Usage:
  new-embargo-repo.test.sh

Runs new-embargo-repo.sh against a stub gh and throwaway local repositories
in a temporary directory and reports each case. Exits non-zero if any case
fails.

Options:
  -h, --help  Show this help.
EOF
}
case ${1:-} in
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

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
script=$here/../new-embargo-repo.sh

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT

readonly ORG=example-org NAME=example-private TEAM=example-team
export HOME=$tmp/home GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Tester GIT_AUTHOR_EMAIL=tester@example.com
export GIT_COMMITTER_NAME=Tester GIT_COMMITTER_EMAIL=tester@example.com
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_0=url.$tmp/up.git.insteadOf GIT_CONFIG_VALUE_0=https://github.com/roostorg/coop.git
export GIT_CONFIG_KEY_1=url.$tmp/target.git.insteadOf GIT_CONFIG_VALUE_1=https://github.com/$ORG/$NAME.git
export GIT_CONFIG_KEY_2=init.defaultBranch GIT_CONFIG_VALUE_2=main
mkdir -p "$HOME" "$tmp/bin"

# Upstream with main, a tag, another branch and a pull request ref. Only main
# and the tag may reach the target.
git init --quiet --bare "$tmp/up.git"
git init --quiet "$tmp/work"
git -C "$tmp/work" commit --quiet --allow-empty -m base
git -C "$tmp/work" tag -a 1.0.0 -m 1.0.0
git -C "$tmp/work" commit --quiet --allow-empty -m side
git -C "$tmp/work" push --quiet "$tmp/up.git" HEAD~1:refs/heads/main HEAD:refs/heads/feature \
  HEAD:refs/pull/1/head 1.0.0

cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$GH_LOG"
if [[ " $* " == *" --input - "* ]]; then cat >>"$GH_LOG"; fi
not_found() {
  echo "gh: Not Found (HTTP 404)" >&2
  exit 1
}
case "$*" in
  "auth status") ;;
  "repo create "*) git init --quiet --bare "$TARGET" ;;
  "api repos/$REPO --jq .full_name")
    [[ $GH_SCENARIO == exists ]] || not_found
    echo "$REPO"
    ;;
  "api orgs/"*"/teams/"*" --jq .slug")
    [[ $GH_SCENARIO != noteam ]] || not_found
    echo team
    ;;
  "api orgs/"*"/properties/schema/embargo "*)
    case $GH_SCENARIO in
      noprop) not_found ;;
      novalue) printf 'single_select\tsecurity\n' ;;
      multiselect) printf 'multi_select\tsecurity partner\n' ;;
      *) printf 'single_select\tsecurity partner\n' ;;
    esac
    ;;
  "api repos/$REPO/pages --silent") [[ $GH_SCENARIO == pages ]] || not_found ;;
  "api --method PUT "*)
    [[ $GH_SCENARIO != failput ]] || {
      echo "gh: Forbidden (HTTP 403)" >&2
      exit 1
    }
    ;;
  "api --method "*) ;;
  *)
    echo "unexpected gh call: $*" >&2
    exit 99
    ;;
esac
EOF
chmod +x "$tmp/bin/gh"
export PATH=$tmp/bin:$PATH GH_LOG=$tmp/gh.log REPO=$ORG/$NAME TARGET=$tmp/target.git

failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() {
  printf 'FAIL %s\n' "$1"
  [[ -z ${2:-} ]] || printf '     %s\n' "$2"
  failures=$((failures + 1))
}

# run_case <scenario> <args...>: runs the script, sets $rc, $out, $err.
run_case() {
  export GH_SCENARIO=$1
  shift
  rm -rf -- "$TARGET" "$GH_LOG"
  : >"$GH_LOG"
  rc=0
  "$script" "$@" >"$tmp/out" 2>"$tmp/err" || rc=$?
  out=$(<"$tmp/out")
  err=$(<"$tmp/err")
}

expect_rc() { # <case> <want>
  if [[ $rc == "$2" ]]; then pass "$1"; else fail "$1" "exit $rc, want $2; stderr: $err"; fi
}

run_case ok --help
expect_rc "--help exits 0" 0
for word in '<name>' '<team-slug>' security partner --org --yes --dry-run refs/pull; do
  [[ $out == *"$word"* ]] || fail "--help mentions $word"
done

run_case ok "$NAME" "$TEAM" banana
expect_rc "rejects an unknown kind" 2
run_case ok "$NAME" "$TEAM"
expect_rc "rejects missing arguments" 2
run_case ok "$NAME" "$TEAM" security --bogus
expect_rc "rejects an unknown option" 2
run_case ok 'bad/name' "$TEAM" security
expect_rc "rejects an invalid repository name" 2
run_case ok coop "$TEAM" security --org roostorg
expect_rc "refuses roostorg/coop itself" 1
run_case ok Coop "$TEAM" security --org RoostOrg
expect_rc "refuses roostorg/coop in any case" 1

run_case ok "$NAME" "$TEAM" partner --org "$ORG"
expect_rc "dry run exits 0" 0
if [[ -s $GH_LOG || -e $TARGET ]]; then
  fail "dry run calls nothing" "$(cat "$GH_LOG")"
else
  pass "dry run calls nothing"
fi
for want in \
  "+ gh repo create $REPO --private --disable-wiki" \
  "+ gh api --method PATCH repos/$REPO -F has_projects=false" \
  "+ gh api --method PATCH repos/$REPO -F allow_forking=false" \
  "+ gh api --method PATCH orgs/$ORG/properties/values --input - --silent <<< '{\"repository_names\":[\"$NAME\"],\"properties\":[{\"property_name\":\"embargo\",\"value\":\"partner\"}]}'" \
  "+ gh api --method PUT orgs/$ORG/teams/$TEAM/repos/$REPO -f permission=push" \
  "+ git clone --bare --quiet https://github.com/roostorg/coop.git <tmpdir>/coop.git" \
  "push --quiet https://github.com/$REPO.git refs/heads/main:refs/heads/main refs/tags/\\*:refs/tags/\\*" \
  "EMBARGO_SYNC_APP_KEY"; do
  [[ $out == *"$want"* ]] || fail "dry run prints: $want" "$out"
done

run_case noprop "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "missing custom property fails" 1
[[ $err == *"does not exist"*"does not create it"* ]] || fail "missing property message is clear" "$err"
grep -q -- '--method' "$GH_LOG" && fail "missing property changes nothing" "$(cat "$GH_LOG")"
[[ -e $TARGET ]] && fail "missing property creates no repository"

run_case novalue "$NAME" "$TEAM" partner --org "$ORG" --yes
expect_rc "property without the kind's value fails" 1
[[ -e $TARGET ]] && fail "disallowed value creates no repository"

run_case multiselect "$NAME" "$TEAM" partner --org "$ORG" --yes
expect_rc "property of the wrong type fails" 1
[[ -e $TARGET ]] && fail "wrong property type creates no repository"

run_case exists "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "existing repository fails" 1
[[ -e $TARGET ]] && fail "existing repository is left alone"

run_case noteam "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "missing team fails" 1
[[ -e $TARGET ]] && fail "missing team creates no repository"

run_case ok "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "--yes succeeds" 0
refs=$(git -C "$TARGET" for-each-ref --format='%(refname)' | sort | tr '\n' ' ')
if [[ $refs == "refs/heads/main refs/tags/1.0.0 " ]]; then
  pass "seeds only main and tags"
else
  fail "seeds only main and tags" "got: $refs"
fi
[[ $(git -C "$TARGET" rev-parse main) == $(git -C "$tmp/up.git" rev-parse main) ]] ||
  fail "seeded main matches upstream main"
calls=$(grep -E '^(repo|api --method)' "$GH_LOG" | sed 's/ --silent$//')
want_calls="repo create $REPO --private --disable-wiki
api --method PATCH repos/$REPO -F has_projects=false
api --method PATCH repos/$REPO -F allow_forking=false
api --method PATCH orgs/$ORG/properties/values --input -
api --method PUT orgs/$ORG/teams/$TEAM/repos/$REPO -f permission=push
api --method PATCH repos/$REPO -f default_branch=main"
if [[ $calls == "$want_calls" ]]; then
  pass "--yes makes the expected gh calls in order"
else
  fail "--yes makes the expected gh calls in order" "got: $calls"
fi
grep -qx "{\"repository_names\":\[\"$NAME\"\],\"properties\":\[{\"property_name\":\"embargo\",\"value\":\"security\"}\]}" "$GH_LOG" ||
  fail "--yes sends the property value" "$(cat "$GH_LOG")"
grep -q 'DELETE' "$GH_LOG" && fail "--yes leaves Pages alone when there is no site"

run_case pages "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "--yes with a Pages site succeeds" 0
if grep -qx "api --method DELETE repos/$REPO/pages" "$GH_LOG"; then
  pass "removes an existing Pages site"
else
  fail "removes an existing Pages site" "$(cat "$GH_LOG")"
fi

run_case failput "$NAME" "$TEAM" security --org "$ORG" --yes
expect_rc "failure after creation exits non-zero" 1
if [[ $err == *"was created but setup did not finish"*"gh repo delete $REPO"* ]]; then
  pass "failure after creation says what to clean up"
else
  fail "failure after creation says what to clean up" "$err"
fi
[[ -e $TARGET && -z $(git -C "$TARGET" for-each-ref) ]] ||
  fail "failure after creation stops before seeding"

if ((failures)); then
  printf '%d failure(s)\n' "$failures"
  exit 1
fi
echo "all passed"
