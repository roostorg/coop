#!/bin/bash
# Seeds Newsmast org with ActivityPub item types, a review queue, an enqueue-all
# rule, and synthetic ActivityPub content for the review queue.

set -e

PGPASSWORD=postgres123
DB_HOST=localhost
DB_USER=postgres
DB_NAME=postgres
ORG_ID=a1b2c3d4e5f
API_KEY=2778bec6a8056a4b9d2219c484cf2623c4aee26870f1ef3a404090ec194b0a60
API_URL=http://localhost:8080/api/v1

psql="psql -h $DB_HOST -U $DB_USER -d $DB_NAME -q"

echo "==> Creating ActivityPub item types for Newsmast..."

PGPASSWORD=$PGPASSWORD $psql <<'SQL'
-- ActivityPub Post item type
INSERT INTO public.item_types VALUES (
  'nm_post_type01', 'a1b2c3d4e5f', 'ActivityPub Post',
  'A post or note from the fediverse (ActivityPub)',
  'CONTENT',
  '{"{\"name\": \"text\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"author_handle\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"author_instance\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"language\", \"type\": \"STRING\", \"required\": false, \"container\": null}","{\"name\": \"uri\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"in_reply_to\", \"type\": \"STRING\", \"required\": false, \"container\": null}","{\"name\": \"num_replies\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}","{\"name\": \"num_boosts\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}","{\"name\": \"num_favorites\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}"}',
  '2026-04-08 00:00:00+00', NULL, NULL, NULL, NULL, NULL, NULL,
  '["2026-04-08 00:00:00+00",)', false, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

-- ActivityPub Profile item type
INSERT INTO public.item_types VALUES (
  'nm_profile_ty01', 'a1b2c3d4e5f', 'ActivityPub Profile',
  'A user profile/actor from the fediverse (ActivityPub)',
  'CONTENT',
  '{"{\"name\": \"display_name\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"handle\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"instance\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"bio\", \"type\": \"STRING\", \"required\": false, \"container\": null}","{\"name\": \"uri\", \"type\": \"STRING\", \"required\": true, \"container\": null}","{\"name\": \"followers_count\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}","{\"name\": \"following_count\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}","{\"name\": \"statuses_count\", \"type\": \"NUMBER\", \"required\": false, \"container\": null}"}',
  '2026-04-08 00:00:00+00', NULL, NULL, NULL, NULL, NULL, NULL,
  '["2026-04-08 00:00:00+00",)', false, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

-- Default User type for Newsmast
INSERT INTO public.item_types VALUES (
  'nm_user_type01', 'a1b2c3d4e5f', 'User',
  'Default user', 'USER',
  '{"{\"name\": \"name\", \"type\": \"STRING\", \"required\": false, \"container\": null}"}',
  '2026-04-08 00:00:00+00', NULL, NULL, NULL, NULL, NULL, NULL,
  '["2026-04-08 00:00:00+00",)', true, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

-- Review queue
INSERT INTO manual_review_tool.manual_review_queues VALUES (
  'nm_queue_01', 'Reported Content', '2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00',
  'a1b2c3d4e5f', true, 'Default queue for reviewing flagged ActivityPub content', false, false
) ON CONFLICT (id) DO NOTHING;

-- Enqueue action
INSERT INTO public.actions VALUES (
  'nm_enqueue_act', 'Enqueue for Review',
  'Send content to the manual review queue for human moderation',
  NULL, '2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00',
  'a1b2c3d4e5f', NULL, NULL, 'NONE',
  '["2026-04-08 00:00:00+00",)', 'ENQUEUE_TO_MRT', '{}', false, '{}'
) ON CONFLICT (id) DO NOTHING;

-- Link the enqueue action to post and profile item types
INSERT INTO public.actions_and_item_types VALUES ('2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00', 'nm_enqueue_act', 'nm_post_type01', '["2026-04-08 00:00:00+00",)') ON CONFLICT DO NOTHING;
INSERT INTO public.actions_and_item_types VALUES ('2026-04-08 00:00:00+00', '2026-04-08 00:00:00+00', 'nm_enqueue_act', 'nm_profile_ty01', '["2026-04-08 00:00:00+00",)') ON CONFLICT DO NOTHING;

SQL

echo "==> DB setup complete."

echo "==> Submitting synthetic ActivityPub items..."

# Submit items via the API (the rule engine + MRT enqueue action will route them to the queue)
# But since we may not have a live rule yet, we'll directly enqueue jobs into the MRT queue.

PGPASSWORD=$PGPASSWORD $psql <<'SQL'

-- Directly insert jobs into the review queue using job_creations table
-- and the Redis-backed queue. We'll use job_creations for the audit trail
-- and insert queue entries.

-- Insert synthetic items into the review queue via job_creations
INSERT INTO manual_review_tool.job_creations (id, org_id, queue_id, item_id, item_type_id, created_at, enqueue_source_info, policy_ids) VALUES
  ('nm_job_001', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-001', 'nm_post_type01', '2026-04-08 09:15:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_002', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-002', 'nm_post_type01', '2026-04-08 09:22:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_003', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-003', 'nm_post_type01', '2026-04-08 09:35:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_004', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-004', 'nm_post_type01', '2026-04-08 09:41:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_005', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-005', 'nm_post_type01', '2026-04-08 10:02:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_006', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-006', 'nm_post_type01', '2026-04-08 10:15:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_007', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-007', 'nm_post_type01', '2026-04-08 10:28:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_008', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-post-008', 'nm_post_type01', '2026-04-08 10:33:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_009', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-profile-001', 'nm_profile_ty01', '2026-04-08 10:45:00+00', '{"kind": "REPORT"}', '{}'),
  ('nm_job_010', 'a1b2c3d4e5f', 'nm_queue_01', 'ap-profile-002', 'nm_profile_ty01', '2026-04-08 10:50:00+00', '{"kind": "REPORT"}', '{}')
ON CONFLICT (id) DO NOTHING;

SQL

echo "==> Submitting items via REST API..."

# Submit ActivityPub posts through the content API so they flow through
# the full pipeline (Scylla storage, rule evaluation, etc.)
curl -s -X POST "$API_URL/items/async/" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
  "items": [
    {
      "id": "ap-post-001",
      "typeId": "nm_post_type01",
      "data": {
        "text": "Just saw a really disturbing video being shared around. People are saying its from a warzone but I think its fake propaganda meant to radicalize people. Please report if you see it. #misinformation #factcheck",
        "author_handle": "@truthseeker@mastodon.social",
        "author_instance": "mastodon.social",
        "language": "en",
        "uri": "https://mastodon.social/users/truthseeker/statuses/111234567890",
        "num_replies": 45,
        "num_boosts": 230,
        "num_favorites": 89
      }
    },
    {
      "id": "ap-post-002",
      "typeId": "nm_post_type01",
      "data": {
        "text": "BREAKING: The government is hiding the REAL numbers. Wake up sheeple. They dont want you to know the truth about the vaccines. My cousin works at a hospital and says they are covering up deaths. Share before they delete this!!!",
        "author_handle": "@wakeup99@fediverse.town",
        "author_instance": "fediverse.town",
        "language": "en",
        "uri": "https://fediverse.town/users/wakeup99/statuses/111234567891",
        "num_replies": 312,
        "num_boosts": 1580,
        "num_favorites": 445
      }
    },
    {
      "id": "ap-post-003",
      "typeId": "nm_post_type01",
      "data": {
        "text": "Beautiful sunrise this morning over Edinburgh. Scotland never disappoints. \ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f #photography #scotland #nature",
        "author_handle": "@scottishviews@pixelfed.social",
        "author_instance": "pixelfed.social",
        "language": "en",
        "uri": "https://pixelfed.social/users/scottishviews/statuses/111234567892",
        "num_replies": 12,
        "num_boosts": 87,
        "num_favorites": 340
      }
    },
    {
      "id": "ap-post-004",
      "typeId": "nm_post_type01",
      "data": {
        "text": "If you support [political group] you are literally subhuman trash and deserve everything coming to you. I hope you all suffer. This is not a threat, its a promise. Your kind will be dealt with.",
        "author_handle": "@angryman42@shitpost.cloud",
        "author_instance": "shitpost.cloud",
        "language": "en",
        "uri": "https://shitpost.cloud/users/angryman42/statuses/111234567893",
        "num_replies": 89,
        "num_boosts": 12,
        "num_favorites": 34
      }
    },
    {
      "id": "ap-post-005",
      "typeId": "nm_post_type01",
      "data": {
        "text": "Selling premium accounts cheap!! DM me for Netflix, Spotify, Disney+ all working. Lifetime warranty. Bulk discounts available. Payment via crypto only. #deals #premium #accounts",
        "author_handle": "@deals4u@fosstodon.org",
        "author_instance": "fosstodon.org",
        "language": "en",
        "uri": "https://fosstodon.org/users/deals4u/statuses/111234567894",
        "num_replies": 5,
        "num_boosts": 3,
        "num_favorites": 8
      }
    },
    {
      "id": "ap-post-006",
      "typeId": "nm_post_type01",
      "data": {
        "text": "New blog post: Understanding ActivityPub and the Fediverse - A technical deep dive into how decentralized social networking actually works under the hood. https://techblog.example.com/activitypub-explained",
        "author_handle": "@devblog@hachyderm.io",
        "author_instance": "hachyderm.io",
        "language": "en",
        "uri": "https://hachyderm.io/users/devblog/statuses/111234567895",
        "num_replies": 28,
        "num_boosts": 156,
        "num_favorites": 412
      }
    },
    {
      "id": "ap-post-007",
      "typeId": "nm_post_type01",
      "data": {
        "text": "Hey @admin I keep getting harassed by users from that instance. They are sending me slurs in DMs and making fake accounts with my photos. Can something be done? This has been going on for weeks and Im scared.",
        "author_handle": "@safeuser@newsmast.org",
        "author_instance": "newsmast.org",
        "language": "en",
        "uri": "https://newsmast.org/users/safeuser/statuses/111234567896",
        "in_reply_to": "https://newsmast.org/users/admin/statuses/111234567800",
        "num_replies": 3,
        "num_boosts": 0,
        "num_favorites": 15
      }
    },
    {
      "id": "ap-post-008",
      "typeId": "nm_post_type01",
      "data": {
        "text": "URGENT: Send 0.5 ETH to this address and receive 5 ETH back! Elon Musk is doing a crypto giveaway RIGHT NOW. Only 100 spots left!! Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f... Act fast!! \ud83d\udcb0\ud83d\ude80",
        "author_handle": "@cryptoking@mstdn.jp",
        "author_instance": "mstdn.jp",
        "language": "en",
        "uri": "https://mstdn.jp/users/cryptoking/statuses/111234567897",
        "num_replies": 2,
        "num_boosts": 45,
        "num_favorites": 12
      }
    }
  ]
}'

echo ""

# Submit ActivityPub profiles
curl -s -X POST "$API_URL/items/async/" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
  "items": [
    {
      "id": "ap-profile-001",
      "typeId": "nm_profile_ty01",
      "data": {
        "display_name": "CRYPTO GAINS \ud83d\udcb0\ud83d\ude80 (NOT A BOT)",
        "handle": "@cryptoking",
        "instance": "mstdn.jp",
        "bio": "Making $10k/day with crypto!! FREE signals in DM. Join our VIP group. 100% guaranteed returns. Not financial advice (but it totally is lol). Link in bio!",
        "uri": "https://mstdn.jp/users/cryptoking",
        "followers_count": 15234,
        "following_count": 1,
        "statuses_count": 8923
      }
    },
    {
      "id": "ap-profile-002",
      "typeId": "nm_profile_ty01",
      "data": {
        "display_name": "Sarah Chen",
        "handle": "@sarahchen",
        "instance": "newsmast.org",
        "bio": "Journalist at The Guardian. Covering tech policy and digital rights. She/her. Views my own. sarah@guardian.co.uk",
        "uri": "https://newsmast.org/users/sarahchen",
        "followers_count": 4521,
        "following_count": 890,
        "statuses_count": 2341
      }
    }
  ]
}'

echo ""
echo "==> Done! Synthetic ActivityPub data has been seeded for Newsmast."
echo "    Login: exampleadmin@newsmast.org / password"
echo "    Review queue: 'Reported Content'"
