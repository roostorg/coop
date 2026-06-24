import { userInputError } from '../utils/errors.js';

/** Input shape for updateNcmecOrgSettings; mirrors NcmecOrgSettingsInput so the
 * resolver type-checks even when generated types are stale. */
export type NcmecOrgSettingsInputShape = {
  username: string;
  password: string;
  contactEmail?: string | null;
  moreInfoUrl?: string | null;
  companyTemplate?: string | null;
  legalUrl?: string | null;
  ncmecPreservationEndpoint?: string | null;
  ncmecAdditionalInfoEndpoint?: string | null;
  defaultNcmecQueueId?: string | null;
  defaultInternetDetailType?: string | null;
  termsOfService?: string | null;
  contactPersonEmail?: string | null;
  contactPersonFirstName?: string | null;
  contactPersonLastName?: string | null;
  contactPersonPhone?: string | null;
  mediaReviewRequirement?: string | null;
  minMediaToReview?: number | null;
};

const VALID_NCMEC_MEDIA_REVIEW_REQUIREMENTS = ['ALL', 'MINIMUM'] as const;
export type NcmecMediaReviewRequirement =
  (typeof VALID_NCMEC_MEDIA_REVIEW_REQUIREMENTS)[number];

function isNcmecMediaReviewRequirement(
  value: string,
): value is NcmecMediaReviewRequirement {
  return (VALID_NCMEC_MEDIA_REVIEW_REQUIREMENTS as readonly string[]).includes(
    value,
  );
}

const VALID_NCMEC_INTERNET_DETAIL_TYPES: readonly string[] = [
  'WEB_PAGE',
  'EMAIL',
  'NEWSGROUP',
  'CHAT_IM',
  'ONLINE_GAMING',
  'CELL_PHONE',
  'NON_INTERNET',
  'PEER_TO_PEER',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function isValidContactEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/** Returns the trimmed detail type or null, throwing when a non-empty value is
 * not in the allowlist. */
export function parseInternetDetailType(
  input: NcmecOrgSettingsInputShape,
): string | null {
  if (input.defaultInternetDetailType == null) {
    return null;
  }
  const trimmed = String(input.defaultInternetDetailType).trim();
  if (trimmed === '') {
    return null;
  }
  if (!VALID_NCMEC_INTERNET_DETAIL_TYPES.includes(trimmed)) {
    throw userInputError(
      `defaultInternetDetailType must be one of: ${VALID_NCMEC_INTERNET_DETAIL_TYPES.join(', ')}`,
    );
  }
  return trimmed;
}

/** Normalises the media-review policy for storage. ALL discards any supplied
 * threshold so stale values don't linger; MINIMUM requires a whole number >= 1
 * (defaulting to 1 when omitted). */
export function parseMediaReviewPolicy(input: NcmecOrgSettingsInputShape): {
  mediaReviewRequirement: NcmecMediaReviewRequirement;
  minMediaToReview: number | null;
} {
  if (input.mediaReviewRequirement == null) {
    return { mediaReviewRequirement: 'ALL', minMediaToReview: null };
  }
  const requirement = String(input.mediaReviewRequirement).trim();
  if (!isNcmecMediaReviewRequirement(requirement)) {
    throw userInputError(
      `mediaReviewRequirement must be one of: ${VALID_NCMEC_MEDIA_REVIEW_REQUIREMENTS.join(', ')}`,
    );
  }
  if (requirement === 'ALL') {
    return { mediaReviewRequirement: 'ALL', minMediaToReview: null };
  }
  const minMediaToReview = input.minMediaToReview ?? 1;
  if (!Number.isInteger(minMediaToReview) || minMediaToReview < 1) {
    throw userInputError(
      'minMediaToReview must be a whole number greater than or equal to 1.',
    );
  }
  return { mediaReviewRequirement: requirement, minMediaToReview };
}
