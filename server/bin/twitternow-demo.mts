#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * twitter.now connector for local Coop demos.
 *
 * Polls the public twitter.now API and forwards posts and users to a local
 * Coop instance as item submissions, giving you a realistic stream of
 * content to review without needing to integrate a real platform.
 *
 * Unlike the AT Protocol demo, twitter.now has no push/firehose endpoint —
 * only a cursor-paginated REST feed — so this script polls the latest page
 * on an interval instead of holding a streaming connection open. If more
 * than --limit new posts land between two polls, the overflow is missed;
 * that's fine for a demo feed, but this is not an exactly-once pipeline.
 *
 * Prerequisites:
 *   1. Coop must be running locally (`npm run server:start`)
 *   2. Run `cd server && npm run twitternow:setup -- --org-id <id>` once to
 *      create the item types and get the type IDs
 *
 * Usage:
 *   npm run twitternow:demo -- --api-key <key> --post-type-id <id>
 *
 * Options:
 *   --api-key              Coop API key (from `npm run create-org`)           [required]
 *   --post-type-id         twitter.now Post item type ID (from twitternow:setup) [required]
 *   --user-type-id         twitter.now User item type ID (from twitternow:setup);
 *                          enables user item submission and profile enrichment
 *   --thread-type-id       twitter.now Thread item type ID (from twitternow:setup);
 *                          enables thread submission and reply-parent linking
 *                          (the two are gated together: Coop requires a
 *                          threadId role wherever parentId is set)
 *   --coop-url             Base URL of the Coop server  [default: http://localhost:3000]
 *   --limit                Posts fetched per poll  [default: 20]
 *   --poll-interval-ms     Milliseconds between polls  [default: 15000]
 *   --rate-limit           Max posts submitted per minute                     [default: 100]
 *   --max-replies-per-post Replies fetched per newly-seen post, to backfill  [default: 20]
 *                          reply threads that fall outside the polling window
 *   --dry-run              Print submissions without sending them to Coop
 */
import process from 'node:process';

// Require Node 18+ for native fetch (project standard is Node 24, see .nvmrc).
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('Node 18 or later is required (project uses Node 24).');
  process.exit(1);
}

const TWITTERNOW_API = 'https://api.twitter.now/api/posts';

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
const threadTypeId = getArg('--thread-type-id');
const coopUrl = getArg('--coop-url') ?? 'http://localhost:3000';
const limit = Number(getArg('--limit') ?? '20');
const pollIntervalMs = Number(getArg('--poll-interval-ms') ?? '15000');
const rateLimit = Number(getArg('--rate-limit') ?? '100');
const maxRepliesPerPost = Number(getArg('--max-replies-per-post') ?? '20');
const dryRun = hasFlag('--dry-run');

if (!apiKey || !postTypeId) {
  console.error(
    'Usage: npm run twitternow:demo -- --api-key <key> --post-type-id <id>\n' +
      'Run `cd server && npm run twitternow:setup -- --org-id <id>` first to get the post type ID.',
  );
  process.exit(1);
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(
    'See the top of server/bin/twitternow-demo.mts for full option documentation.',
  );
  process.exit(0);
}

// --- Types for twitter.now API responses -------------------------------------

interface TwitterNowMediaAsset {
  id: string;
  media_type: string;
  public_url: string;
  thumbnail_url?: string;
}

interface TwitterNowRepostedBy {
  userId: string;
  displayName?: string;
  username: string;
}

interface TwitterNowPost {
  id: string;
  text: string;
  createdAt?: string;
  authorUserId: string;
  handle: string;
  display_name?: string;
  authorAvatar?: string;
  authorTrustScore?: number;
  authorBadges?: string[];
  authorFoundingMemberNumber?: number;
  category?: string;
  likes?: number;
  reposts?: number;
  replyCount?: number;
  hashtags?: string[];
  mentions?: string[];
  isRepost?: boolean;
  repostedBy?: TwitterNowRepostedBy;
  parentId?: string | null;
  // The top-most (root) post's id for this conversation — equal to `id`
  // itself for a top-level post.
  conversationId?: string | null;
  replyToUsername?: string | null;
  media_assets?: TwitterNowMediaAsset[];
}

