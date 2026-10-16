import { uid } from 'uid';
import { vi } from 'vitest';

import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ManualReviewJobPayload } from '../manualReviewToolService.js';
import QueueOperations, {
  bullJobIdtoExternalJobId,
  itemIdToBullJobId,
} from './QueueOperations.js';

describe('QueueOperations per-reviewer skips', () => {
  // Runs inside a transaction that rolls back, so the fixtures need no manual
  // teardown.
  const testWithQueue = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );

    const { user } = await createUser(deps.KyselyPg, org.id);

    const { queue } = await createMrtQueue({
      orgId: org.id,
      mrtService: deps.ManualReviewToolService,
      userId: user.id,
    });

    const queueOps = deps.ManualReviewToolService['queueOps'];
    const bullQueue = await queueOps['getOrCreateBullQueue']({
      orgId: org.id,
      queueId: queue.id,
    });
    const itemTypeId = uid();
    const availabilityOpts = {
      orgId: org.id,
      queueId: queue.id,
      reviewerId: 'reviewer-a',
      isAppealsQueue: false,
    };

    return {
      org,
      queue,
      user,
      mrtService: deps.ManualReviewToolService,
      queueOps,
      bullQueue,
      redis: deps.IORedis,
      availabilityOpts,
      addReportJob: async (itemId: string, priority = 1000) => {
        const job = await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          priority,
          jobPayload: {
            policyIds: [],
            payload: makePayloadFor(itemTypeId)(itemId),
          },
        });
        const bullJob = await bullQueue.getJob(
          itemIdToBullJobId({ typeId: itemTypeId, id: itemId }),
        );
        if (!bullJob) throw new Error('Expected the enqueued report job');
        return { job, bullJob };
      },
    };
  });

  const makePayloadFor =
    (itemTypeId: string) =>
    (itemId: string): ManualReviewJobPayload => ({
      kind: 'DEFAULT',
      reportHistory: [],
      reportedForReasons: [],
      item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: {} as NormalizedItemData,
        itemTypeIdentifier: {
          id: itemTypeId,
          version: new Date().toISOString(),
          schemaVariant: 'original',
        },
        creator: { id: uid(), typeId: uid() },
        itemId,
      }),
      enqueueSourceInfo: { kind: 'REPORT' },
    });

  testWithQueue(
    'future-delayed jobs are pending but unavailable until their delay is due',
    async ({ queueOps, bullQueue, availabilityOpts, addReportJob }) => {
      const { bullJob } = await addReportJob('delayed');
      const claimed = await queueOps.dequeueNextJobWithLock({
        ...availabilityOpts,
        lockToken: availabilityOpts.reviewerId,
      });
      expect(claimed).not.toBeNull();
      await bullJob.moveToDelayed(
        Date.now() + 60_000,
        availabilityOpts.reviewerId,
      );
      expect(await bullQueue.count()).toBe(1);
      expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
      expect(
        await queueOps.hasUnskippedJobs({
          ...availabilityOpts,
          isAppealsQueue: true,
        }),
      ).toBe(false);
      expect(
        await queueOps.dequeueNextJobWithLock({
          ...availabilityOpts,
          lockToken: availabilityOpts.reviewerId,
        }),
      ).toBeNull();
      await bullJob.changeDelay(0);
      expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
      expect(
        await queueOps.hasUnskippedJobs({
          ...availabilityOpts,
          isAppealsQueue: true,
        }),
      ).toBe(true);
      expect(
        await queueOps.dequeueNextJobWithLock({
          ...availabilityOpts,
          lockToken: availabilityOpts.reviewerId,
        }),
      ).not.toBeNull();
    },
  );

  testWithQueue(
    'paused and waiting-children jobs do not enable reviewing',
    async ({ queueOps, bullQueue, redis, availabilityOpts, addReportJob }) => {
      const { bullJob } = await addReportJob('parent', 0);
      expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
      await bullQueue.pause();
      expect(await bullQueue.count()).toBe(1);
      expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
      await bullQueue.resume();
      await queueOps.dequeueNextJobWithLock({
        ...availabilityOpts,
        lockToken: availabilityOpts.reviewerId,
      });
      await redis.sadd(
        bullQueue.toKey(`${bullJob.id}:dependencies`),
        'pending-child',
      );
      expect(
        await bullJob.moveToWaitingChildren(availabilityOpts.reviewerId),
      ).toBe(true);
      expect(await bullQueue.count()).toBe(1);
      expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
      expect(
        await queueOps.dequeueNextJobWithLock({
          ...availabilityOpts,
          lockToken: availabilityOpts.reviewerId,
        }),
      ).toBeNull();
    },
  );

  testWithQueue(
    'reuses all-skipped scans and refreshes when ready counts or skips change',
    async ({ queueOps, bullQueue, redis, availabilityOpts, addReportJob }) => {
      const { job } = await addReportJob('skipped');
      await queueOps.recordReviewerSkip({ ...availabilityOpts, jobId: job.id });
      const scan = vi.spyOn(bullQueue, 'getJobs');
      try {
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        expect(scan).toHaveBeenCalledTimes(1);
        const { job: newJob } = await addReportJob('new');
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
        await queueOps.recordReviewerSkip({
          ...availabilityOpts,
          jobId: newJob.id,
        });
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        expect(scan).toHaveBeenCalledTimes(2);
        await redis.zrem(
          `{${availabilityOpts.orgId}}:mrt-reviewer-skips:${availabilityOpts.queueId}:${availabilityOpts.reviewerId}`,
          newJob.id,
        );
        await queueOps.recordReviewerSkip({
          ...availabilityOpts,
          jobId: 'removed-job',
        });
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
      } finally {
        scan.mockRestore();
      }
    },
  );

  testWithQueue(
    'scans multiple backlog pages with bounded concurrency and finds a late unskipped job',
    async ({ queueOps, bullQueue, redis, availabilityOpts, addReportJob }) => {
      const { job } = await addReportJob('first');
      const backlog = Array.from({ length: 400 }, (_, i) => {
        const itemId = `backlog-${i}`;
        const bullId = itemIdToBullJobId({
          typeId: job.payload.item.itemTypeIdentifier.id,
          id: itemId,
        });
        return {
          name: bullId,
          data: {
            ...job,
            id: bullJobIdtoExternalJobId(bullId),
            payload: {
              ...job.payload,
              item: { ...job.payload.item, itemId },
            },
          },
          opts: { jobId: bullId, priority: 1000, removeOnComplete: true },
        };
      });
      await bullQueue.addBulk(backlog);
      const skipKey = `{${availabilityOpts.orgId}}:mrt-reviewer-skips:${availabilityOpts.queueId}:${availabilityOpts.reviewerId}`;
      const expiresAt = Date.now() + QueueOperations.REVIEWER_SKIP_TTL_MS;
      await redis.zadd(
        skipKey,
        expiresAt,
        job.id,
        ...backlog.flatMap(({ data }) => [expiresAt, data.id]),
      );
      await redis.pexpire(skipKey, QueueOperations.REVIEWER_SKIP_TTL_MS);
      const getJobs = bullQueue.getJobs.bind(bullQueue);
      let activeReads = 0;
      let peakReads = 0;
      const scan = vi
        .spyOn(bullQueue, 'getJobs')
        .mockImplementation(async (...args) => {
          activeReads++;
          peakReads = Math.max(peakReads, activeReads);
          try {
            return await getJobs(...args);
          } finally {
            activeReads--;
          }
        });
      try {
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        expect(scan).toHaveBeenCalledTimes(5);
        expect(peakReads).toBe(4);
        // Keep skips at least as numerous as ready jobs to exercise the scan.
        await queueOps.recordReviewerSkip({
          ...availabilityOpts,
          jobId: 'removed-job',
        });
        await addReportJob('late');
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
        expect(scan).toHaveBeenCalledTimes(10);
        expect(await bullQueue.count()).toBe(402);
      } finally {
        scan.mockRestore();
      }
    },
  );

  testWithQueue(
    'refreshes same-count replacements after the 30-second cache window',
    async ({ queueOps, availabilityOpts, addReportJob }) => {
      const { job, bullJob } = await addReportJob('old');
      await queueOps.recordReviewerSkip({ ...availabilityOpts, jobId: job.id });
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        await bullJob.remove();
        await addReportJob('replacement');
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(false);
        vi.setSystemTime(Date.now() + 31_000);
        expect(await queueOps.hasUnskippedJobs(availabilityOpts)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  testWithQueue(
    "availability excludes only this reviewer's active skips and preserves shared jobs",
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const opts = {
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        isAppealsQueue: false,
      };
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(false);

      const payloadFor = makePayloadFor(uid());
      const xJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      const yJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 2000,
        jobPayload: { policyIds: [], payload: payloadFor('item-Y') },
      });
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(true);
      await queueOps.recordReviewerSkip({ ...opts, jobId: xJob.id });
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(true);
      // A skip for a job no longer in the queue must not hide unskipped jobs.
      await queueOps.recordReviewerSkip({ ...opts, jobId: 'removed-job' });
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(true);
      await queueOps.recordReviewerSkip({ ...opts, jobId: yJob.id });
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(false);
      expect(await mrtService.getPendingJobCount(opts)).toBe(2);
      expect(
        await mrtService.hasUnskippedJobs({
          ...opts,
          reviewerId: 'reviewer-b',
        }),
      ).toBe(true);

      const other = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-b',
      });
      expect(other?.job.payload.item.itemId).toBe('item-X');
    },
  );

  testWithQueue(
    'expired skips make pending jobs available again',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const opts = {
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        isAppealsQueue: false,
      };
      const job = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: makePayloadFor(uid())('item-X') },
      });
      await queueOps.recordReviewerSkip({ ...opts, jobId: job.id });
      expect(await mrtService.hasUnskippedJobs(opts)).toBe(false);
      const now = Date.now();
      const clock = vi
        .spyOn(Date, 'now')
        .mockReturnValue(now + QueueOperations.REVIEWER_SKIP_TTL_MS + 1);
      try {
        expect(await mrtService.hasUnskippedJobs(opts)).toBe(true);
      } finally {
        clock.mockRestore();
      }
    },
  );

  testWithQueue(
    'a skipped job is hidden from that reviewer but immediately available to others',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      const xJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 2000,
        jobPayload: { policyIds: [], payload: payloadFor('item-Y') },
      });

      await queueOps.recordReviewerSkip({
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        jobId: xJob.id,
      });

      const aJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-a',
      });
      expect(aJob?.job.payload.item.itemId).toBe('item-Y');

      const bJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-b',
      });
      expect(bJob?.job.payload.item.itemId).toBe('item-X');
    },
  );

  testWithQueue(
    'a queue whose only jobs are skipped returns null instead of hanging',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      const onlyJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      await queueOps.recordReviewerSkip({
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        jobId: onlyJob.id,
      });

      const result = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-a',
      });
      expect(result).toBeNull();
    },
  );

  testWithQueue(
    'logSkip hides the job from the skipper and releases their lock in one call',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 2000,
        jobPayload: { policyIds: [], payload: payloadFor('item-Y') },
      });

      const first = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: user.id,
      });
      expect(first?.job.payload.item.itemId).toBe('item-X');
      await mrtService.logSkip({
        orgId: org.id,
        queueId: queue.id,
        jobId: first!.job.id,
        userId: user.id,
      });

      const other = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-b',
      });
      expect(other?.job.payload.item.itemId).toBe('item-X');

      const next = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: user.id,
      });
      expect(next?.job.payload.item.itemId).toBe('item-Y');
    },
  );
});
