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
ACTION_ID="8481310e8c4"
POLICY_ID="08dec618f8e"

echo "=== Submitting 100 items ==="
python3 -c "
import json
items = []
for i in range(1, 101):
    items.append({
        'id': f'demo-item-{i}',
        'typeId': '$ITEM_TYPE',
        'data': {
            'text': f'Demo post number {i} for conference demo',
            'authorDid': {'id': f'did:plc:demo-user-{i}', 'typeId': '$USER_TYPE'},
            'rkey': f'demo-rkey-{i}',
            'createdAt': '2026-03-26T12:00:00Z',
            'atUri': f'at://did:plc:demo-user-{i}/app.bsky.feed.post/demo-rkey-{i}',
            'isLive': True
        }
    })
with open('/tmp/items_payload.json', 'w') as f:
    json.dump({'items': items}, f)
"
curl -s -o /dev/null -w "Items response: %{http_code}\n" \
  -X POST "$BASE_URL/api/v1/items/async/" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d @/tmp/items_payload.json

echo "=== Submitting 50 appeals ==="
for i in $(seq 1 50); do
  python3 -c "
import json
appeal = {
    'appealId': 'appeal-$i',
    'appealedBy': {'typeId': '$USER_TYPE', 'id': 'appealer-$i'},
    'appealedAt': '2026-03-26T12:00:00Z',
    'actionedItem': {
        'id': 'appealed-item-$i',
        'typeId': '$ITEM_TYPE',
        'data': {
            'text': 'Appealed post $i - user contests moderation decision',
            'authorDid': {'id': 'did:plc:appealer-$i', 'typeId': '$USER_TYPE'},
            'rkey': 'appeal-rkey-$i',
            'createdAt': '2026-03-26T12:00:00Z',
            'atUri': 'at://did:plc:appealer-$i/app.bsky.feed.post/appeal-rkey-$i',
            'isLive': True
        }
    },
    'actionsTaken': ['$ACTION_ID'],
    'appealReason': 'This content does not violate any policies and should be restored',
    'violatingPolicies': [{'id': '$POLICY_ID'}]
}
with open('/tmp/appeal_payload.json', 'w') as f:
    json.dump(appeal, f)
"
  curl -s -o /dev/null -w "Appeal $i: %{http_code}\n" \
    -X POST "$BASE_URL/api/v1/report/appeal" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d @/tmp/appeal_payload.json
done

echo "=== Done! ==="
