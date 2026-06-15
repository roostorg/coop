#!/usr/bin/env node
// Submits Lovable-themed demo items as reports so they land in the MRT queue.
// Usage:
//   API_KEY=... API_URL=http://localhost:8080 \
//     node scripts/seed-lovable-demo.mjs
//
// API_URL defaults to http://localhost:8080. API_KEY is required.

const API_URL = process.env.API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || process.env.TAP_API_KEY;
const POST_TYPE_ID = process.env.POST_TYPE_ID;
const ACCOUNT_TYPE_ID = process.env.ACCOUNT_TYPE_ID;
if (!API_KEY) {
  console.error('API_KEY (or TAP_API_KEY) env var required');
  process.exit(1);
}
if (!POST_TYPE_ID || !ACCOUNT_TYPE_ID) {
  console.error('POST_TYPE_ID and ACCOUNT_TYPE_ID env vars required.');
  console.error('Get them via:');
  console.error('  docker compose exec postgres psql -U postgres -d postgres -c "SELECT id, name FROM item_types WHERE name LIKE \'ATproto%\';"');
  process.exit(1);
}

// Lovable-themed demo content. Posts containing "review" should trigger the
// Generated App Reviews routing rule. Others land in the appropriate flagged
// queues via signal-based routing rules (OpenAI Moderation, text matching).
const DEMO_POSTS = [
  // GENERATED APP REVIEWS — contain "review" so the keyword routing rule fires
  {
    text: 'New Lovable build submitted for review: vintage car portfolio site, please take a look 🚗',
    handle: 'designerdana.bsky.social',
    displayName: 'Dana K',
  },
  {
    text: 'Meal planner app finished, requesting review before I publish it on the Lovable showcase',
    handle: 'cookbookevan.bsky.social',
    displayName: 'Evan H',
  },
  {
    text: 'Pokemon habit tracker is ready for review. Built it entirely in Lovable, took two evenings 🐾',
    handle: 'pokedex.bsky.social',
    displayName: 'Mia',
  },
  {
    text: 'Submitted my houseplant care app for review. Hoping to ship it this week — feedback welcome',
    handle: 'greenthumb.bsky.social',
    displayName: 'Aisha P',
  },
  {
    text: 'ML interview flashcards app in review queue now. Made the whole thing with Lovable + open sourced',
    handle: 'gradstudent.bsky.social',
    displayName: 'Priya R',
  },
  {
    text: 'Recipe organizer ready for review! Lovable handled the auth + DB, I just designed the UI',
    handle: 'chefatheart.bsky.social',
    displayName: 'Marco T',
  },
  {
    text: 'Reading list tracker awaiting review. Goodreads import works, fingers crossed it passes 📚',
    handle: 'bookworm22.bsky.social',
    displayName: 'Sarah B',
  },
  // USER PROMPT FLAGS — clear violations + borderline content for review queue
  {
    text: 'Built a Netflix login clone in Lovable that captures credentials for "testing" lol',
    handle: 'phisher.bsky.social',
    displayName: 'shadynoob',
  },
  {
    text: 'Used Lovable to generate a fake IRS refund site, see if anyone falls for it',
    handle: 'taxman.bsky.social',
    displayName: 'IRS Refunds',
  },
  {
    text: 'Generated a password cracker for school accounts with Lovable. Bypass auth easily',
    handle: 'h4cker.bsky.social',
    displayName: 'kingofschool',
  },
  {
    text: 'Lovable made me a deepfake nude generator, can edit anyone into porn now',
    handle: 'badidea.bsky.social',
    displayName: 'Robin',
  },
  {
    text: 'Built a doxxing site with Lovable that scrapes home addresses of journalists I dislike',
    handle: 'doxxxor.bsky.social',
    displayName: 'doxxxor',
  },
  {
    text: 'Crypto pump bot built in Lovable. Auto-shills tokens before dumping. Free money',
    handle: 'pumpkin.bsky.social',
    displayName: 'CoinKing',
  },
  {
    text: 'Stalker dashboard for tracking my ex’s real time location. Lovable made it easy',
    handle: 'definitelyfine.bsky.social',
    displayName: 'Alex',
  },
  {
    text: 'AI chatbot that says racial slurs and tells women they belong in the kitchen. Free speech 😎',
    handle: 'hateful.bsky.social',
    displayName: 'edgelord',
  },
];

// Synthetic reporter DID — same one for every report, doesn't have to be real
const REPORTER_DID = 'did:plc:lovable-demo-reporter';

async function submit(item, i) {
  const did = `did:plc:lovable-demo-${i.toString(36)}`;
  const rkey = `${Date.now().toString(36)}${i}`;
  const atUri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const createdAt = new Date().toISOString();

  const reportedItem = {
    id: atUri,
    typeId: POST_TYPE_ID,
    data: {
      text: item.text,
      authorDid: { id: did, typeId: ACCOUNT_TYPE_ID },
      rkey,
      cid: `bafy${rkey}`,
      createdAt,
      atUri,
      isLive: true,
    },
  };

  // Also include a synthetic account item alongside so the author renders
  const accountItem = {
    id: did,
    typeId: ACCOUNT_TYPE_ID,
    data: {
      did,
      handle: item.handle,
      displayName: item.displayName,
      isActive: true,
    },
  };

  const body = {
    reporter: {
      kind: 'user',
      typeId: ACCOUNT_TYPE_ID,
      id: REPORTER_DID,
    },
    reportedAt: createdAt,
    reportedForReason: { policyId: null, reason: null, csam: false },
    reportedItem,
    additionalItemSubmissions: [accountItem],
  };

  const resp = await fetch(`${API_URL}/api/v1/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`  ✗ [${i + 1}] ${resp.status} ${text}`);
    return false;
  }
  console.log(`  ✓ [${i + 1}/${DEMO_POSTS.length}] ${item.handle}: ${item.text.slice(0, 60)}...`);
  return true;
}

console.log(`Submitting ${DEMO_POSTS.length} Lovable-themed demo posts to ${API_URL}...`);
let ok = 0;
for (let i = 0; i < DEMO_POSTS.length; i++) {
  if (await submit(DEMO_POSTS[i], i)) ok++;
}
console.log(`Done. ${ok}/${DEMO_POSTS.length} submitted successfully.`);
