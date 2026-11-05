#!/bin/bash
# postStartCommand: start the demo stack, add the demo data, and wait until the UI
# works. Runs on every start, including when a stopped codespace resumes.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

on_failure() {
    echo
    fail "The Coop demo didn't start cleanly."
    echo "  Try: Ctrl+Shift+P (Cmd+Shift+P on a Mac) → \"Codespaces: Rebuild Container\"."
    echo "  To see which service is failing, run:  docker compose ps -a"
    echo "  More help: docs/development/codespaces.md#troubleshooting"
    exit 1
}

echo -e "${BOLD}Starting the Coop demo. This takes 1-3 minutes.${NC}"
echo "The Coop UI opens in a new browser tab once it's ready; this terminal"
echo "keeps showing progress."
echo

wait_for_docker || on_failure

# Creates the databases, runs migrations and creates the demo login before the
# server starts. A database that is slow to start on a busy machine fails its
# healthcheck at first and passes a few seconds later, but `up --wait` gives up
# as soon as a dependency is unhealthy, so retry.
step "Starting databases, running migrations and starting Coop"
for attempt in 1 2 3 4 5; do
    docker compose up -d --quiet-pull --wait && break
    [ "$attempt" -eq 5 ] && on_failure
    echo "Some services aren't ready yet. Trying again (attempt $((attempt + 1)) of 5)..."
    sleep 10
done
ok "Services started"

wait_for "the Coop UI" 300 ui_ready || on_failure

step "Adding demo data"
if seed_demo_data; then
    ok "Demo data ready"
else
    fail "Couldn't add the demo data. You can still log in; some pages will be empty."
fi

print_ready_banner
