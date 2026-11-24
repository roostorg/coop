#!/usr/bin/env bash
set -euo pipefail

# Sets up a new private copy of roostorg/coop for embargoed work: a private
# repository (not a fork) seeded with upstream main and tags only.

readonly PROG=new-embargo-repo.sh
readonly UPSTREAM_URL=https://github.com/roostorg/coop.git
readonly PROPERTY=embargo

usage() {
  cat <<'EOF'
Usage:
  new-embargo-repo.sh <name> <team-slug> <security|partner> [options]

Creates <org>/<name> as a private copy of roostorg/coop for embargoed work
and seeds it with upstream main and tags. Dry-run unless --yes: without it,
nothing is created, no network call is made, and every gh/git command is
printed. With --yes, read-only checks run first and stop the script before
any change if the repository already exists, the team doesn't exist, or the
'embargo' custom property is missing. The steps, in order:

  1. gh repo create --private, wiki disabled; then projects disabled, and
     GitHub Pages removed if it is somehow enabled.
  2. allow_forking=false.
  3. Set the org custom property 'embargo' to the kind. The property must
     already exist; the script never creates it.
  4. Grant <team-slug> push access.
  5. Bare-clone upstream into a temporary directory and push only
     refs/heads/main and refs/tags/* (never refs/pull/* or other branches),
     then set main as the default branch.
  6. Print the manual steps that remain.

If a step fails after the repository was created, the script says so and
leaves the repository for you to finish by hand or delete.

Arguments:
  <name>        Name of the new repository in <org>.
  <team-slug>   Slug of the org team that works in it (gets push access).
  <kind>        security (pre-disclosure security fixes) or partner
                (embargoed partner features). Becomes the 'embargo' value.

Options:
  --org <org>   Organization to create the repository in (default: roostorg).
  --yes         Make the changes. Without it, only print the commands.
  --dry-run     Explicit default; no effect.
  -h, --help    Show this help.

Requirements (for --yes):
  gh, authenticated as an org owner, or as a member who can create private
  repositories, edit custom property values and administer the team (classic
  token scopes: repo, admin:org). git. The seed push authenticates through
  gh (gh auth git-credential), so no separate git credentials are needed.

Examples:
  new-embargo-repo.sh <private-repo> <team-slug> security
  new-embargo-repo.sh <private-repo> <team-slug> partner --yes
  new-embargo-repo.sh <private-repo> <team-slug> security --org <org> --yes
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
print_cmd() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
}
run() {
  print_cmd "$@"
  if ((yes)); then
    "$@"
  fi
}
# run_with_input <stdin> <cmd...>: like run, feeding <stdin> to the command.
run_with_input() {
  local input=$1
  shift
  printf '+ '
  printf '%q ' "$@"
  # Callers pass JSON built from validated values, which has no single quotes.
  printf "<<< '%s'\n" "$input"
  if ((yes)); then
    "$@" <<<"$input"
  fi
}

org=roostorg
positional=()
while (($#)); do
  case $1 in
    -h | --help)
      usage
      exit 0
      ;;
    --org)
      (($# >= 2)) || usage_error "--org needs a value"
      org=$2
      shift 2
      ;;
    --org=*)
      org=${1#--org=}
      shift
      ;;
    --yes)
      yes=1
      shift
      ;;
    --dry-run) shift ;;
    --)
      shift
      positional+=("$@")
      break
      ;;
    -*) usage_error "unknown option: $1" ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done

((${#positional[@]} == 3)) || usage_error "expected <name> <team-slug> <security|partner>"
name=${positional[0]}
team=${positional[1]}
kind=${positional[2]}

valid_slug() { [[ $1 =~ ^[A-Za-z0-9._-]+$ && $1 != . && $1 != .. ]]; }
valid_slug "$org" || usage_error "invalid --org: $org"
valid_slug "$name" || usage_error "invalid repository name: $name"
valid_slug "$team" || usage_error "invalid team slug: $team"
case $kind in
  security | partner) ;;
  *) usage_error "kind must be 'security' or 'partner', got: $kind" ;;
esac

repo=$org/$name
repo_url=https://github.com/$repo.git
[[ $repo_url != "$UPSTREAM_URL" ]] || die "refusing to target roostorg/coop itself"

if ((yes)); then
  command -v gh >/dev/null || die "gh is required"
  command -v git >/dev/null || die "git is required"
else
  log "dry run: no network calls, nothing is created. Re-run with --yes to act."
fi

# Read-only checks. Under --yes they run and stop the script before any change.
echo "# Checks (read-only; with --yes they run before any change)"
print_cmd gh api "repos/$repo"
print_cmd gh api "orgs/$org/teams/$team"
print_cmd gh api "orgs/$org/properties/schema/$PROPERTY"
if ((yes)); then
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run: gh auth login"

  if out=$(gh api "repos/$repo" --jq .full_name 2>&1); then
    die "$repo already exists"
  elif [[ $out != *"HTTP 404"* ]]; then
    die "could not check whether $repo exists: $out"
  fi

  out=$(gh api "orgs/$org/teams/$team" --jq .slug 2>&1) ||
    die "team '$team' not found in $org (use the team's slug): $out"

  if ! schema=$(gh api "orgs/$org/properties/schema/$PROPERTY" \
    --jq '[.value_type, ((.allowed_values // []) | join(" "))] | join("\t")' 2>&1); then
    if [[ $schema == *"HTTP 404"* ]]; then
      die "the custom property '$PROPERTY' does not exist in $org. An org owner must create it (Settings > Custom properties; single select with values 'security' and 'partner') before running this script. The script does not create it."
    fi
    die "could not read the custom property '$PROPERTY' in $org: $schema"
  fi
  IFS=$'\t' read -r value_type allowed <<<"$schema"
  if [[ $value_type == single_select || $value_type == multi_select ]] &&
    [[ " $allowed " != *" $kind "* ]]; then
    die "the custom property '$PROPERTY' in $org does not allow the value '$kind' (allowed: $allowed). An org owner must add it."
  fi
fi

created=0
on_exit() {
  local rc=$?
  [[ -z ${tmp:-} ]] || rm -rf -- "$tmp"
  if ((rc != 0 && created)); then
    log "$repo was created but setup did not finish. Finish the remaining steps by hand, or delete it: gh repo delete $repo"
  fi
}
trap on_exit EXIT
tmp=$(mktemp -d)

echo "# 1. Create the private repository; disable wiki, projects and Pages"
run gh repo create "$repo" --private --disable-wiki
if ((yes)); then created=1; fi
run gh api --method PATCH "repos/$repo" -F has_projects=false -F has_wiki=false --silent
# A new repository has no Pages site; the check guards against org defaults.
print_cmd gh api "repos/$repo/pages"
echo "#   only if that returns a Pages site:"
print_cmd gh api --method DELETE "repos/$repo/pages"
if ((yes)) && gh api "repos/$repo/pages" --silent 2>/dev/null; then
  gh api --method DELETE "repos/$repo/pages"
fi

echo "# 2. Disallow forking"
run gh api --method PATCH "repos/$repo" -F allow_forking=false --silent

echo "# 3. Set the '$PROPERTY' custom property"
run_with_input "{\"properties\":[{\"property_name\":\"$PROPERTY\",\"value\":\"$kind\"}]}" \
  gh api --method PATCH "repos/$repo/properties/values" --input - --silent

echo "# 4. Grant the team push access"
run gh api --method PUT "orgs/$org/teams/$team/repos/$repo" -f permission=push --silent

echo "# 5. Seed with upstream main and tags only"
run git clone --bare --quiet "$UPSTREAM_URL" "$tmp/coop.git"
# Explicit refspecs: nothing but main and tags leaves the clone.
run git -C "$tmp/coop.git" \
  -c credential.https://github.com.helper= \
  -c 'credential.https://github.com.helper=!gh auth git-credential' \
  push --quiet "$repo_url" refs/heads/main:refs/heads/main 'refs/tags/*:refs/tags/*'
run gh api --method PATCH "repos/$repo" -f default_branch=main --silent

if ((yes)); then
  log "created and seeded $repo"
else
  log "dry run: nothing was created. Re-run with --yes to act."
fi

cat <<EOF

# 6. Remaining manual steps for $repo
  [ ] Secrets: give the repository the upstream-sync App credentials
      (EMBARGO_SYNC_APP_ID, EMBARGO_SYNC_APP_KEY), either as repository
      secrets or by adding $repo to the org secrets' repository access.
  [ ] Sync App: install it on $repo (if the installation is limited to
      selected repositories) and confirm it is on the bypass list of the
      org rulesets that protect main, so it can push upstream changes.
  [ ] Rulesets: confirm the org rulesets targeting embargo=$kind apply:
        gh api repos/$repo/rules/branches/main
      and in Settings > Rules > Rulesets on $repo.
  [ ] Access: confirm only the intended people can see it:
        gh api repos/$repo/teams
        gh api repos/$repo/collaborators --jq '.[].login'
  [ ] Settings: confirm it is private, forking is off and Actions are
      allowed by the org policy for private repositories:
        gh repo view $repo --json visibility,isPrivate
        gh api repos/$repo --jq .allow_forking
EOF
