#!/bin/bash
set -euo pipefail

# Check that repo-relative paths referenced in AGENTS.md still exist, guarding
# against stale references after files move or get renamed. Only literal
# repo-relative paths are checked: URLs, commands, globs, placeholders, and
# absolute paths (leading slash) are skipped.

file=${1:-AGENTS.md}
failed=0

if [[ ! -f "$file" ]]; then
  echo "AGENTS.md path check: missing $file" >&2
  exit 1
fi

while IFS= read -r span; do
  [[ "$span" != */* ]] && continue # Must contain a slash
  [[ "$span" == /* || "$span" == @* ]] && continue # No leading Slash
  [[ "$span" == *"://"* ]] && continue # No leading '@'
  [[ "$span" == *" "* ]] && continue # No Spaces
  [[ "$span" == *"*"* || "$span" == *"<"* || "$span" == *">"* ]] && continue #No glob/placehold chars
  [[ "$span" == actions/* ]] && continue  # GitHub Action refs, not repo paths
  path=${span%/} # Strips trailing slash
  [[ -z "$path" ]] && continue # Skip if path empty (lone '/')
  
  if [[ ! -e "$path" ]]; then
    echo "$file references $span which does not exist" >&2
    failed=1
  fi
done < <(grep -oE '`[^`]+`' "$file" | tr -d '`' | sort -u)

exit "$failed"
