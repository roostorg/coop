#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * AT Protocol firehose connector for local Coop demos.
 *
 * Subscribes to the AT Protocol Jetstream and forwards posts and users to a
 * local Coop instance as item submissions, giving you a realistic stream of
 * content to review without needing to integrate a real platform.
 *
 * Prerequisites:
 *   1. Coop must be running locally (`npm run server:start`)
 *   2. Run `cd server && npm run atproto:setup -- --org-id <id>` once to
 *      create the item types and get the type IDs
 *
 * Usage:
 *   npm run atproto:demo -- --api-key <key> --post-type-id <id>
 *
 * Options:
 *   --api-key             Coop API key (from `npm run create-org`)           [required]
 *   --post-type-id        atproto Post item type ID (from atproto:setup)      [required]
 *   --user-type-id        atproto User item type ID (from atproto:setup); enables user
 *                         item submission and mock report submission
 *   --coop-url            Base URL of the Coop server  [default: http://localhost:3000]
 *   --rate-limit          Max posts submitted per minute                     [default: 100]
 *   --report-rate-limit   Max reports (posts + users combined) per minute    [default: 1]
 *   --dry-run             Print submissions without sending them to Coop
 *   --langs               Comma-separated language codes to filter (e.g. en,es)
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
const reportRateLimit = Number(getArg('--report-rate-limit') ?? '1');
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

// --- atproto profile cache ---------------------------------------------------

interface BlueskyProfile {
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  indexedAt?: string;
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
      description?: string;
      avatar?: string;
      indexedAt?: string;
    };
    const profile: BlueskyProfile = {
      handle: data.handle,
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...(data.avatar ? { avatar: data.avatar } : {}),
      ...(data.indexedAt ? { indexedAt: data.indexedAt } : {}),
    };
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
    external?: { uri: string; title?: string; description?: string; thumb?: { ref: { $link: string } } };
    images?: Array<{ image: { ref: { $link: string } }; alt?: string }>;
    video?: { ref: { $link: string } };
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
  data: Record<string, unknown>;
}

function buildAtUri(did: string, rkey: string): string {
  return `at://${did}/app.bsky.feed.post/${rkey}`;
}

function buildBskyUrl(did: string, rkey: string): string {
  return `https://bsky.app/profile/${did}/post/${rkey}`;
}

function buildBskyProfileUrl(did: string): string {
  return `https://bsky.app/profile/${did}`;
}

const BSKY_CDN_BASE = 'https://cdn.bsky.app/img/feed_thumbnail/plain';
const BSKY_VIDEO_BASE = 'https://video.bsky.app/watch';

function buildImageCdnUrl(did: string, cid: string): string {
  return `${BSKY_CDN_BASE}/${did}/${cid}@jpeg`;
}

function buildVideoUrl(did: string, cid: string): string {
  return `${BSKY_VIDEO_BASE}/${did}/${cid}/playlist.m3u8`;
}

async function postToCoopItem(
  did: string,
  rkey: string,
  record: BlueskyPost,
): Promise<CoopItem> {
  const atUri = buildAtUri(did, rkey);
  const profile = await fetchProfile(did);

  const images = (record.embed?.images ?? [])
    .map((img) => img.image?.ref?.$link)
    .filter((cid): cid is string => cid != null)
    .map((cid) => buildImageCdnUrl(did, cid));

  const videoCid = record.embed?.video?.ref?.$link ?? null;
  const video = videoCid ? buildVideoUrl(did, videoCid) : null;

  return {
    id: atUri,
    typeId: postTypeId as string,
    data: {
      text: record.text,
      url: buildBskyUrl(did, rkey),
      ...(userTypeId ? { creator: { id: did, typeId: userTypeId } } : {}),
      did,
      handle: profile.handle,
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      ...(record.langs?.length ? { langs: record.langs.join(', ') } : {}),
      ...(record.createdAt ? { createdAt: record.createdAt } : {}),
      ...(record.reply ? { replyTo: record.reply.parent.uri } : {}),
      ...(record.embed
        ? {
            embedType: record.embed.$type
              .replace('app.bsky.embed.', '')
              .replace('#view', ''),
            ...(record.embed.external?.uri
              ? { embedUrl: record.embed.external.uri }
              : {}),
            ...(record.embed.external?.title
              ? { embedTitle: record.embed.external.title }
              : {}),
            ...(record.embed.external?.description
              ? { embedDescription: record.embed.external.description }
              : {}),
            ...(record.embed.external?.thumb?.ref?.$link
              ? { embedThumb: buildImageCdnUrl(did, record.embed.external.thumb.ref.$link) }
              : {}),
          }
        : {}),
      ...(images.length > 0 ? { images } : {}),
      ...(video ? { video } : {}),
    },
  };
}

