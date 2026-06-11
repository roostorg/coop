/**
 * Lazy enrichment of ATproto-post items by fetching records from the public
 * Bluesky API. Used by the Tap connector to populate reply parent/root posts
 * referenced by incoming firehose posts.
 */

import {
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
  type RawItemSubmission,
} from '../itemProcessingService/index.js';
import { type ModerationConfigService } from '../moderationConfigService/index.js';

const RECORD_ENDPOINT =
  'https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord';
const BSKY_CDN_BASE = 'https://cdn.bsky.app/img/feed_thumbnail/plain';
const BSKY_VIDEO_BASE = 'https://video.bsky.app/watch';
const ATPROTO_POST_TYPE_ID = 'ATproto-post';
const ATPROTO_ACCOUNT_TYPE_ID = 'ATproto-account';

interface BskyPostRecord {
  text?: string;
  createdAt?: string;
  langs?: string[];
  embed?: {
    images?: { image?: { ref?: { $link?: string } } }[];
    video?: { ref?: { $link?: string } };
  };
  reply?: {
    parent?: { uri?: string };
    root?: { uri?: string };
  };
}

interface BskyPostResponse {
  uri?: string;
  cid?: string;
  value?: BskyPostRecord;
}

function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

export async function fetchBskyPost(
  uri: string,
): Promise<BskyPostResponse | null> {
  const parsed = parseAtUri(uri);
  if (!parsed) return null;
  const params = new URLSearchParams({
    repo: parsed.did,
    collection: parsed.collection,
    rkey: parsed.rkey,
  });
  const resp = await fetch(`${RECORD_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) return null;
  return (await resp.json()) as BskyPostResponse;
}

export function buildPostSubmission(
  uri: string,
  post: BskyPostResponse,
): RawItemSubmission | null {
  const parsed = parseAtUri(uri);
  if (!parsed || !post.value || !post.cid) return null;
  const { did, rkey } = parsed;
  const record = post.value;

  const images = (record.embed?.images ?? [])
    .map((img) => img.image?.ref?.$link)
    .filter((cid): cid is string => cid != null)
    .map((cid) => `${BSKY_CDN_BASE}/${did}/${cid}@jpeg`);

  const videoCid = record.embed?.video?.ref?.$link;
  const video = videoCid
    ? `${BSKY_VIDEO_BASE}/${did}/${videoCid}/playlist.m3u8`
    : null;

  return {
    id: uri,
    typeId: ATPROTO_POST_TYPE_ID,
    data: {
      text: record.text ?? '',
      authorDid: { id: did, typeId: ATPROTO_ACCOUNT_TYPE_ID },
      rkey,
      cid: post.cid,
      createdAt: record.createdAt ?? new Date().toISOString(),
      atUri: uri,
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

export async function submitPostItem(opts: {
  rawSubmission: RawItemSubmission;
  orgId: string;
  moderationConfigService: ModerationConfigService;
  submitViaItemsPath: (
    submission: ItemSubmission & { submissionTime: Date },
  ) => Promise<void>;
}): Promise<void> {
  const { rawSubmission, orgId, moderationConfigService, submitViaItemsPath } =
    opts;
  const itemTypes = await moderationConfigService.getItemTypes({
    orgId,
    directives: { maxAge: 10 },
  });
  const postType = itemTypes.find((it) => it.name === 'ATproto-post');
  if (!postType) return;

  const resolved = { ...rawSubmission, typeId: postType.id };
  // Resolve nested RELATED_ITEM typeIds (authorDid, replyParent, replyRoot)
  const data = resolved.data as Record<string, unknown>;
  for (const val of Object.values(data)) {
    if (val && typeof val === 'object' && 'typeId' in val) {
      const nested = val as { typeId: string };
      const targetType = itemTypes.find((it) => it.name === nested.typeId);
      if (targetType) nested.typeId = targetType.id;
    }
  }

  const toItemSubmission = rawItemSubmissionToItemSubmission.bind(
    null,
    itemTypes,
    orgId,
    async ({ typeSelector }: { orgId: string; typeSelector: { id: string } }) =>
      itemTypes.find((it) => it.id === typeSelector.id),
  );
  const result = await toItemSubmission(resolved);
  if (result.error || !result.itemSubmission) return;
  const itemSubmission = result.itemSubmission as ItemSubmission & {
    submissionTime: Date;
  };
  if (!itemSubmission.submissionTime) {
    (itemSubmission as { submissionTime: Date }).submissionTime = new Date();
  }
  await submitViaItemsPath(itemSubmission);
}
