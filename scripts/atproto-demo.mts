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
 *   --coop-url       Base URL of the Coop server  [default: http://localhost:3000]
 *   --rate-limit     Max posts submitted per minute                     [default: 10]
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
const coopUrl = getArg('--coop-url') ?? 'http://localhost:3000';
const rateLimit = Number(getArg('--rate-limit') ?? '10');
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

// --- Submission logic --------------------------------------------------------

interface CoopItem {
  id: string;
  typeId: string;
  data: {
    text: string;
    url: string;
    authorHandle: string;
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

function postToCoopItem(
  did: string,
  rkey: string,
  record: BlueskyPost,
): CoopItem {
  const atUri = buildAtUri(did, rkey);
  return {
    id: atUri,
    typeId: postTypeId as string,
    data: {
      text: record.text,
      url: buildBskyUrl(did, rkey),
      authorHandle: did,
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

// --- Main -------------------------------------------------------------------

let submitted = 0;
let skipped = 0;
let errors = 0;

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

      // Rate limit
      if (!limiter.tryConsume()) {
        skipped++;
        return;
      }

      const item = postToCoopItem(msg.did, msg.commit.rkey, record);

      if (dryRun) {
        logStatus('DRY RUN', record.text);
        console.log('  Would submit:', JSON.stringify(item, null, 2));
        submitted++;
        return;
      }

      submitToCoop(item)
        .then(() => {
          submitted++;
          logStatus('Submitted', record.text);
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
    `[${new Date().toISOString()}] Status — submitted: ${submitted}, skipped: ${skipped}, errors: ${errors}`,
  );
}, 60_000);

process.on('SIGINT', () => {
  console.log(
    `\nShutting down. Submitted: ${submitted}, Skipped: ${skipped}, Errors: ${errors}`,
  );
  process.exit(0);
});

connect();
