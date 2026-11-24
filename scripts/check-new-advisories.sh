#!/bin/bash
set -euo pipefail
export LC_ALL=C

# Fail when the production dependencies have a high or critical advisory that
# the base commit's production dependencies don't. Advisories already present
# on the base are reported by the nightly scan and Dependabot, not here.
#
# Usage: scripts/check-new-advisories.sh <base-ref>
# Reads only the lockfile and manifests, so neither tree needs an install.

base_ref=${1:?usage: $0 <base-ref>}
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp/base" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

# Prints "<advisory id> <package> <severity> <url>", one line per advisory.
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
    | "\(.github_advisory_id) \(.module_name) \(.severity) \(.url)"' "$out" | sort -u
}

git worktree add --quiet --detach "$tmp/base" "$base_ref"

high_advisories . "$tmp/head.json" >"$tmp/head.txt"
high_advisories "$tmp/base" "$tmp/base.json" >"$tmp/base.txt"

new=$(join -v1 "$tmp/head.txt" "$tmp/base.txt" || true)
if [[ -n "$new" ]]; then
  echo "New high or critical advisories in production dependencies:"
  while read -r id module severity url; do
    echo "  $severity $module $id $url"
    jq -r --arg id "$id" '.advisories[] | select(.github_advisory_id == $id)
      | .findings[] | "    \(.version) via \(.paths | join(", "))"' "$tmp/head.json" | sort -u
  done <<<"$new"
  exit 1
fi

echo "No new high or critical advisories in production dependencies."
