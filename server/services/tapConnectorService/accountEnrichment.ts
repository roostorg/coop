/**
 * Lazy enrichment of ATproto-account items by fetching profiles from the
 * public Bluesky API. Used by the Tap connector when it sees a post whose
 * author DID has no corresponding account item yet.
 */

import {
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
  type RawItemSubmission,
} from '../itemProcessingService/index.js';
import { type ModerationConfigService } from '../moderationConfigService/index.js';

const PROFILE_ENDPOINT =
  'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile';

interface BskyProfile {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  createdAt?: string;
}

export async function fetchBskyProfile(did: string): Promise<BskyProfile | null> {
  const url = `${PROFILE_ENDPOINT}?actor=${encodeURIComponent(did)}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) return null;
  return (await resp.json()) as BskyProfile;
}

export function buildAccountSubmission(
  profile: BskyProfile,
): RawItemSubmission | null {
  if (!profile.did || !profile.handle) return null;
  return {
    id: profile.did,
    typeId: 'ATproto-account',
    data: {
      did: profile.did,
      handle: profile.handle,
      // Embed handle inside displayName so MRT's inline card shows both,
      // matching Bluesky's "Name (@handle)" presentation.
      displayName: profile.displayName
        ? `${profile.displayName} (@${profile.handle})`
        : `@${profile.handle}`,
      isActive: true,
      ...(profile.description ? { description: profile.description } : {}),
      ...(profile.avatar ? { avatar: profile.avatar } : {}),
      ...(profile.banner ? { banner: profile.banner } : {}),
      ...(profile.createdAt ? { createdAt: profile.createdAt } : {}),
    },
  };
}

export async function submitAccountItem(opts: {
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
  const accountType = itemTypes.find((it) => it.name === 'ATproto-account');
  if (!accountType) return;
  const resolved = { ...rawSubmission, typeId: accountType.id };
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
