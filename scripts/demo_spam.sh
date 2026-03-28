#!/bin/bash
set -e

API_KEY="$1"
if [ -z "$API_KEY" ]; then
  echo "Usage: bash demo_spam.sh YOUR_API_KEY"
  exit 1
fi

BASE_URL="http://localhost:8080"
ITEM_TYPE="atp_post_e7c89"
USER_TYPE="502ec98c7e"
IMAGE_BASE="http://localhost:3000/spam"

SPAM_TEXTS=(
  "🔥 Buy 10K followers for just \$5! DM now! Limited time offer!!!"
  "FREE crypto giveaway! Send 0.1 ETH get 1 ETH back! Click link in bio 💰💰💰"
  "Hot singles in your area want to meet YOU! Click here ➡️ bit.ly/totallylegit"
  "Make \$5000/day working from home! No experience needed! DM for info 🤑"
  "BREAKING: Celebrity leaked photos! See them before they get taken down!"
  "Congratulations! You've been selected for our exclusive iPhone giveaway 🎉📱"
  "I made \$50,000 last month with this ONE simple trick. Banks HATE me!"
  "Want cheap Ray-Bans? 90% off! Visit our store now! sunglassdeals.spam"
)

IMAGES=("0.jpg" "1.jpg" "2.webp" "3.webp" "4.jpg" "5.jpg" "6.jpg" "bafkreih7oq62foqrq5gk6ict3s3vpv6ww5xrofn26xrztg5a5m652ui7p4.webp")

echo "=== Submitting 8 spam items with images ==="
python3 -c "
import json, sys

texts = $(python3 -c "import json; print(json.dumps([
    '🔥 Buy 10K followers for just \$5! DM now! Limited time offer!!!',
    'FREE crypto giveaway! Send 0.1 ETH get 1 ETH back! Click link in bio',
    'Hot singles in your area want to meet YOU! Click here totallylegit dot com',
    'Make \$5000/day working from home! No experience needed! DM for info',
    'BREAKING: Celebrity leaked photos! See them before they get taken down!',
    'Congratulations! You have been selected for our exclusive iPhone giveaway',
    'I made \$50000 last month with this ONE simple trick. Banks HATE me!',
    'Want cheap Ray-Bans? 90% off! Visit our store now! sunglassdeals dot spam',
]))")

images = ['0.jpg','1.jpg','2.webp','3.webp','4.jpg','5.jpg','6.jpg','bafkreih7oq62foqrq5gk6ict3s3vpv6ww5xrofn26xrztg5a5m652ui7p4.webp']

items = []
for i, (text, img) in enumerate(zip(texts, images)):
    items.append({
        'id': f'spam-item-{i}',
        'typeId': '$ITEM_TYPE',
        'data': {
            'text': text,
            'authorDid': {'id': f'did:plc:spammer-{i}', 'typeId': '$USER_TYPE'},
            'rkey': f'spam-rkey-{i}',
            'createdAt': '2026-03-28T12:00:00Z',
            'atUri': f'at://did:plc:spammer-{i}/app.bsky.feed.post/spam-rkey-{i}',
            'isLive': True,
            'images': [f'$IMAGE_BASE/{img}']
        }
    })

with open('/tmp/spam_payload.json', 'w') as f:
    json.dump({'items': items}, f)
"

curl -s -o /dev/null -w "Spam items response: %{http_code}\n" \
  -X POST "$BASE_URL/api/v1/items/async/" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d @/tmp/spam_payload.json

echo "=== Done! ==="
