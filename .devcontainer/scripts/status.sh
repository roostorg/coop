#!/bin/bash
# postAttachCommand: tell whoever just connected what state the demo is in.
source "$(dirname "$0")/lib.sh"

state=$(cat "$DEMO_STATE_FILE" 2>/dev/null)
case "$state" in
    ready | no-demo-data)
        if ui_ready >/dev/null 2>&1; then
            print_ready_banner "$state"
        else
            fail "The Coop UI isn't responding."
            echo "  More help: docs/development/codespaces.md#troubleshooting"
        fi
        ;;
    failed)
        fail "The Coop demo didn't start cleanly."
        echo "  Its progress terminal (\"postStartCommand\", or View Creation Log) shows why."
        echo "  More help: docs/development/codespaces.md#troubleshooting"
        ;;
    *)
        echo -e "${YELLOW}${BOLD}The Coop demo is still starting.${NC}"
        echo "Progress is shown in the \"postStartCommand\" terminal (or View Creation Log)."
        echo -e "When it's ready, the UI opens at ${BOLD}${COOP_UI_URL}${NC}"
        ;;
esac
