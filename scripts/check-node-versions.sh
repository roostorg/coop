#!/bin/bash
set -euo pipefail

# Check that Dockerfiles and docker-compose.yaml match .nvmrc as the single 
# source of truth for the node version.

expected=$(cat .nvmrc)
files=(Dockerfile client/Dockerfile db/Dockerfile nodejs-instrumentation/Dockerfile docker-compose.yaml)
failed=0

for file in "${files[@]}"; do
  while read -r tag; do
    actual=${tag#node:}
    if [[ "$actual" != "$expected" ]]; then
      echo "Node version drift: $file pins $tag but .nvmrc holds $expected" >&2
      failed=1
    fi
  done < <(grep -oE 'node:[0-9]+\.[0-9]+\.[0-9]+' "$file" || true)
done

exit "$failed"
