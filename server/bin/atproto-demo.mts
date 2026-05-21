#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * AT Protocol firehose connector for local Coop demos.
 *
 * Subscribes to the Bluesky Jetstream and forwards posts to a local Coop
 * instance as item submissions, giving you a realistic stream of content to
 * review without needing to integrate a real platform.
 *
 * Prerequisites:
 *   1. Coop must be running locally (`npm run server:start`)
 *   2. Run `cd server && npm run atproto:setup -- --org-id <id>` once to
 *      create the item types and get a post type ID
 *
 * Usage:
 *   npm run atproto:demo -- --api-key <key> --post-type-id <id>
 *
 * Options:
 *   --api-key        Coop API key (from `npm run create-org`)           [required]
 *   --post-type-id   Bluesky Post item type ID (from atproto:setup)     [required]
 *   --user-type-id   Bluesky User item type ID (from atproto:setup); enables mock report submission
 *   --coop-url       Base URL of the Coop server  [default: http://localhost:3000]
 *   --rate-limit     Max posts submitted per minute                     [default: 100]
 *   --dry-run        Print submissions without sending them to Coop
 *   --langs          Comma-separated language codes to filter (e.g. en,es)
 */

import process from 'node:process';

// Require Node 24+ for native WebSocket and fetch.
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error('Node 22 or later is required (project uses Node 24).');
  process.exit(1);
}

const JETSTREAM_URL =
  'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';

// --- CLI args (manual parse to avoid importing yargs outside server/) --------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const apiKey = getArg('--api-key');
const postTypeId = getArg('--post-type-id');
const userTypeId = getArg('--user-type-id');
const coopUrl = getArg('--coop-url') ?? 'http://localhost:3000';
const rateLimit = Number(getArg('--rate-limit') ?? '100');
const dryRun = hasFlag('--dry-run');
const langsFilter = getArg('--langs')
  ? new Set((getArg('--langs') as string).split(',').map((l) => l.trim()))
  : null;

if (!apiKey || !postTypeId) {
  console.error(
    'Usage: npm run atproto:demo -- --api-key <key> --post-type-id <id>\n' +
      'Run `cd server && npm run atproto:setup -- --org-id <id>` first to get the post type ID.',
  );
  process.exit(1);
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(
    'See the top of scripts/atproto-demo.ts for full option documentation.',
  );
  process.exit(0);
}

// --- Bluesky profile cache ---------------------------------------------------

interface BlueskyProfile {
  handle: string;
  displayName?: string;
}

const profileCache = new Map<string, BlueskyProfile>();

async function fetchProfile(did: string): Promise<BlueskyProfile> {
  const cached = profileCache.get(did);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    );
    if (!response.ok) throw new Error(`${response.status}`);
    const data = (await response.json()) as {
      handle: string;
      displayName?: string;
    };
    const profile: BlueskyProfile = { handle: data.handle, displayName: data.displayName };
    profileCache.set(did, profile);
    return profile;
  } catch {
    return { handle: did };
  }
}

// --- Types for Jetstream messages --------------------------------------------

interface JetstreamCommit {
  kind: 'commit';
  did: string;
  commit: {
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: BlueskyPost;
  };
}

interface BlueskyPost {
  $type: 'app.bsky.feed.post';
  text: string;
  createdAt?: string;
  langs?: string[];
  reply?: {
    parent: { uri: string };
    root: { uri: string };
  };
  embed?: {
    $type: string;
    external?: { uri: string };
    images?: Array<{ image: unknown; alt: string }>;
  };
}

// --- Rate limiter (token bucket) --------------------------------------------

class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefill: number;

  constructor(perMinute: number) {
    this.maxTokens = perMinute;
    this.tokens = perMinute;
    this.refillIntervalMs = 60_000;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }
}

// --- Post sample buffer (for report submission) -----------------------------

interface SampledPost {
  did: string;
  rkey: string;
  record: BlueskyPost;
}

const SAMPLE_BUFFER_MAX = 20;
const sampleBuffer: SampledPost[] = [];

function addToSampleBuffer(post: SampledPost) {
  if (sampleBuffer.length < SAMPLE_BUFFER_MAX) {
    sampleBuffer.push(post);
  } else {
    const idx = Math.floor(Math.random() * SAMPLE_BUFFER_MAX);
    sampleBuffer[idx] = post;
  }
}

// --- Submission logic --------------------------------------------------------

interface CoopItem {
  id: string;
  typeId: string;
  data: {
    text: string;
    url: string;
    did: string;
    handle: string;
    displayName?: string;
    langs?: string;
    createdAt?: string;
    replyTo?: string;
  };
}

function buildAtUri(did: string, rkey: string): string {
  return `at://${did}/app.bsky.feed.post/${rkey}`;
}

function buildBskyUrl(did: string, rkey: string): string {
  return `https://bsky.app/profile/${did}/post/${rkey}`;
}

async function postToCoopItem(
  did: string,
  rkey: string,
  record: BlueskyPost,
): Promise<CoopItem> {
  const atUri = buildAtUri(did, rkey);
  const profile = await fetchProfile(did);
  return {
    id: atUri,
    typeId: postTypeId as string,
    data: {
      text: record.text,
      url: buildBskyUrl(did, rkey),
      did,
      handle: profile.handle,
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      ...(record.langs?.length ? { langs: record.langs.join(', ') } : {}),
      ...(record.createdAt ? { createdAt: record.createdAt } : {}),
      ...(record.reply ? { replyTo: record.reply.parent.uri } : {}),
    },
  };
}

