#!/bin/bash
# Shared helpers for the devcontainer lifecycle scripts. Sourced, not run.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# devcontainer.json sets these; default them so the scripts also work when run by hand.
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-coop}"
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.images.yaml:$REPO_ROOT/.devcontainer/docker-compose.codespaces.yaml}"
export COOP_DEMO_EMAIL="${COOP_DEMO_EMAIL:-demo@coop.local}"
export COOP_DEMO_PASSWORD="${COOP_DEMO_PASSWORD:-coop-demo}"
export DOCKER_CLI_HINTS=false

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

print_ready_banner() {
    echo
    echo -e "${GREEN}${BOLD}==============================================${NC}"
    echo -e "${GREEN}${BOLD}  Coop is ready${NC}"
    echo -e "${GREEN}${BOLD}==============================================${NC}"
    echo
    echo -e "  Open the UI:  ${BOLD}$(ui_url)/login${NC}"
    echo -e "  (or the ${BOLD}Ports${NC} tab → ${BOLD}Coop UI${NC} → globe icon)"
    echo
    echo -e "  Email:     ${BOLD}${COOP_DEMO_EMAIL}${NC}"
    echo -e "  Password:  ${BOLD}${COOP_DEMO_PASSWORD}${NC}"
    echo
    echo "  The demo org has sample posts, policies, a spam rule, and user"
    echo -e "  reports waiting in the ${BOLD}Reported posts${NC} review queue:"
    echo "  $(ui_url)/dashboard/manual_review/queues"
    echo
    echo "  Guide: docs/development/codespaces.md"
    echo
}
