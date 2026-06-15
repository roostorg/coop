#!/usr/bin/env node
// Submits Lovable-themed demo items as reports so they land in the MRT queue.
// Usage:
//   API_KEY=... API_URL=http://localhost:8080 \
//     node scripts/seed-lovable-demo.mjs
//
// API_URL defaults to http://localhost:8080. API_KEY is required.

const API_URL = process.env.API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || process.env.TAP_API_KEY;
if (!API_KEY) {
  console.error('API_KEY (or TAP_API_KEY) env var required');
  process.exit(1);
}

// Lovable-themed demo content. Mix of safe (most), borderline, and violations.
const DEMO_POSTS = [
  // SAFE — show "normal traffic" in queue
  {
    text: 'Just shipped my Lovable portfolio site, took 20 minutes start to finish 🎨',
    handle: 'designerdana.bsky.social',
    displayName: 'Dana K',
  },
  {
    text: 'Vibe coded a meal planner this weekend with Lovable. What features should I add??',
    handle: 'cookbookevan.bsky.social',
    displayName: 'Evan H',
  },
  {
    text: 'My Pokemon-themed habit tracker is live, all generated in Lovable. Catch them all = build habits 🐾',
    handle: 'pokedex.bsky.social',
    displayName: 'Mia',
  },
  {
    text: 'Houseplant care app built in Lovable + deployed in a single afternoon. AI tooling is wild.',
    handle: 'greenthumb.bsky.social',
    displayName: 'Aisha P',
  },
  {
    text: 'anyone else hit the Lovable rate limit constantly? need to upgrade soon',
    handle: 'mvpguy.bsky.social',
    displayName: 'Sam',
  },
  {
    text: 'Built a flashcard app with Lovable for studying ML interviews. Open sourced it, link below!',
    handle: 'gradstudent.bsky.social',
    displayName: 'Priya R',
  },
  // BORDERLINE — policy ambiguity, good for reviewer judgment calls
  {
    text: 'Built a dashboard for tracking my ex’s social media activity with Lovable (research purposes)',
    handle: 'definitelyfine.bsky.social',
    displayName: 'Alex',
  },
  {
    text: 'Made an AI girlfriend chatbot in Lovable, very wholesome trust me',
    handle: 'lonelydev.bsky.social',
    displayName: 'Tom',
  },
  {
    text: 'casino app generated in Lovable, totally educational for learning JS',
    handle: 'devluck.bsky.social',
    displayName: 'Jordan',
  },
  // CLEAR VIOLATIONS — the demo moments
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
    text: 'Generated a password cracker for school accounts with Lovable',
    handle: 'h4cker.bsky.social',
    displayName: 'kingofschool',
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
    typeId: 'ATproto-post',
    data: {
      text: item.text,
      authorDid: { id: did, typeId: 'ATproto-account' },
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
    typeId: 'ATproto-account',
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
      typeId: 'ATproto-account',
      id: REPORTER_DID,
    },
    reportedAt: createdAt,
    reportedForReason: { policyId: null, reason: null, csam: false },
    reportedItem,
    additionalItemSubmissions: [accountItem],
  };

  const resp = await fetch(`${API_URL}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
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
