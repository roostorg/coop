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
function extractImageUrls(
  did: string,
  record: ATProtoPostRecord,
): string[] {
  if (!record.embed?.images) return [];

  return record.embed.images
    .map((img) => {
      const cid = img.image?.ref?.$link;
      if (!cid) return null;
      return buildImageCdnUrl(did, cid);
    })
    .filter((url): url is string => url != null);
}

/**
 * Transforms an app.bsky.feed.post record event into a RawItemSubmission
 * for the ATproto-post ItemType.
 */
export function transformPost(event: TapRecordEvent): RawItemSubmission {
  const { did, collection, rkey, cid, action } = event.record;
  const record = event.record.record as unknown as ATProtoPostRecord;
  const atUri = buildAtUri(did, collection, rkey);

  const images = extractImageUrls(did, record);

  return {
    id: atUri,
    typeId: ATPROTO_POST_TYPE_ID,
    data: {
      text: record.text ?? '',
      authorDid: did,
      rkey,
      cid,
      createdAt: record.createdAt ?? new Date().toISOString(),
      atUri,
      ...(images.length > 0 ? { images } : {}),
      ...(record.reply?.parent?.uri
        ? { replyParent: record.reply.parent.uri }
        : {}),
      ...(record.reply?.root?.uri
        ? { replyRoot: record.reply.root.uri }
        : {}),
      ...(record.langs ? { langs: record.langs } : {}),
      isLive: event.record.live,
    },
  };
}

/**
 * Transforms an identity event into a RawItemSubmission
 * for the ATproto-account ItemType.
 */
export function transformIdentity(
  event: TapIdentityEvent,
): RawItemSubmission {
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
export function transformProfile(event: TapRecordEvent): RawItemSubmission {
  const { did, action } = event.record;
  const record = event.record.record as unknown as ATProtoProfileRecord;

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
      ...(avatarCid
        ? { avatar: buildImageCdnUrl(did, avatarCid) }
        : {}),
      ...(bannerCid
        ? { banner: buildImageCdnUrl(did, bannerCid) }
        : {}),
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
    const { collection, action } = event.record;

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