interface TwitterNowPostsResponse {
  success: boolean;
  posts: TwitterNowPost[];
  nextCursor?: string;
}

interface TwitterNowRepliesResponse {
  success: boolean;
  replies: TwitterNowPost[];
  nextCursor: string | null;
  total: number;
}

interface TwitterNowProfile {
  bio?: string;
  location?: string;
  website?: string;
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

function buildPostUrl(id: string): string {
  return `https://app.twitter.now/post/${id}`;
}

function postToCoopItem(post: TwitterNowPost): CoopItem {
  const images = (post.media_assets ?? [])
    .filter((asset) => asset.media_type === 'image')
    .map((asset) => asset.public_url);

  const video = (post.media_assets ?? []).find(
    (asset) => asset.media_type === 'video',
  )?.public_url;

  return {
    id: post.id,
    typeId: postTypeId as string,
    data: {
      text: post.text,
      url: buildPostUrl(post.id),
      ...(userTypeId
        ? { creator: { id: post.authorUserId, typeId: userTypeId } }
        : {}),
      // `thread` and `parent` are gated together on --thread-type-id: Coop's
      // item-type schema requires a threadId role wherever parentId is set.
      // A dangling reference to a thread/parent we've never ingested (e.g. an
      // older reply outside the polling window) is possible but harmless,
      // same tradeoff as the polling gaps noted above.
      ...(threadTypeId && post.conversationId
        ? { thread: { id: post.conversationId, typeId: threadTypeId } }
        : {}),
      ...(threadTypeId && post.parentId
        ? { parent: { id: post.parentId, typeId: postTypeId } }
        : {}),
      handle: post.handle,
      ...(post.display_name ? { displayName: post.display_name } : {}),
      ...(post.createdAt ? { createdAt: post.createdAt } : {}),
      ...(post.category ? { category: post.category } : {}),
      ...(post.likes != null ? { likes: post.likes } : {}),
      ...(post.reposts != null ? { reposts: post.reposts } : {}),
      ...(post.replyCount != null ? { replyCount: post.replyCount } : {}),
      ...(post.hashtags?.length ? { hashtags: post.hashtags } : {}),
      ...(post.mentions?.length ? { mentions: post.mentions } : {}),
      ...(post.isRepost ? { isRepost: post.isRepost } : {}),
      ...(post.isRepost && post.repostedBy?.username
        ? { repostedByHandle: post.repostedBy.username }
        : {}),
      ...(post.replyToUsername
        ? { replyToUsername: post.replyToUsername }
        : {}),
      ...(images.length > 0 ? { images } : {}),
      ...(video ? { video } : {}),
    },
  };
}

async function userToCoopItem(post: TwitterNowPost): Promise<CoopItem> {
  const profile = await fetchUserProfile(post.authorUserId);
  return {
    id: post.authorUserId,
    typeId: userTypeId as string,
    data: {
      handle: post.handle,
      ...(post.display_name ? { displayName: post.display_name } : {}),
      ...(post.authorAvatar ? { avatar: post.authorAvatar } : {}),
      ...(profile.bio ? { bio: profile.bio } : {}),
      ...(profile.location ? { location: profile.location } : {}),
      ...(profile.website ? { website: profile.website } : {}),
      ...(post.authorTrustScore != null
        ? { trustScore: post.authorTrustScore }
        : {}),
      ...(post.authorBadges?.length ? { badges: post.authorBadges } : {}),
      ...(post.authorFoundingMemberNumber != null
        ? { foundingMemberNumber: post.authorFoundingMemberNumber }
        : {}),
    },
  };
}

// A thread's id is its root post's id (`conversationId`). We may see it via
// a reply before ever seeing the root post itself, so `createdAt` is only
// set when the post we're looking at *is* the root (its own createdAt is
// then an accurate thread creation time).
function threadToCoopItem(post: TwitterNowPost): CoopItem {
  const rootId = post.conversationId as string;
  return {
    id: rootId,
    typeId: threadTypeId as string,
    data: {
      url: buildPostUrl(rootId),
      ...(post.id === rootId && post.createdAt
        ? { createdAt: post.createdAt }
        : {}),
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

async function fetchLatestPosts(): Promise<TwitterNowPost[]> {
  const response = await fetch(`${TWITTERNOW_API}?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`twitter.now returned ${response.status}`);
  }
  const data = (await response.json()) as TwitterNowPostsResponse;
  return data.posts ?? [];
}

// GET /api/posts/{id}/replies — undocumented but public; discovered by
// grepping the app.twitter.now frontend bundle for /api/ route strings.
async function fetchReplies(postId: string): Promise<TwitterNowPost[]> {
  try {
    const response = await fetch(
      `${TWITTERNOW_API}/${encodeURIComponent(postId)}/replies?limit=${maxRepliesPerPost}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as TwitterNowRepliesResponse;
    return data.replies ?? [];
  } catch {
    return [];
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// GET /api/user-profile/{userId} — also undocumented but public. Deliberately
// drops `email` and `dateOfBirth`, which the endpoint returns unauthenticated
// but which we have no business ingesting into Coop.
const profileCache = new Map<string, TwitterNowProfile>();

async function fetchUserProfile(userId: string): Promise<TwitterNowProfile> {
  const cached = profileCache.get(userId);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.twitter.now/api/user-profile/${encodeURIComponent(userId)}`,
    );
    if (!response.ok) throw new Error(`${response.status}`);
    const data = (await response.json()) as {
      profile?: { bio?: string; location?: string; website?: string };
    };
    // Profile `website` values are free text on twitter.now (e.g. "t.me/eval"
    // with no scheme) but Coop's `website` field is a strict URL — silently
    // drop values that don't parse rather than failing the whole submission.
    const profile: TwitterNowProfile = {
      ...(data.profile?.bio ? { bio: data.profile.bio } : {}),
      ...(data.profile?.location ? { location: data.profile.location } : {}),
      ...(data.profile?.website && isAbsoluteUrl(data.profile.website)
        ? { website: data.profile.website }
        : {}),
    };
    profileCache.set(userId, profile);
    return profile;
  } catch {
    return {};
  }
}

// --- Main -------------------------------------------------------------------

let submitted = 0;
let skipped = 0;
let errors = 0;
let usersSubmitted = 0;
let userErrors = 0;
let threadErrors = 0;

const limiter = new RateLimiter(rateLimit);
const seenPostIds = new Set<string>();
const submittedUserIds = new Set<string>();
const submittedThreadIds = new Set<string>();
const repliesFetchedForPostIds = new Set<string>();

function logStatus(action: string, text: string) {
  const preview = text.length > 60 ? text.slice(0, 57) + '…' : text;
  console.log(`[${new Date().toISOString()}] ${action}: "${preview}"`);
}

// Submits a post (and, once per author, its user) to Coop. Returns whether
// this was the first time we'd seen the post — callers use that to decide
// whether it's worth fetching its replies.
async function processPost(post: TwitterNowPost): Promise<boolean> {
  if (seenPostIds.has(post.id)) return false;
  seenPostIds.add(post.id);

  if (userTypeId && !submittedUserIds.has(post.authorUserId)) {
    submittedUserIds.add(post.authorUserId);
    const userItem = await userToCoopItem(post);
    if (dryRun) {
      console.log(
        `[${new Date().toISOString()}] DRY RUN user: @${post.handle}`,
      );
      usersSubmitted++;
    } else {
      try {
        await submitToCoop(userItem);
        usersSubmitted++;
        console.log(
          `[${new Date().toISOString()}] User submitted: @${post.handle}`,
        );
      } catch (err: unknown) {
        userErrors++;
        submittedUserIds.delete(post.authorUserId);
        console.error(
          `[${new Date().toISOString()}] ERROR submitting user: ${String(err)}`,
        );
      }
    }
  }

  if (
    threadTypeId &&
    post.conversationId &&
    !submittedThreadIds.has(post.conversationId)
  ) {
    submittedThreadIds.add(post.conversationId);
    const threadItem = threadToCoopItem(post);
    if (dryRun) {
      console.log(
        `[${new Date().toISOString()}] DRY RUN thread: ${threadItem.id}`,
      );
    } else {
      try {
        await submitToCoop(threadItem);
        console.log(
          `[${new Date().toISOString()}] Thread submitted: ${threadItem.id}`,
        );
      } catch (err: unknown) {
        threadErrors++;
        submittedThreadIds.delete(post.conversationId);
        console.error(
          `[${new Date().toISOString()}] ERROR submitting thread: ${String(err)}`,
        );
      }
    }
  }

  if (!limiter.tryConsume()) {
    skipped++;
    return true;
  }

  const postItem = postToCoopItem(post);
  if (dryRun) {
    logStatus('DRY RUN', post.text);
    console.log('  Would submit:', JSON.stringify(postItem, null, 2));
    submitted++;
    return true;
  }

  try {
    await submitToCoop(postItem);
    submitted++;
    logStatus('Submitted', post.text);
  } catch (err: unknown) {
    errors++;
    console.error(
      `[${new Date().toISOString()}] ERROR submitting: ${String(err)}`,
    );
  }

  return true;
}

// Backfills a post's direct replies (one page, one level deep — not
// recursive, so this doesn't chase reply-of-reply chains) so threads aren't
// limited to whatever the main feed poll happens to catch.
async function processRepliesFor(postId: string): Promise<void> {
  if (repliesFetchedForPostIds.has(postId)) return;
  repliesFetchedForPostIds.add(postId);

  const replies = await fetchReplies(postId);
  for (const reply of [...replies].reverse()) {
    await processPost(reply);
  }
}

async function poll() {
  let posts: TwitterNowPost[];
  try {
    posts = await fetchLatestPosts();
  } catch (err: unknown) {
    console.error(
      `[${new Date().toISOString()}] ERROR fetching from twitter.now: ${String(err)}`,
    );
    return;
  }

  // Oldest-first, so submissions land in Coop in chronological order.
  for (const post of [...posts].reverse()) {
    const newlySeen = await processPost(post);
    if (newlySeen) {
      await processRepliesFor(post.id);
    }
  }
}

console.log(`Polling twitter.now…`);
console.log(
  `  Coop: ${coopUrl}  |  limit: ${limit}/poll  |  interval: ${pollIntervalMs}ms  |  rate limit: ${rateLimit}/min  |  dry run: ${dryRun}`,
);
console.log(
  userTypeId
    ? `  User submission: enabled (once per author, with profile enrichment)`
    : `  User submission: disabled (pass --user-type-id to enable)`,
);
console.log(
  threadTypeId
    ? `  Thread + reply-parent linking: enabled (once per conversation)`
    : `  Thread + reply-parent linking: disabled (pass --thread-type-id to enable)`,
);
console.log(
  `  Reply backfill: enabled (up to ${maxRepliesPerPost} replies per newly-seen post)`,
);
console.log('');

void poll();
setInterval(() => {
  void poll();
}, pollIntervalMs);

// Print running totals every 60 seconds
setInterval(() => {
  console.log(
    `[${new Date().toISOString()}] Status — posts: ${submitted}, users: ${usersSubmitted}, threads: ${submittedThreadIds.size - threadErrors}, skipped (rate): ${skipped}, errors: ${errors + userErrors + threadErrors}`,
  );
}, 60_000);

process.on('SIGINT', () => {
  console.log(
    `\nShutting down. Posts: ${submitted}, Users: ${usersSubmitted}, Threads: ${submittedThreadIds.size - threadErrors}, Skipped: ${skipped}, Errors: ${errors + userErrors + threadErrors}`,
  );
  process.exit(0);
});