async function submitToCoop(item: CoopItem): Promise<void> {
  const response = await fetch(`${coopUrl}/api/v1/items/async/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey as string,
    },
    body: JSON.stringify({ items: [item] }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Coop returned ${response.status}: ${body}`);
  }
}

async function submitReport(post: SampledPost): Promise<string> {
  const item = await postToCoopItem(post.did, post.rkey, post.record);
  const payload = {
    reporter: {
      kind: 'user',
      id: post.did,
      typeId: userTypeId,
    },
    reportedAt: new Date().toISOString(),
    reportedItem: item,
    reportedForReason: {
      reason: 'Automatically flagged for demo purposes.',
    },
  };

  if (dryRun) {
    console.log(
      `[${new Date().toISOString()}] DRY RUN report:`,
      JSON.stringify(payload, null, 2),
    );
    return 'dry-run';
  }

  const response = await fetch(`${coopUrl}/api/v1/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey as string,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Coop returned ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { reportId: string };
  return data.reportId;
}

// --- Main -------------------------------------------------------------------

let submitted = 0;
let skipped = 0;
let errors = 0;
let reportsSubmitted = 0;
let reportErrors = 0;

const limiter = new RateLimiter(rateLimit);

function logStatus(action: string, text: string) {
  const preview = text.length > 60 ? text.slice(0, 57) + '…' : text;
  console.log(`[${new Date().toISOString()}] ${action}: "${preview}"`);
}

function connect() {
  console.log(`Connecting to Jetstream…`);
  console.log(
    `  Coop: ${coopUrl}  |  rate limit: ${rateLimit}/min  |  dry run: ${dryRun}`,
  );
  if (langsFilter) {
    console.log(`  Language filter: ${[...langsFilter].join(', ')}`);
  }
  console.log('');

  // Node 24 ships native WebSocket (WHATWG). Cast to any here because
  // @types/node may not yet include the global WebSocket type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws = new (globalThis as any).WebSocket(JETSTREAM_URL);

  ws.addEventListener('open', () => {
    console.log('Connected to Jetstream. Waiting for posts…\n');
  });

  ws.addEventListener(
    'message',
    (event: { data: string }) => {
      let msg: JetstreamCommit;
      try {
        msg = JSON.parse(event.data) as JetstreamCommit;
      } catch {
        return;
      }

      if (
        msg.kind !== 'commit' ||
        msg.commit.operation !== 'create' ||
        msg.commit.collection !== 'app.bsky.feed.post' ||
        !msg.commit.record
      ) {
        return;
      }

      const record = msg.commit.record;

      // Language filter
      if (langsFilter && record.langs) {
        const hasMatch = record.langs.some((l) => langsFilter.has(l));
        if (!hasMatch) {
          return;
        }
      }

      // Sample into the report buffer (independent of rate limit)
      addToSampleBuffer({ did: msg.did, rkey: msg.commit.rkey, record });

      // Rate limit
      if (!limiter.tryConsume()) {
        skipped++;
        return;
      }

      postToCoopItem(msg.did, msg.commit.rkey, record)
        .then((item) => {
          if (dryRun) {
            logStatus('DRY RUN', record.text);
            console.log('  Would submit:', JSON.stringify(item, null, 2));
            submitted++;
            return;
          }
          return submitToCoop(item).then(() => {
            submitted++;
            logStatus('Submitted', record.text);
          });
        })
        .catch((err: unknown) => {
          errors++;
          console.error(
            `[${new Date().toISOString()}] ERROR submitting: ${String(err)}`,
          );
        });
    },
  );

  ws.addEventListener('close', () => {
    console.log(
      `\nJetstream connection closed. Submitted: ${submitted}, Skipped (rate): ${skipped}, Errors: ${errors}`,
    );
    console.log('Reconnecting in 5 seconds…');
    setTimeout(connect, 5_000);
  });

  ws.addEventListener('error', (event: unknown) => {
    console.error('WebSocket error:', event);
  });
}

// Print running totals every 60 seconds
setInterval(() => {
  console.log(
    `[${new Date().toISOString()}] Status — submitted: ${submitted}, skipped: ${skipped}, errors: ${errors}, reports: ${reportsSubmitted}, report errors: ${reportErrors}`,
  );
}, 60_000);

// Submit one mock report per minute from the sample buffer
setInterval(() => {
  if (!userTypeId) return;
  if (sampleBuffer.length === 0) {
    console.log(
      `[${new Date().toISOString()}] Report: buffer empty, skipping this interval`,
    );
    return;
  }
  const idx = Math.floor(Math.random() * sampleBuffer.length);
  const post = sampleBuffer[idx];
  sampleBuffer.length = 0;
  submitReport(post)
    .then((reportId) => {
      reportsSubmitted++;
      console.log(`[${new Date().toISOString()}] Report submitted: ${reportId}`);
    })
    .catch((err: unknown) => {
      reportErrors++;
      console.error(
        `[${new Date().toISOString()}] ERROR submitting report: ${String(err)}`,
      );
    });
}, 60_000);

process.on('SIGINT', () => {
  console.log(
    `\nShutting down. Submitted: ${submitted}, Skipped: ${skipped}, Errors: ${errors}, Reports: ${reportsSubmitted}, Report errors: ${reportErrors}`,
  );
  process.exit(0);
});

connect();
