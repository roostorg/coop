import { v1 as uuidv1 } from 'uuid';

import getBottle from '../iocContainer/index.js';
import makeDummyMrtJobPayload from '../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { instantiateOpaqueType } from '../utils/typescript-types.js';
import {
  canResolveManualReviewContent,
  passThroughManualReviewContent,
  registerManualReviewContentResolver,
  resolveManualReviewContentSafely,
} from './manualReviewContentResolver.js';
import {
  type JobId,
  type ManualReviewJob,
} from './manualReviewToolService/manualReviewToolService.js';

function makeJob(orgId = uuidv1()): ManualReviewJob {
  return {
    ...makeDummyMrtJobPayload(),
    id: instantiateOpaqueType<JobId>(uuidv1()),
    orgId,
  };
}

describe('manual review content resolver', () => {
  it('accepts a deployment resolver extension', async () => {
    const resolver = jest.fn();
    const bottle = await getBottle({ manualReviewContentResolver: resolver });
    expect(bottle.container.ManualReviewContentResolver).toBe(resolver);
  });

  it('accepts a resolver registered before startup', async () => {
    const resolver = jest.fn();
    const unregister = registerManualReviewContentResolver(resolver);
    try {
      const bottle = await getBottle();
      expect(bottle.container.ManualReviewContentResolver).toBe(resolver);
    } finally {
      unregister();
    }
  });

  it('requires reviewer identity, organization, and the active lock', async () => {
    const hasActiveLock = jest.fn(async () => true);
    await expect(
      canResolveManualReviewContent({
        jobOrgId: 'org',
        reviewerOrgId: 'org',
        reviewerId: 'reviewer',
        lockToken: 'reviewer',
        hasActiveLock,
      }),
    ).resolves.toBe(true);
    expect(hasActiveLock).toHaveBeenCalledTimes(1);

    hasActiveLock.mockClear();
    for (const input of [
      { reviewerOrgId: 'other-org', lockToken: 'reviewer' },
      { reviewerOrgId: 'org', lockToken: 'other-reviewer' },
    ]) {
      await expect(
        canResolveManualReviewContent({
          jobOrgId: 'org',
          reviewerId: 'reviewer',
          hasActiveLock,
          ...input,
        }),
      ).resolves.toBe(false);
    }
    expect(hasActiveLock).not.toHaveBeenCalled();

    hasActiveLock.mockResolvedValue(false);
    await expect(
      canResolveManualReviewContent({
        jobOrgId: 'org',
        reviewerOrgId: 'org',
        reviewerId: 'reviewer',
        lockToken: 'reviewer',
        hasActiveLock,
      }),
    ).resolves.toBe(false);
  });

  it('passes content through by default', async () => {
    const job = makeJob();
    await expect(
      passThroughManualReviewContent({
        job,
        orgId: job.orgId,
        queueId: 'queue-id',
        reviewerId: 'reviewer-id',
      }),
    ).resolves.toEqual({ job, resolvedContentCount: 0 });
  });

  it('returns validated resolved content', async () => {
    const job = makeJob();
    const resolvedJob = { ...job, policyIds: ['resolved'] };
    const onResolved = jest.fn();

    await expect(
      resolveManualReviewContentSafely(
        {
          job,
          orgId: job.orgId,
          queueId: 'queue-id',
          reviewerId: 'reviewer-id',
        },
        async () => ({ job: resolvedJob, resolvedContentCount: 1 }),
        { onResolved },
      ),
    ).resolves.toBe(resolvedJob);
    expect(onResolved).toHaveBeenCalledWith(1);
  });

  it('keeps stored content when resolution fails', async () => {
    const job = makeJob();
    const error = new Error('resolver unavailable');
    const onError = jest.fn();

    await expect(
      resolveManualReviewContentSafely(
        {
          job,
          orgId: job.orgId,
          queueId: 'queue-id',
          reviewerId: 'reviewer-id',
        },
        async () => Promise.reject(error),
        { onError },
      ),
    ).resolves.toBe(job);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('rejects a result for another job', async () => {
    const job = makeJob();
    const onError = jest.fn();

    await expect(
      resolveManualReviewContentSafely(
        {
          job,
          orgId: job.orgId,
          queueId: 'queue-id',
          reviewerId: 'reviewer-id',
        },
        async () => ({
          job: makeJob(job.orgId),
          resolvedContentCount: 1,
        }),
        { onError },
      ),
    ).resolves.toBe(job);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
