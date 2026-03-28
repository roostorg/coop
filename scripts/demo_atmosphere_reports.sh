#!/bin/bash
set -e

API_KEY="$1"
if [ -z "$API_KEY" ]; then
  echo "Usage: bash demo_atmosphere_reports.sh YOUR_API_KEY"
  exit 1
fi

BASE_URL="http://localhost:8080"
ITEM_TYPE="atp_post_e7c89"
USER_TYPE="502ec98c7e"
IMAGE_BASE="http://172.18.0.1:9999/atmosphere"

IMAGES=(
  "PXL_20260327_195240895.MP.jpg"
  "PXL_20260328_031024613.MP.webp"
  "PXL_20260328_043612224.webp"
  "PXL_20260328_045137751.MP.jpg"
  "PXL_20260328_160425505.MP.jpg"
  "PXL_20260328_161720578.jpg"
)

TEXTS=(
  "The AT Protocol is changing how we think about decentralized social media. Open protocols for the win!"
  "Just discovered how federation works on atproto - each user owns their data and can move between providers freely"
  "Bluesky proving that open protocols can deliver a great user experience. The future of social is decentralized"
  "Love how atproto handles identity with DIDs - you truly own your handle and your social graph"
  "The composable moderation model in AT Protocol is brilliant - communities can set their own standards"
  "Building on atproto is a joy - the lexicon schema system makes API design so clean and interoperable"
)

echo "=== Submitting 6 reports with Atmosphere photos ==="
for i in $(seq 0 5); do
  python3 -c "
import json
report = {
    'reporter': {'kind': 'user', 'typeId': '$USER_TYPE', 'id': 'reporter-atmo-$i'},
    'reportedAt': '2026-03-28T12:00:00Z',
    'reportedForReason': {'reason': 'Reported for review'},
    'reportedItem': {
        'id': 'atmo-post-$i',
        'typeId': '$ITEM_TYPE',
        'data': {
            'text': '${TEXTS[$i]}',
            'authorDid': {'id': 'did:plc:atmo-user-$i', 'typeId': '$USER_TYPE'},
            'rkey': 'atmo-rkey-$i',
            'createdAt': '2026-03-28T12:00:00Z',
            'atUri': 'at://did:plc:atmo-user-$i/app.bsky.feed.post/atmo-rkey-$i',
            'isLive': True,
            'images': ['$IMAGE_BASE/${IMAGES[$i]}']
        }
    }
}
with open('/tmp/report_payload.json', 'w') as f:
    json.dump(report, f)
"
  curl -s -o /dev/null -w "Report $((i+1)): %{http_code}\n" \
    -X POST "$BASE_URL/api/v1/report" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d @/tmp/report_payload.json
done

echo "=== Done! ==="