async function didToUserItem(did: string): Promise<CoopItem> {
  const profile = await fetchProfile(did);
  return {
    id: did,
    typeId: userTypeId as string,
    data: {
      handle: profile.handle,
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      ...(profile.description ? { description: profile.description } : {}),
      ...(profile.avatar ? { avatar: profile.avatar } : {}),
      ...(profile.indexedAt ? { indexedAt: profile.indexedAt } : {}),
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

async function submitReport(
  did: string,
  rkey: string,
  record: BlueskyPost,
): Promise<string> {
  const item = await postToCoopItem(did, rkey, record);
  const payload = {
    reporter: {
      kind: 'user',
      id: did,
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

async function submitUserReport(did: string): Promise<string> {
  const item = await didToUserItem(did);
  const payload = {
    reporter: {
      kind: 'user',
      id: did,
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
      `[${new Date().toISOString()}] DRY RUN user report:`,
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
let usersSubmitted = 0;
let userErrors = 0;
let reportsSubmitted = 0;
let reportsSkipped = 0;
let reportErrors = 0;

const limiter = new RateLimiter(rateLimit);
const reportLimiter = new RateLimiter(reportRateLimit);
const submittedUserDids = new Set<string>();

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
  if (userTypeId) {
    console.log(`  User submission: enabled (once per DID)`);
    console.log(`  Report submission: enabled (${reportRateLimit}/min, posts + users combined)`);
  } else {
    console.log(
      `  User submission: disabled (pass --user-type-id to enable)`,
    );
    console.log(
      `  Report submission: disabled (pass --user-type-id to enable)`,
    );
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

      // Item submission
      if (!limiter.tryConsume()) {
        skipped++;
        return;
      }

      // User item submission (once per DID, for authors of submitted posts only)
      if (userTypeId && !submittedUserDids.has(msg.did)) {
        submittedUserDids.add(msg.did);
        didToUserItem(msg.did)
          .then((item) => {
            if (dryRun) {
              console.log(
                `[${new Date().toISOString()}] DRY RUN user: ${buildBskyProfileUrl(msg.did)}`,
              );
              usersSubmitted++;
              return;
            }
            return submitToCoop(item).then(() => {
              usersSubmitted++;
              console.log(
                `[${new Date().toISOString()}] User submitted: ${buildBskyProfileUrl(msg.did)}`,
              );
            });
          })
          .catch((err: unknown) => {
            userErrors++;
            submittedUserDids.delete(msg.did);
            console.error(
              `[${new Date().toISOString()}] ERROR submitting user: ${String(err)}`,
            );
          });
      }

      // Report submission (posts and users share the rate limit)
      if (userTypeId) {
        if (reportLimiter.tryConsume()) {
          // Alternate between reporting the post and reporting its author
          const reportPost = reportsSubmitted % 2 === 0;
          const reportPromise = reportPost
            ? submitReport(msg.did, msg.commit.rkey, record)
            : submitUserReport(msg.did);
          reportPromise
            .then((reportId) => {
              reportsSubmitted++;
              console.log(
                `[${new Date().toISOString()}] ${reportPost ? 'Post' : 'User'} report submitted: ${reportId}`,
              );
            })
            .catch((err: unknown) => {
              reportErrors++;
              console.error(
                `[${new Date().toISOString()}] ERROR submitting report: ${String(err)}`,
              );
            });
        } else {
          reportsSkipped++;
        }
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
      `\nJetstream connection closed. Posts: ${submitted}, Users: ${usersSubmitted}, Skipped (rate): ${skipped}, Errors: ${errors + userErrors}`,
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
    `[${new Date().toISOString()}] Status — posts: ${submitted}, users: ${usersSubmitted}, skipped: ${skipped}, errors: ${errors + userErrors}, reports: ${reportsSubmitted}, reports skipped: ${reportsSkipped}, report errors: ${reportErrors}`,
  );
}, 60_000);

process.on('SIGINT', () => {
  console.log(
    `\nShutting down. Posts: ${submitted}, Users: ${usersSubmitted}, Skipped: ${skipped}, Errors: ${errors + userErrors}, Reports: ${reportsSubmitted}, Reports skipped: ${reportsSkipped}, Report errors: ${reportErrors}`,
  );
  process.exit(0);
});

connect();
