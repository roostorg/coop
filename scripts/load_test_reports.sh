#!/bin/bash
set -e

API_KEY="$1"
COUNT="${2:-5000}"
BASE_URL="${3:-http://localhost:3000}"

if [ -z "$API_KEY" ]; then
  echo "Usage: bash load_test_reports.sh API_KEY [COUNT] [BASE_URL]"
  echo "  COUNT defaults to 5000, BASE_URL defaults to http://localhost:3000"
  exit 1
fi

echo "=== Submitting $COUNT reports to $BASE_URL ==="

for i in $(seq 1 "$COUNT"); do
  GUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  REPORTER_ID="usr$(openssl rand -hex 4)"
  OWNER_ID="own$(openssl rand -hex 4)"

  curl -s -o /dev/null -w "Report $i: %{http_code}\n" \
    -X POST "$BASE_URL/api/v1/report" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"reporter\":{\"kind\":\"user\",\"id\":\"$REPORTER_ID\",\"typeId\":\"502ec98c7e\"},\"reportedAt\":\"2026-03-24T12:00:00Z\",\"reportedItem\":{\"id\":\"$GUID\",\"typeId\":\"a8481310e8c\",\"data\":{\"text\":\"Load test post $i\",\"images\":[],\"owner_id\":{\"id\":\"$OWNER_ID\",\"typeId\":\"502ec98c7e\"},\"num_likes\":$((RANDOM % 100)),\"num_comments\":$((RANDOM % 50)),\"num_user_reports\":$((RANDOM % 20))}}}" &

  if (( i % 10 == 0 )); then wait; echo "  ... $i/$COUNT sent"; fi
done
wait
echo "=== Done — $COUNT reports submitted ==="
