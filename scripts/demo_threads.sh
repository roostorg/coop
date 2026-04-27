#!/bin/bash
set -e

API_KEY="$1"
POST_TYPE="$2"
COMMENT_TYPE="$3"
USER_TYPE="$4"

if [ -z "$API_KEY" ] || [ -z "$POST_TYPE" ] || [ -z "$COMMENT_TYPE" ] || [ -z "$USER_TYPE" ]; then
  cat <<EOF
Usage: bash demo_threads.sh API_KEY POST_TYPE_ID COMMENT_TYPE_ID USER_TYPE_ID

Submits a synthetic threaded conversation:
  - 1 root post
  - 3 direct replies to the root
  - 1 nested reply (reply to the first reply)

Prerequisites:
  - Server running at localhost:8080.
  - COMMENT_TYPE_ID must have 'threadId' and 'parentId' configured as
    schemaFieldRoles (Settings > Item Types in the UI). Without those role
    mappings the replies will load as standalone items, not as a thread.
  - All three type IDs must exist for the org the API key belongs to.

Tip: find type IDs in the UI under Settings > Item Types, or via GraphQL:
  query { itemTypes { id name } }
EOF
  exit 1
fi

BASE_URL="http://localhost:8080"
THREAD_TS=$(date +%s)
ROOT_ID="thread-demo-$THREAD_TS-root"
REPLY_1_ID="thread-demo-$THREAD_TS-reply-1"
REPLY_2_ID="thread-demo-$THREAD_TS-reply-2"
REPLY_3_ID="thread-demo-$THREAD_TS-reply-3"
NESTED_ID="thread-demo-$THREAD_TS-nested"

submit_items () {
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$BASE_URL/api/v1/items/async/" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d @"$1"
}

echo "=== Submitting threaded conversation ==="

# 1) Root post
python3 -c "
import json
payload = {
  'items': [{
    'id': '$ROOT_ID',
    'typeId': '$POST_TYPE',
    'data': {
      'text': 'Should we adopt the new moderation policy? Looking for thoughts.',
      'creatorId': {'id': 'demo-user-1', 'typeId': '$USER_TYPE'}
    }
  }]
}
with open('/tmp/thread_payload.json', 'w') as f:
    json.dump(payload, f)
"
echo -n "Root post: "
submit_items /tmp/thread_payload.json

# 2) Three direct replies to the root
TEXTS=(
  "Strong yes - the existing policy fails to catch coordinated inauthentic behavior."
  "I am skeptical; we would need to pilot before rolling org-wide."
  "+1 to a pilot. Suggest 30 days, then revisit metrics."
)
USERS=(demo-user-2 demo-user-3 demo-user-4)
REPLY_IDS=("$REPLY_1_ID" "$REPLY_2_ID" "$REPLY_3_ID")

for i in 0 1 2; do
  python3 -c "
import json
payload = {
  'items': [{
    'id': '${REPLY_IDS[$i]}',
    'typeId': '$COMMENT_TYPE',
    'data': {
      'text': '${TEXTS[$i]}',
      'threadId': {'id': '$ROOT_ID', 'typeId': '$POST_TYPE'},
      'parentId': {'id': '$ROOT_ID', 'typeId': '$POST_TYPE'},
      'creatorId': {'id': '${USERS[$i]}', 'typeId': '$USER_TYPE'}
    }
  }]
}
with open('/tmp/thread_payload.json', 'w') as f:
    json.dump(payload, f)
"
  echo -n "Reply $((i+1)): "
  submit_items /tmp/thread_payload.json
done

# 3) Nested reply (reply to the first reply)
python3 -c "
import json
payload = {
  'items': [{
    'id': '$NESTED_ID',
    'typeId': '$COMMENT_TYPE',
    'data': {
      'text': 'Agreed on coordinated behavior - we saw 3 cases last week.',
      'threadId': {'id': '$ROOT_ID', 'typeId': '$POST_TYPE'},
      'parentId': {'id': '$REPLY_1_ID', 'typeId': '$COMMENT_TYPE'},
      'creatorId': {'id': 'demo-user-5', 'typeId': '$USER_TYPE'}
    }
  }]
}
with open('/tmp/thread_payload.json', 'w') as f:
    json.dump(payload, f)
"
echo -n "Nested reply: "
submit_items /tmp/thread_payload.json

echo "=== Done. Thread root ID: $ROOT_ID ==="
