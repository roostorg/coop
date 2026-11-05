#!/bin/bash
# updateContentCommand: download and build every image the demo needs, so that
# starting the stack later is quick. Runs once when the codespace (or its prebuild)
# is created, and again when a prebuild picks up new commits.
#
# It never fails: a failing updateContentCommand stops the codespace from running
# postStartCommand, and start.sh's `docker compose up` fetches anything missing.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

echo -e "${BOLD}Preparing the Coop demo. The first time, this takes several minutes.${NC}"
wait_for_docker || exit 0

# Most images come from Docker Hub, which rate-limits anonymous pulls per IP address.
# Signing in (from Codespaces secrets, if you've set them) avoids the limit. Sign
# out again on exit, so a prebuild doesn't keep the token in ~/.docker.
if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
    trap 'docker logout >/dev/null 2>&1' EXIT
    echo "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin >/dev/null &&
        ok "Signed in to Docker Hub as $DOCKERHUB_USERNAME"
fi

pull_failed() {
    fail "Couldn't download or build the demo's images."
    echo "  If the error above mentions \"rate limit\" or \"toomanyrequests\", Docker Hub is"
    echo "  limiting anonymous downloads. Wait an hour and rebuild the codespace, or add"
    echo "  DOCKERHUB_USERNAME and DOCKERHUB_TOKEN as Codespaces secrets."
    echo "  More help: docs/development/codespaces.md#troubleshooting"
    echo "  Starting the demo will try again."
    exit 0
}

step "Downloading database images (Postgres, Redis, ScyllaDB, ClickHouse)"
docker compose pull --ignore-buildable --quiet || pull_failed
ok "Images downloaded"

step "Building the Coop server, client and migrations images from this branch"
# The full build log is long, so show its end only if the build fails.
BUILD_LOG=$(mktemp)
if ! docker compose --progress plain build >"$BUILD_LOG" 2>&1; then
    tail -n 60 "$BUILD_LOG"
    pull_failed
fi
ok "Images built"

echo -e "${GREEN}Preparation finished. The demo starts next.${NC}"
