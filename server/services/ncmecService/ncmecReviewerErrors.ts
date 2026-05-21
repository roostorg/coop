/** Reviewer-facing classifications of NCMEC submission failures. Written
 * to `ncmec_reports_errors.last_error` and surfaced in the MRT dashboard;
 * full operator detail stays in logs / spans. */

const REVIEWER_ERROR_MESSAGES = {
  AUTH: 'Authentication failed. Check NCMEC credentials in Settings → NCMEC.',
  RATE_LIMITED: 'Rate limited by NCMEC. Retrying shortly.',
  TIMEOUT: 'NCMEC request timed out. Retrying shortly.',
  SERVER: 'NCMEC server error. Retrying shortly.',
  REJECTED: 'NCMEC rejected the report.',
  VALIDATION: 'Report failed validation before submission.',
  CONFIG: 'NCMEC configuration is incomplete. Check Settings → NCMEC.',
  MEDIA: 'Could not assemble the reported media for submission.',
  UNKNOWN: 'Unexpected error submitting to NCMEC. See server logs.',
} as const;

// Allowlist of thrown messages that are already operator-friendly. New
// throw sites stay opaque until classified explicitly.
const ALREADY_REVIEWER_FRIENDLY: ReadonlySet<string> = new Set([
  'No media in report',
  'Organization does not have a NCMEC preservation endpoint',
  'NCMEC report requires a non-empty reporter contact email; configure it in Settings → NCMEC.',
  'escalateToHighPriority must be non-blank when supplied and at most 3000 characters',
  'additionalInfo must be non-blank when supplied and at most 3000 characters',
]);

// First match wins; put more specific prefixes ahead of more general ones.
const REVIEWER_PREFIX_RULES: readonly {
  prefix: string;
  category: keyof typeof REVIEWER_ERROR_MESSAGES;
}[] = [
  { prefix: 'NCMEC reports are not enabled for org', category: 'CONFIG' },
  { prefix: 'Insufficient settings', category: 'CONFIG' },
  { prefix: 'org id not found', category: 'CONFIG' },
  { prefix: 'Unable to find reported media in job payload', category: 'MEDIA' },
  { prefix: 'Unable to find item type for reported media', category: 'MEDIA' },
  { prefix: 'Invalid media createdAt timestamp', category: 'MEDIA' },
  { prefix: 'Cannot download media from', category: 'MEDIA' },
  { prefix: 'NCMEC file upload failed', category: 'MEDIA' },
  { prefix: 'NCMEC thread CSV upload failed', category: 'MEDIA' },
  { prefix: 'NCMEC thread csv failed', category: 'MEDIA' },
  { prefix: 'No created at for reported media', category: 'MEDIA' },
  { prefix: 'NCMEC Messages failed validation', category: 'VALIDATION' },
  { prefix: 'NCMEC Additional info failed validation', category: 'VALIDATION' },
  { prefix: 'Did not receive additional info back', category: 'VALIDATION' },
  {
    prefix: 'NCMEC report submission failed: responseCode=',
    category: 'REJECTED',
  },
  { prefix: 'NCMEC report finish failed', category: 'SERVER' },
];

function classifyByHttpStatus(status: number | undefined): string {
  if (status === undefined) return REVIEWER_ERROR_MESSAGES.UNKNOWN;
  if (status === 401 || status === 403) return REVIEWER_ERROR_MESSAGES.AUTH;
  if (status === 429) return REVIEWER_ERROR_MESSAGES.RATE_LIMITED;
  if (status === 408 || status === 504) return REVIEWER_ERROR_MESSAGES.TIMEOUT;
  if (status >= 500) return REVIEWER_ERROR_MESSAGES.SERVER;
  if (status >= 400) return REVIEWER_ERROR_MESSAGES.REJECTED;
  return REVIEWER_ERROR_MESSAGES.UNKNOWN;
}

export function summarizeNcmecErrorForReviewer(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (raw === '') return REVIEWER_ERROR_MESSAGES.UNKNOWN;
  if (ALREADY_REVIEWER_FRIENDLY.has(raw)) return raw;

  const cyberTipMatch = /^CyberTip request to .+? failed: status=(\d+)/.exec(
    raw,
  );
  if (cyberTipMatch) return classifyByHttpStatus(Number(cyberTipMatch[1]));

  if (raw.startsWith('NCMEC Additional info failed with status:')) {
    const match = /status:\s*(\d{3})/.exec(raw);
    return classifyByHttpStatus(match ? Number(match[1]) : undefined);
  }

  if (raw.startsWith('User with ID:') && raw.includes('has existing report')) {
    return REVIEWER_ERROR_MESSAGES.REJECTED;
  }

  const rule = REVIEWER_PREFIX_RULES.find((r) => raw.startsWith(r.prefix));
  if (rule !== undefined) return REVIEWER_ERROR_MESSAGES[rule.category];

  return REVIEWER_ERROR_MESSAGES.UNKNOWN;
}
