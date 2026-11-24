#!/usr/bin/env bash
set -euo pipefail

# Exercises land.sh against throwaway local repositories. No network: the
# GitHub URLs land.sh uses are rewritten to local bare repos with git's
# url.<base>.insteadOf, and check-lineage.sh is replaced by a stub that
# follows its agreed interface.

usage() {
  cat <<'EOF'
Usage:
  land.test.sh

Runs land.sh against throwaway repositories in a temporary directory and
reports each case. Exits non-zero if any case fails.

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
land_src=$here/../land.sh

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT

readonly GHSA=roostorg/coop-ghsa-abcd-2345-wxyz
export HOME=$tmp/home GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Tester GIT_AUTHOR_EMAIL=tester@example.com
export GIT_COMMITTER_NAME=Tester GIT_COMMITTER_EMAIL=tester@example.com
export GIT_CONFIG_COUNT=4
export GIT_CONFIG_KEY_0=url.$tmp/up.git.insteadOf GIT_CONFIG_VALUE_0=https://github.com/roostorg/coop.git
export GIT_CONFIG_KEY_1=url.$tmp/ghsa.git.insteadOf GIT_CONFIG_VALUE_1=https://github.com/$GHSA.git
export GIT_CONFIG_KEY_2=url.$tmp/ghsa.git.insteadOf GIT_CONFIG_VALUE_2=git@github.com:$GHSA.git
export GIT_CONFIG_KEY_3=init.defaultBranch GIT_CONFIG_VALUE_3=main
mkdir -p "$HOME"

# land.sh next to a check-lineage.sh stub. The stub records its arguments,
# fetches upstream main into refs/embargo/upstream/main as the real script
# does, and exits with $STUB_EXIT.
mkdir "$tmp/bin"
cp "$land_src" "$tmp/bin/land.sh"
cat >"$tmp/bin/check-lineage.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >"$STUB_ARGS"
git fetch --quiet --no-tags https://github.com/roostorg/coop.git \
  +refs/heads/main:refs/embargo/upstream/main || exit 2
exit "${STUB_EXIT:-0}"
EOF
# Editor: saves the prefilled message, then writes $TEST_MSG over it.
cat >"$tmp/bin/editor" <<'EOF'
#!/usr/bin/env bash
cp "$1" "$EDITOR_SAW"
printf '%s' "$TEST_MSG" >"$1"
EOF
chmod +x "$tmp/bin/"*
export STUB_ARGS=$tmp/stub-args EDITOR_SAW=$tmp/editor-saw
export GIT_EDITOR=$tmp/bin/editor
export TEST_MSG=$'fix(signals): reject bad input\n\nPublic description.'

commit() { # <repo> <file> <content> <message>
  printf '%s\n' "$3" >"$1/$2"
  git -C "$1" add "$2"
  git -C "$1" commit --quiet -m "$4"
}

# Upstream (also the --public target), a GHSA fork, the private copy, a
# remote named 'upstream' that must never be pushed to, and a work clone.
git init --quiet "$tmp/seed"
commit "$tmp/seed" a.txt one 'initial'
commit "$tmp/seed" b.txt one 'second'
git clone --quiet --bare "$tmp/seed" "$tmp/up.git"
git clone --quiet --bare "$tmp/seed" "$tmp/ghsa.git"
git clone --quiet --bare "$tmp/seed" "$tmp/priv.git"
git init --quiet --bare "$tmp/trap.git"
git clone --quiet "$tmp/priv.git" "$tmp/work"
git -C "$tmp/work" remote add upstream "$tmp/trap.git"
w=$tmp/work

git -C "$w" switch --quiet -c fix
GIT_AUTHOR_NAME=First GIT_AUTHOR_EMAIL=first@example.com \
  commit "$w" a.txt 'one fixed' 'private: fix part 1'
commit "$w" c.txt new 'private: fix part 2'
git -C "$w" switch --quiet main
# Upstream moves on after the branch was cut.
commit "$tmp/seed" d.txt upstream 'upstream moves on'
git -C "$tmp/seed" push --quiet "$tmp/up.git" main

fix_sha=$(git -C "$w" rev-parse fix)
up_main=$(git -C "$tmp/up.git" rev-parse main)
ghsa_main=$(git -C "$tmp/ghsa.git" rev-parse main)

failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() {
  printf 'FAIL %s\n' "$1"
  [[ -z ${2:-} ]] || printf '%s\n' "$2" | sed 's/^/     /'
  failures=$((failures + 1))
}

out=$tmp/out
land() { # runs land.sh in the work clone; sets $rc, output in $out
  rm -f "$STUB_ARGS" "$EDITOR_SAW"
  rc=0
  (cd "$w" && "$tmp/bin/land.sh" "$@") </dev/null >"$out" 2>&1 || rc=$?
}
land_stdin() { # <stdin> <args...>
  local input=$1
  shift
  rm -f "$STUB_ARGS" "$EDITOR_SAW"
  rc=0
  (cd "$w" && "$tmp/bin/land.sh" "$@") <<<"$input" >"$out" 2>&1 || rc=$?
}
expect_rc() { # <name> <rc>
  if [[ $rc == "$2" ]]; then pass "$1"; else fail "$1 (exit $rc, want $2)" "$(cat "$out")"; fi
}
expect_out() { # <name> <fixed string>
  if grep -qF -- "$2" "$out"; then pass "$1"; else fail "$1 (missing '$2')" "$(cat "$out")"; fi
}
refs_of() { git -C "$1" for-each-ref --format='%(refname) %(objectname)'; }

# Everything about the work clone that land.sh must leave alone.
snapshot() {
  {
    git -C "$w" symbolic-ref HEAD
    git -C "$w" for-each-ref --format='%(refname) %(objectname)' |
      grep -v '^refs/embargo/' || true
    git -C "$w" status --porcelain=v2 --branch
    git -C "$w" stash list
  }
}
before=$(snapshot)
expect_unchanged() {
  local now
  now=$(snapshot)
  if [[ $now == "$before" ]]; then pass "$1"; else fail "$1" "$(diff <(echo "$before") <(echo "$now"))"; fi
}
expect_no_push() {
  if [[ $(git -C "$tmp/ghsa.git" for-each-ref --format=x | wc -l) == 1 &&
    $(git -C "$tmp/up.git" for-each-ref --format=x | wc -l) == 1 ]]; then
    pass "$1"
  else
    fail "$1" "$(refs_of "$tmp/ghsa.git"; refs_of "$tmp/up.git")"
  fi
}

ghsa_url=https://github.com/$GHSA

# Usage
land --help
expect_rc '--help exits 0' 0
expect_out '--help prints usage' 'Usage:'
land fix
expect_rc 'neither --ghsa nor --public is a usage error' 2
land fix --public --ghsa "$ghsa_url"
expect_rc 'both --ghsa and --public is a usage error' 2
land --public
expect_rc 'missing branch is a usage error' 2
land fix --public --bogus
expect_rc 'unknown option is a usage error' 2

# GHSA URL validation, before anything else runs
for bad in \
  https://github.com/roostorg/coop \
  https://github.com/roostorg/coop-partner \
  https://github.com/someone/coop-ghsa-abcd-2345-wxyz \
  https://github.com/roostorg/coop-ghsa-abcd \
  https://github.com/roostorg/coop-ghsa-abcd-2345-wxyz/extra \
  https://github.com.evil.example/roostorg/coop-ghsa-abcd-2345-wxyz \
  https://token@github.com/roostorg/coop-ghsa-abcd-2345-wxyz \
  http://github.com/roostorg/coop-ghsa-abcd-2345-wxyz \
  "$tmp/ghsa.git" \
  upstream; do
  land fix --ghsa "$bad"
  if [[ $rc == 1 && ! -e $STUB_ARGS ]] && grep -qF 'roostorg/coop-ghsa-*' "$out"; then
    pass "rejects --ghsa $bad"
  else
    fail "rejects --ghsa $bad (exit $rc)" "$(cat "$out")"
  fi
done

for name in main master HEAD; do
  land fix --ghsa "$ghsa_url" --remote-branch "$name"
  expect_rc "refuses --remote-branch $name" 1
done
land nope --ghsa "$ghsa_url"
expect_rc 'refuses a branch that does not exist' 1
expect_no_push 'no push after argument errors'

# Dry run (default)
land fix --ghsa "$ghsa_url"
expect_rc 'dry run exits 0' 0
expect_no_push 'dry run pushes nothing'
expect_unchanged 'dry run leaves the work clone unchanged'
if [[ $(cat "$STUB_ARGS") == "--rev $fix_sha fix" ]]; then
  pass 'check-lineage.sh gets --rev <branch sha> <branch>'
else
  fail 'check-lineage.sh gets --rev <branch sha> <branch>' "$(cat "$STUB_ARGS")"
fi
expect_out 'dry run prints the push' "+ git push --force-with-lease=refs/heads/fix: https://github.com/$GHSA.git"
expect_out 'shows the commit message' 'Public description.'
expect_out 'shows the diff stat' '2 files changed'
expect_out 'prints the PR URL' "https://github.com/$GHSA/compare/main...fix?expand=1"
if grep -qF 'WARNING: this message will be public' "$EDITOR_SAW" &&
  grep -qF 'private: fix part 1' "$EDITOR_SAW" &&
  grep -qF 'private: fix part 2' "$EDITOR_SAW"; then
  pass 'editor is prefilled with the commit messages and a public warning'
else
  fail 'editor is prefilled with the commit messages and a public warning' "$(cat "$EDITOR_SAW")"
fi
if grep -qF 'Co-authored-by: Tester <tester@example.com>' "$EDITOR_SAW" &&
  ! grep -qF 'Co-authored-by: First' "$EDITOR_SAW"; then
  pass 'prefill credits the other authors as co-authors'
else
  fail 'prefill credits the other authors as co-authors' "$(cat "$EDITOR_SAW")"
fi
land fix --ghsa "git@github.com:$GHSA.git" --dry-run
expect_rc 'accepts an SSH GHSA URL with --dry-run' 0
land fix --ghsa "ssh://git@github.com/$GHSA.git"
expect_rc 'accepts an ssh:// GHSA URL' 0
expect_out 'rewrites ssh:// to the git@ form' "git@github.com:$GHSA.git"

# A different core.commentChar must not leak the '#' template into the message
GIT_CONFIG_COUNT=5 GIT_CONFIG_KEY_4=core.commentChar GIT_CONFIG_VALUE_4=';' \
  TEST_MSG=$'# only a comment\n' land fix --ghsa "$ghsa_url"
expect_rc "strips '#' lines whatever core.commentChar is" 1
expect_out 'and so refuses the empty message' 'empty commit message'

# Editor failure
GIT_EDITOR=false land fix --ghsa "$ghsa_url" --yes
expect_rc 'aborts when the editor fails' 1
expect_out 'says the editor failed' 'editor exited with an error'

# Empty message
TEST_MSG=$'# only a comment\n\n' land fix --ghsa "$ghsa_url" --yes
expect_rc 'refuses an empty message' 1
expect_no_push 'no push with an empty message'

# Lineage failure and errors
for code in 1 2; do
  STUB_EXIT=$code land fix --ghsa "$ghsa_url" --yes
  if [[ $rc == 1 && ! -e $EDITOR_SAW ]]; then
    pass "aborts when check-lineage.sh exits $code"
  else
    fail "aborts when check-lineage.sh exits $code (exit $rc)" "$(cat "$out")"
  fi
done
expect_no_push 'no push after lineage failures'

# --yes to the GHSA fork
land fix --ghsa "$ghsa_url" --yes
expect_rc '--yes --ghsa exits 0' 0
pushed=$(git -C "$tmp/ghsa.git" rev-parse --verify --quiet refs/heads/fix || true)
if [[ -n $pushed ]] &&
  [[ $(git -C "$tmp/ghsa.git" rev-parse "$pushed^") == "$up_main" ]] &&
  [[ $(git -C "$tmp/ghsa.git" show -s --format=%P "$pushed" | wc -w) == 1 ]] &&
  [[ $(git -C "$tmp/ghsa.git" show -s --format=%B "$pushed") == "$TEST_MSG" ]] &&
  [[ $(git -C "$tmp/ghsa.git" show -s --format=%an "$pushed") == First ]] &&
  [[ $(git -C "$tmp/ghsa.git" show "$pushed:a.txt") == 'one fixed' ]] &&
  [[ $(git -C "$tmp/ghsa.git" show "$pushed:c.txt") == new ]] &&
  [[ $(git -C "$tmp/ghsa.git" show "$pushed:d.txt") == upstream ]]; then
  pass 'pushes one squashed commit on upstream main'
else
  fail 'pushes one squashed commit on upstream main' "$(git -C "$tmp/ghsa.git" log --stat fix 2>&1)"
fi
if [[ $(git -C "$tmp/ghsa.git" rev-parse main) == "$ghsa_main" ]]; then
  pass 'GHSA fork main is untouched'
else
  fail 'GHSA fork main is untouched'
fi
expect_unchanged '--yes leaves the work clone unchanged'

land fix --ghsa "$ghsa_url" --yes
expect_rc 'refuses to push to an existing branch' 1
expect_out 'says the branch exists' 'already exists'
if [[ ! -e $EDITOR_SAW ]]; then
  pass 'checks the target branch before opening the editor'
else
  fail 'checks the target branch before opening the editor'
fi
land fix --ghsa "$ghsa_url" --yes --remote-branch fix-2
expect_rc '--remote-branch picks the target name' 0
if git -C "$tmp/ghsa.git" rev-parse --verify --quiet refs/heads/fix-2 >/dev/null; then
  pass 'pushed fix-2'
else
  fail 'pushed fix-2'
fi

# Conflict with upstream main
git -C "$w" switch --quiet -c conflicting main
commit "$w" b.txt private 'private: touch b'
git -C "$w" switch --quiet main
commit "$tmp/seed" b.txt upstream-change 'upstream touches b'
git -C "$tmp/seed" push --quiet "$tmp/up.git" main
before=$(snapshot)
land conflicting --ghsa "$ghsa_url" --yes
expect_rc 'aborts on a conflict' 1
expect_out 'reports the conflict' 'conflicts with current upstream main'
expect_unchanged 'conflict leaves the work clone unchanged'
up_main=$(git -C "$tmp/up.git" rev-parse main)

# Branch with no effect on upstream main
git -C "$w" switch --quiet -c noop "$fix_sha"
git -C "$w" revert --no-edit HEAD HEAD~1 >/dev/null
git -C "$w" switch --quiet main
before=$(snapshot)
land noop --ghsa "$ghsa_url" --yes --remote-branch noop
expect_rc 'refuses a branch that changes nothing' 1
expect_out 'says nothing changes' 'makes no changes'

# --public
land fix --public
expect_rc '--public dry run exits 0' 0
expect_out '--public prints a warning' 'PUBLIC PUSH'
expect_out '--public dry run prints the push' "+ git push --force-with-lease=refs/heads/fix: https://github.com/roostorg/coop.git"
if [[ $(refs_of "$tmp/up.git" | wc -l) == 1 ]]; then
  pass '--public dry run pushes nothing'
else
  fail '--public dry run pushes nothing'
fi
land fix --public --yes
expect_rc '--public --yes without confirmation refuses' 1
land_stdin wrong fix --public --yes
expect_rc '--public --yes with the wrong name refuses' 1
if [[ $(refs_of "$tmp/up.git" | wc -l) == 1 ]]; then
  pass 'no public push without confirmation'
else
  fail 'no public push without confirmation'
fi
land_stdin feat/x fix --public --yes --remote-branch feat/x
expect_rc '--public --yes with the branch name pushes' 0
pushed=$(git -C "$tmp/up.git" rev-parse --verify --quiet refs/heads/feat/x || true)
if [[ -n $pushed && $(git -C "$tmp/up.git" rev-parse "$pushed^") == "$up_main" ]]; then
  pass 'public branch is one commit on upstream main'
else
  fail 'public branch is one commit on upstream main'
fi
if [[ $(git -C "$tmp/up.git" rev-parse main) == "$up_main" ]]; then
  pass 'upstream main is untouched'
else
  fail 'upstream main is untouched'
fi
expect_out 'prints the public PR URL' 'https://github.com/roostorg/coop/compare/main...feat/x?expand=1'

if [[ -z $(refs_of "$tmp/trap.git") ]]; then
  pass "nothing was ever pushed to the remote named 'upstream'"
else
  fail "nothing was ever pushed to the remote named 'upstream'"
fi

if ((failures)); then
  printf '\n%d failure(s)\n' "$failures"
  exit 1
fi
printf '\nall passed\n'
