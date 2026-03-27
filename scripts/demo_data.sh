#!/bin/bash
set -e

API_KEY="$1"
if [ -z "$API_KEY" ]; then
  echo "Usage: bash demo_data.sh YOUR_API_KEY"
  exit 1
fi

BASE_URL="http://localhost:8080"
ITEM_TYPE="atp_post_e7c89"
USER_TYPE="502ec98c7e"
ACTION_ID="c879170f4ab"
POLICY_ID="79170f4abe4"

echo "=== Submitting 100 items ==="
ITEMS="["
for i in $(seq 1 100); do
  if [ $i -gt 1 ]; then ITEMS="$ITEMS,"; fi
  ITEMS="${ITEMS}{\"id\":\"demo-item-${i}\",\"typeId\":\"${ITEM_TYPE}\",\"data\":{\"text\":\"Demo post number ${i} for conference demo\",\"authorDid\":{\"id\":\"did:plc:demo-user-${i}\",\"typeId\":\"${USER_TYPE}\"},\"rkey\":\"demo-rkey-${i}\",\"createdAt\":\"2026-03-26T12:00:00Z\",\"atUri\":\"at://did:plc:demo-user-${i}/app.bsky.feed.post/demo-rkey-${i}\",\"isLive\":true}}"
done
ITEMS="$ITEMS]"

curl -s -o /dev/null -w "Items response: %{http_code}\n" \
  -X POST "$BASE_URL/api/v1/items/async/" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"items\":$ITEMS}"

echo "=== Submitting 50 appeals ==="
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "Appeal $i: %{http_code}\n" \
    -X POST "$BASE_URL/api/v1/report/appeal" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"appealId\":\"appeal-${i}\",\"appealedBy\":{\"typeId\":\"${USER_TYPE}\",\"id\":\"appealer-${i}\"},\"appealedAt\":\"2026-03-26T12:00:00Z\",\"actionedItem\":{\"id\":\"appealed-item-${i}\",\"typeId\":\"${ITEM_TYPE}\",\"data\":{\"text\":\"Appealed post ${i} - user contests moderation decision\"}},\"actionsTaken\":[\"${ACTION_ID}\"],\"appealReason\":\"This content does not violate any policies and should be restored\",\"violatingPolicies\":[{\"id\":\"${POLICY_ID}\"}]}"
done

echo "=== Done! ==="
