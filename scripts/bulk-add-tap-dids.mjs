#!/usr/bin/env node
// Pulls unique DIDs from Bluesky Jetstream and bulk-adds them to TAP so the
// connector starts receiving events. Usage:
//   node scripts/bulk-add-tap-dids.mjs [count]
//   TAP_URL=http://localhost:2480 node scripts/bulk-add-tap-dids.mjs 1000

const JETSTREAM_URL =
  'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
const TAP_URL = process.env.TAP_URL || 'http://localhost:2480';
const TARGET = Number(process.argv[2] || 500);

const dids = new Set();
const ws = new WebSocket(JETSTREAM_URL);

console.log(`Collecting ${TARGET} unique DIDs from Jetstream...`);

ws.addEventListener('message', (ev) => {
  try {
    const msg = JSON.parse(ev.data);
    if (typeof msg.did === 'string') {
      const before = dids.size;
      dids.add(msg.did);
      if (dids.size !== before && dids.size % 50 === 0) {
        console.log(`  ${dids.size}/${TARGET}`);
      }
      if (dids.size >= TARGET) {
        ws.close();
      }
    }
  } catch {
    // ignore parse errors
  }
});

ws.addEventListener('close', async () => {
  const list = Array.from(dids);
  console.log(`Collected ${list.length}. POSTing to ${TAP_URL}/repos/add ...`);
  try {
    const r = await fetch(`${TAP_URL}/repos/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dids: list }),
    });
    if (!r.ok) {
      console.error(`TAP addRepos failed: ${r.status} ${await r.text()}`);
      process.exit(1);
    }
    console.log(`Added ${list.length} DIDs to TAP.`);
  } catch (err) {
    console.error('addRepos request failed:', err);
    process.exit(1);
  }
});

ws.addEventListener('error', (err) => {
  console.error('Jetstream WebSocket error:', err);
  process.exit(1);
});
