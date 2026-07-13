/**
 * Transforms AT Protocol records from Tap events into Coop RawItemSubmission format.
 */

import { type RawItemSubmission } from '../itemProcessingService/index.js';
import {
  type ATProtoPostRecord,
  type ATProtoProfileRecord,
  type TapIdentityEvent,
  type TapRecordEvent,
} from './types.js';

const ATPROTO_POST_TYPE_ID = 'ATproto-post';
const ATPROTO_ACCOUNT_TYPE_ID = 'ATproto-account';
const BSKY_CDN_BASE = 'https://cdn.bsky.app/img/feed_thumbnail/plain';
const BSKY_VIDEO_BASE = 'https://video.bsky.app/watch';

/**
 * Constructs a Bluesky CDN URL for an image blob.
 * Format: https://cdn.bsky.app/img/feed_thumbnail/plain/{did}/{cid}@jpeg
 */
function buildImageCdnUrl(did: string, cid: string): string {
  return `${BSKY_CDN_BASE}/${did}/${cid}@jpeg`;
}

/**
 * Constructs an AT URI from components.
 * Format: at://{did}/{collection}/{rkey}
 */
function buildAtUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Extracts image URLs from a post's embed object.
 */
function extractImageUrls(did: string, record: ATProtoPostRecord): string[] {
  if (!record?.embed?.images) return [];

  return record.embed.images
    .map((img) => {
      const cid = img.image?.ref?.$link;
      if (!cid) return null;
      return buildImageCdnUrl(did, cid);
    })
    .filter((url): url is string => url != null);
}

function extractVideoUrl(
  did: string,
  record: ATProtoPostRecord,
): string | null {
  const cid = record?.embed?.video?.ref?.$link;
  if (!cid) return null;
  return `${BSKY_VIDEO_BASE}/${did}/${cid}/playlist.m3u8`;
}

/**
 * Transforms an app.bsky.feed.post record event into a RawItemSubmission
 * for the ATproto-post ItemType.
 */
export function transformPost(event: TapRecordEvent): RawItemSubmission | null {
  const { did, collection, rkey, cid } = event.record;
  const record = event.record.record as unknown as
    | ATProtoPostRecord
    | undefined;
  if (!record) return null;
  const atUri = buildAtUri(did, collection, rkey);

  const images = extractImageUrls(did, record);
  const video = extractVideoUrl(did, record);

  return {
    id: atUri,
    typeId: ATPROTO_POST_TYPE_ID,
    data: {
      text: record.text ?? '',
      // RELATED_ITEM fields require {id, typeId} objects
      authorDid: { id: did, typeId: ATPROTO_ACCOUNT_TYPE_ID },
      rkey,
      cid,
      createdAt: record.createdAt ?? new Date().toISOString(),
      atUri,
      ...(images.length > 0 ? { images } : {}),
      ...(video != null ? { video } : {}),
      ...(record.reply?.parent?.uri
        ? {
            replyParent: {
              id: record.reply.parent.uri,
              typeId: ATPROTO_POST_TYPE_ID,
            },
          }
        : {}),
      ...(record.reply?.root?.uri
        ? {
            replyRoot: {
              id: record.reply.root.uri,
              typeId: ATPROTO_POST_TYPE_ID,
            },
          }
        : {}),
      ...(record.langs ? { langs: record.langs } : {}),
      isLive: event.record.live,
    },
  };
}

/** A post view as returned by app.bsky.feed.getAuthorFeed. */
export interface BskyFeedPostView {
  uri?: string;
  cid?: string;
  author?: { did?: string; handle?: string };
  record?: ATProtoPostRecord;
  indexedAt?: string;
}

export interface BskyFeedViewPost {
  post?: BskyFeedPostView;
}

/** Parses an at:// URI into its did / collection / rkey components. */
function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

/**
 * Maps a getAuthorFeed post view into the same ATproto-post RawItemSubmission
 * shape produced by transformPost. The item id is the post's at:// uri and the
 * author links to the ATproto-account for the post's DID, so the author's other
 * posts show up as context in review.
 */
export function buildAuthorFeedPostSubmission(
  view: BskyFeedViewPost,
): RawItemSubmission | null {
  const post = view.post;
  if (!post?.uri || !post.cid || !post.record) return null;
  const parsed = parseAtUri(post.uri);
  if (!parsed) return null;
  const { did, rkey } = parsed;
  const record = post.record;

  const images = extractImageUrls(did, record);
  const video = extractVideoUrl(did, record);

  return {
    id: post.uri,
    typeId: ATPROTO_POST_TYPE_ID,
    data: {
      text: record.text ?? '',
      authorDid: { id: did, typeId: ATPROTO_ACCOUNT_TYPE_ID },
      rkey,
      cid: post.cid,
      createdAt: record.createdAt ?? new Date().toISOString(),
      atUri: post.uri,
      ...(images.length > 0 ? { images } : {}),
      ...(video != null ? { video } : {}),
      ...(record.reply?.parent?.uri
        ? {
            replyParent: {
              id: record.reply.parent.uri,
              typeId: ATPROTO_POST_TYPE_ID,
            },
          }
        : {}),
      ...(record.reply?.root?.uri
        ? {
            replyRoot: {
              id: record.reply.root.uri,
              typeId: ATPROTO_POST_TYPE_ID,
            },
          }
        : {}),
      ...(record.langs ? { langs: record.langs } : {}),
      isLive: false,
    },
  };
}

/**
 * Transforms an identity event into a RawItemSubmission
 * for the ATproto-account ItemType.
 */
export function transformIdentity(event: TapIdentityEvent): RawItemSubmission {
  const { did, handle, isActive } = event.identity;

  return {
    id: did,
    typeId: ATPROTO_ACCOUNT_TYPE_ID,
    data: {
      did,
      handle,
      isActive,
    },
  };
}

/**
 * Transforms an app.bsky.actor.profile record event into a RawItemSubmission
 * for the ATproto-account ItemType.
 */
export function transformProfile(
  event: TapRecordEvent,
): RawItemSubmission | null {
  const { did } = event.record;
  const record = event.record.record as unknown as
    | ATProtoProfileRecord
    | undefined;
  if (!record) return null;

  const avatarCid = record.avatar?.ref?.$link;
  const bannerCid = record.banner?.ref?.$link;

  return {
    id: did,
    typeId: ATPROTO_ACCOUNT_TYPE_ID,
    data: {
      did,
      handle: did, // handle may not be in the profile record; use DID as fallback
      ...(record.displayName ? { displayName: record.displayName } : {}),
      ...(record.description ? { description: record.description } : {}),
      ...(avatarCid ? { avatar: buildImageCdnUrl(did, avatarCid) } : {}),
      ...(bannerCid ? { banner: buildImageCdnUrl(did, bannerCid) } : {}),
      ...(record.createdAt ? { createdAt: record.createdAt } : {}),
      isActive: true,
    },
  };
}

/**
 * Routes a Tap event to the appropriate transformer.
 * Returns null for events we don't handle (e.g., unknown collections).
 */
export function transformTapEvent(
  event: TapRecordEvent | TapIdentityEvent,
): RawItemSubmission | null {
  if (event.type === 'identity') {
    return transformIdentity(event);
  }

  if (event.type === 'record') {
    const { collection } = event.record;

    // For deletions, we still transform but mark as deleted via the record data
    if (collection === 'app.bsky.feed.post') {
      return transformPost(event);
    }

    if (collection === 'app.bsky.actor.profile') {
      return transformProfile(event);
    }
  }

  return null;
}
