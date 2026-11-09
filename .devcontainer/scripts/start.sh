#!/bin/bash
# postStartCommand: start the demo stack, add the demo data, and wait until the UI
# works. Runs on every start, including when a stopped codespace resumes.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

on_failure() {
    echo failed >"$DEMO_STATE_FILE"
    echo
    fail "The Coop demo didn't start cleanly."
    echo "  Try: Ctrl+Shift+P (Cmd+Shift+P on a Mac) → \"Codespaces: Rebuild Container\"."
    echo "  To see which service is failing, run:  docker compose ps -a"
    echo "  More help: docs/development/codespaces.md#troubleshooting"
    exit 1
}

echo starting >"$DEMO_STATE_FILE"
echo -e "${BOLD}Starting the Coop demo. This takes 1-3 minutes.${NC}"
echo "The Coop UI may open in a new browser tab before the demo data is added."
echo "Wait until this terminal says \"Coop is ready\" before you look around."
echo

wait_for_docker || on_failure
wait_for_disk_space

# Creates the databases and runs migrations before the server starts. A database that is slow to start on a busy machine fails its
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

step "Adding the demo login and data"
seed_demo_data
case $? in
0)
    ok "Demo data ready"
    echo ready >"$DEMO_STATE_FILE"
    ;;
2) on_failure ;;
*)
    fail "Couldn't add the demo data. You can still log in; some pages will be empty."
    echo no-demo-data >"$DEMO_STATE_FILE"
    ;;
esac

print_ready_banner "$(cat "$DEMO_STATE_FILE")"
