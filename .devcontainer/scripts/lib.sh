#!/bin/bash
# Shared helpers for the devcontainer lifecycle scripts. Sourced, not run.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# devcontainer.json sets these; default them so the scripts also work when run by
# hand. The project name keeps the demo's volumes apart from a local checkout's
# own `docker compose` stack, which is named after the directory (often `coop`).
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-coop-demo}"
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.images.yaml:$REPO_ROOT/.devcontainer/docker-compose.codespaces.yaml}"
export COOP_DEMO_EMAIL="${COOP_DEMO_EMAIL:-demo@coop.local}"
export COOP_DEMO_PASSWORD="${COOP_DEMO_PASSWORD:-coop-demo}"
export DOCKER_CLI_HINTS=false

# start.sh records how far it got, for status.sh: starting, ready, no-demo-data
# (ready, but adding the demo data failed) or failed. Named after the boot, so
# a resumed codespace doesn't read the state from before it stopped.
DEMO_STATE_FILE="/tmp/coop-demo-state-$(cat /proc/sys/kernel/random/boot_id 2>/dev/null)"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

START_SECONDS=$SECONDS

step() { echo -e "${YELLOW}▶ $*${NC}"; }
ok() { echo -e "${GREEN}✓ $*${NC} ${BLUE}($((SECONDS - START_SECONDS))s)${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; }

# The address people open in their browser. In a codespace that's the forwarded
# *.app.github.dev URL; anywhere else it's localhost.
ui_url() {
    if [ -n "${CODESPACE_NAME:-}" ]; then
        echo "https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
    else
        echo "http://localhost:3000"
    fi
}
export COOP_UI_URL="${COOP_UI_URL:-$(ui_url)}"

wait_for_docker() {
    local attempt
    for attempt in $(seq 1 60); do
        timeout 10 docker info >/dev/null 2>&1 && return 0
        sleep 2
    done
    fail "Docker didn't start inside the codespace."
    return 1
}

# On a new codespace, the disk can be nearly full for a minute or two after the
# images are built, before the space is released. Databases that start then fail
# with "No space left on device", and ClickHouse doesn't recover, so wait for
# space first. If it doesn't come back, start anyway: the errors then explain.
docker_free_mb() {
    df -BM --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -dc 0-9
}

wait_for_disk_space() {
    local min_free_mb=4096 deadline=$((SECONDS + 300))
    [ -n "$(docker_free_mb)" ] && [ "$(docker_free_mb)" -lt $min_free_mb ] || return 0
    step "Waiting for disk space to be freed..."
    while [ "$(docker_free_mb)" -lt $min_free_mb ]; do
        if [ $SECONDS -ge $deadline ]; then
            fail "Only $(docker_free_mb) MB of disk space is free. Starting anyway."
            return 0
        fi
        sleep 5
    done
    ok "Disk space: $(docker_free_mb) MB free"
}

# wait_for <description> <timeout seconds> <command...>
wait_for() {
    local what=$1 timeout=$2
    shift 2
    local deadline=$((SECONDS + timeout))
    step "Waiting for $what..."
    # Each check bounds its own time (curl --max-time), so the deadline holds.
    until "$@" >/dev/null 2>&1; do
        if [ $SECONDS -ge $deadline ]; then
            fail "$what isn't ready after ${timeout}s."
            return 1
        fi
        sleep 3
    done
    ok "Ready: $what"
}

# The UI, and the API through the UI's /api proxy: the path the browser uses.
ui_ready() {
    curl -fsS --max-time 5 -o /dev/null http://localhost:3000/ &&
        curl -fsS --max-time 5 -o /dev/null http://localhost:3000/api/v1/ready
}

seed_demo_data() {
    docker compose exec -T \
        -e COOP_DEMO_EMAIL="$COOP_DEMO_EMAIL" \
        -e COOP_DEMO_PASSWORD="$COOP_DEMO_PASSWORD" \
        server node --input-type=module - <"$REPO_ROOT/.devcontainer/scripts/seed-demo.mjs"
}

# print_ready_banner [no-demo-data]
print_ready_banner() {
    echo
    echo -e "${GREEN}${BOLD}==============================================${NC}"
    echo -e "${GREEN}${BOLD}  Coop is ready${NC}"
    echo -e "${GREEN}${BOLD}==============================================${NC}"
    echo
    echo -e "  Open the UI:  ${BOLD}${COOP_UI_URL}/login${NC}"
    echo -e "  (or the ${BOLD}Ports${NC} tab → ${BOLD}Coop UI${NC} → globe icon)"
    echo
    echo -e "  Email:     ${BOLD}${COOP_DEMO_EMAIL}${NC}"
    echo -e "  Password:  ${BOLD}${COOP_DEMO_PASSWORD}${NC}"
    echo
    if [ "${1:-}" = no-demo-data ]; then
        echo "  Adding the demo data failed, so some pages are empty. To try again, run:"
        echo "  bash .devcontainer/scripts/start.sh"
    else
        echo "  The demo org has sample posts, policies, a spam rule, and user"
        echo -e "  reports waiting in the ${BOLD}Reported posts${NC} review queue:"
        echo "  ${COOP_UI_URL}/dashboard/manual_review/queues"
    fi
    echo
    echo "  Guide: docs/development/codespaces.md"
    echo
}
