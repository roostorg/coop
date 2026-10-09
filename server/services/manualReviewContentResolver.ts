import type { ManualReviewJobOrAppeal } from './manualReviewToolService/manualReviewToolService.js';

export type ResolveManualReviewContentInput = {
  orgId: string;
  queueId: string;
  reviewerId: string;
  job: ManualReviewJobOrAppeal;
};

export type ResolveManualReviewContentResult = {
  job: ManualReviewJobOrAppeal;
  resolvedContentCount: number;
};

export type ManualReviewContentResolver = (
  input: ResolveManualReviewContentInput,
) => Promise<ResolveManualReviewContentResult>;

export const passThroughManualReviewContent: ManualReviewContentResolver =
  async ({ job }) => ({ job, resolvedContentCount: 0 });

let registeredResolver: ManualReviewContentResolver | undefined;

export function registerManualReviewContentResolver(
  resolver: ManualReviewContentResolver,
) {
  const previous = registeredResolver;
  registeredResolver = resolver;
  return () => {
    if (registeredResolver === resolver) registeredResolver = previous;
  };
}

export function getRegisteredManualReviewContentResolver() {
  return registeredResolver ?? passThroughManualReviewContent;
}

export async function canResolveManualReviewContent(opts: {
  jobOrgId: string;
  lockToken: string;
  reviewerId: string;
  reviewerOrgId: string;
  hasActiveLock: () => Promise<boolean>;
}) {
  if (
    opts.lockToken !== opts.reviewerId ||
    opts.jobOrgId !== opts.reviewerOrgId
  ) {
    return false;
  }
  return opts.hasActiveLock();
}

export async function resolveManualReviewContentSafely(
  input: ResolveManualReviewContentInput,
  resolver: ManualReviewContentResolver,
  observer: {
    onResolved?: (count: number) => void;
    onError?: (error: unknown) => void;
  } = {},
) {
  try {
    const result = await resolver(input);
    if (
      result.job.id !== input.job.id ||
      result.job.orgId !== input.job.orgId ||
      !Number.isSafeInteger(result.resolvedContentCount) ||
      result.resolvedContentCount < 0
    ) {
      throw new Error('Content resolver returned an invalid result');
    }

    observer.onResolved?.(result.resolvedContentCount);
    return result.job;
  } catch (error) {
    observer.onError?.(error);
    return input.job;
  }
}
