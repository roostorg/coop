#!/bin/bash
set -euo pipefail
export LC_ALL=C

# Fail when the production dependencies have a high or critical advisory, at
# a package version, that the base commit's production dependencies don't.
# Advisories already present on the base are reported by the nightly scan and
# Dependabot, not here.
#
# Usage: scripts/check-new-advisories.sh <base-ref>
# Reads only the lockfile, so neither tree needs an install.

base_ref=${1:?usage: $0 <base-ref>}

# The lockfile records which packages each workspace package depends on in
# production, so an unchanged lockfile can't add an advisory.
if git diff --quiet "$base_ref" -- pnpm-lock.yaml; then
  echo "pnpm-lock.yaml is unchanged; no new advisories possible."
  exit 0
fi

tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp/base" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

# Prints "<advisory id>@<version> <package> <severity> <url>", one line per
# vulnerable version of each advisory.
high_advisories() {
  local dir=$1 out=$2
  # pnpm audit exits non-zero whenever it finds an advisory, so judge success
  # by whether it produced a report.
  (cd "$dir" && pnpm audit --prod --json >"$out") || true
  if ! jq -e '.advisories | type == "object"' "$out" >/dev/null 2>&1; then
    echo "pnpm audit did not produce a report in $dir:" >&2
    cat "$out" >&2
    return 1
  fi
  jq -r '.advisories[]
    | select(.severity == "high" or .severity == "critical")
    | . as $a | .findings[]
    | "\($a.github_advisory_id)@\(.version) \($a.module_name) \($a.severity) \($a.url)"' "$out" | sort -u
}

git worktree add --quiet --detach "$tmp/base" "$base_ref"

high_advisories . "$tmp/head.json" >"$tmp/head.txt"
high_advisories "$tmp/base" "$tmp/base.json" >"$tmp/base.txt"

new=$(join --check-order -v1 "$tmp/head.txt" "$tmp/base.txt")
if [[ -n "$new" ]]; then
  echo "New high or critical advisories in production dependencies:"
  while read -r key module severity url; do
    id=${key%@*} version=${key##*@}
    echo "  $severity $module@$version $id $url"
    jq -r --arg id "$id" --arg version "$version" '.advisories[]
      | select(.github_advisory_id == $id) | .findings[]
      | select(.version == $version) | "    via \(.paths | join(", "))"' "$tmp/head.json"
  done <<<"$new"
  exit 1
fi

echo "No new high or critical advisories in production dependencies."
