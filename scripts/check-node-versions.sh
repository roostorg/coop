#!/bin/bash
set -euo pipefail

# Check that Dockerfiles and docker-compose.yaml match .nvmrc as the single
# source of truth for the node version. Runs in CI and as a pre-commit hook.

expected=$(cat .nvmrc)
files=(Dockerfile client/Dockerfile db/Dockerfile nodejs-instrumentation/Dockerfile docker-compose.yaml)
failed=0

check_file() {
  local file=$1 pattern=$2
  if [[ ! -f "$file" ]]; then
    echo "Node version check: missing $file" >&2
    return 1
  fi

  local matches
  matches=$(grep -E "$pattern" "$file" | grep -oE 'node:[^ ]+' | sort -u) || true
  if [[ -z "$matches" ]]; then
    echo "Node version check: no pinned node tag found in $file" >&2
    return 1
  fi

  local tag version
  while read -r tag; do
    [[ -z "$tag" ]] && continue
    version=${tag#node:}
    version=${version%%-*}
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Node version check: $file uses unpinned tag $tag (.nvmrc wants $expected)" >&2
      failed=1
    elif [[ "$version" != "$expected" ]]; then
      echo "Node version check: $file pins node:$version but .nvmrc holds $expected" >&2
      failed=1
    fi
  done <<<"$matches"
}

for file in "${files[@]}"; do
  case "$file" in
    docker-compose.yaml) check_file "$file" '^[[:space:]]*image: node:' ;;
    *) check_file "$file" '^[[:space:]]*FROM node:' ;;
  esac
done

exit "$failed"
