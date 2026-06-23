import { type ItemIdentifier } from '@roostorg/types';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type CustomActionDecisionComponent } from './JobDecisioning.js';

const TRIGGER_ACTION_ID = 'ban-action';

const testWithQueue = () =>
  makeTestWithFixture(async () => {
    const container = (await getBottle()).container;
    const { org, cleanup: orgCleanup } = await createOrg(
      {
        KyselyPg: container.KyselyPg,
        ModerationConfigService: container.ModerationConfigService,
        ApiKeyService: container.ApiKeyService,
      },
      uid(),
    );
    const { user, cleanup: userCleanup } = await createUser(
      container.KyselyPg,
      org.id,
    );
    const { itemTypes, cleanup: itemTypesCleanup } =
      await createContentItemTypes({
        moderationConfigService: container.ModerationConfigService,
        orgId: org.id,
        extra: {},
      });
    const { queue, cleanup: queueCleanup } = await createMrtQueue({
      orgId: org.id,
      mrtService: container.ManualReviewToolService,
      userId: user.id,
    });

    const mrtService = container.ManualReviewToolService;
    const queueOps = mrtService['queueOps'];

    const addJob = async (opts: {
      creator: ItemIdentifier;
      queueId?: string;
      kind?: 'DEFAULT' | 'NCMEC';
    }) => {
      const item = instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: {} as NormalizedItemData,
        itemTypeIdentifier: {
          id: itemTypes[0].id,
          version: itemTypes[0].version,
          schemaVariant: 'original',
        },
        creator: opts.creator,
        itemId: uuidv1(),
      });
      return queueOps.addJob({
        orgId: org.id,
        queueId: opts.queueId ?? queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload: {
          createdAt: new Date(),
          policyIds: [],
          payload:
            opts.kind === 'NCMEC'
              ? { kind: 'NCMEC', item, allMediaItems: [], reportHistory: [] }
              : { kind: 'DEFAULT', item, reportHistory: [] },
        },
      });
    };

    const configureQueue = async (opts: {
      disposition: 'AUTOMATIC_CLOSE' | 'IGNORE' | 'SAME_ACTION' | null;
      scope?: 'CURRENT_QUEUE' | 'ALL_QUEUES';
      triggerActionIds?: string[];
      queueId?: string;
    }) =>
      mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: opts.queueId ?? queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        clearReportsDisposition: opts.disposition,
        clearReportsScope: opts.scope ?? 'CURRENT_QUEUE',
        clearReportsTriggerActionIds: opts.triggerActionIds ?? [
          TRIGGER_ACTION_ID,
        ],
      });

    const pendingJobIds = async (queueId?: string) => {
      let ids: readonly string[] = [];
      for await (const job of queueOps.iteratePendingJobsForQueue({
        orgId: org.id,
        queueId: queueId ?? queue.id,
        batchSize: 100,
        maxJobs: 1000,
        progress: { truncated: false },
      })) {
        ids = [...ids, job.id];
      }
      return ids;
    };

    return {
      org,
      user,
      queue,
      mrtService,
      addJob,
      configureQueue,
      pendingJobIds,
      cleanup: async () => {
        await queueCleanup();
        await itemTypesCleanup();
        await userCleanup();
        await orgCleanup();
        await container.KyselyPg.destroy();
        await container.KyselyPgReadReplica.destroy();
      },
    };
  });

function triggerAction(
  item: ItemSubmissionWithTypeIdentifier,
): CustomActionDecisionComponent {
  return {
    type: 'CUSTOM_ACTION',
    actions: [{ id: TRIGGER_ACTION_ID }],
    policies: [],
    itemIds: [item.itemId],
    itemTypeId: item.itemTypeIdentifier.id,
  };
}

describe('ManualReviewToolService.maybeClearOtherReportsForUser', () => {
  const reportedUser: ItemIdentifier = { typeId: 'user_type', id: 'reported' };
  const otherUser: ItemIdentifier = { typeId: 'user_type', id: 'other' };

  const reviewerEmail = 'reviewer@example.com';

  testWithQueue()(
    'disposes other jobs for the same user, excluding the actioned job and other users',
    async ({
      org,
      user,
      queue,
      mrtService,
      addJob,
      configureQueue,
      pendingJobIds,
    }) => {
      await configureQueue({ disposition: 'AUTOMATIC_CLOSE' });

      const actionedJob = await addJob({ creator: reportedUser });
      await addJob({ creator: reportedUser });
      await addJob({ creator: reportedUser });
      const otherUserJob = await addJob({ creator: otherUser });

      const result = await mrtService.maybeClearOtherReportsForUser({
        orgId: org.id,
        actionedJob,
        actionedQueueId: queue.id,
        customActions: [triggerAction(actionedJob.payload.item)],
        reviewerId: user.id,
        reviewerEmail,
      });

      expect(result?.jobsDisposed).toBe(2);

      // Only the two other reported-user jobs are removed; the actioned job and
      // the other user's job remain queued.
      expect(new Set(await pendingJobIds())).toEqual(
        new Set([actionedJob.id, otherUserJob.id]),
      );
    },
  );

  testWithQueue()(
    'is a no-op when the decision actions do not match the trigger actions',
    async ({ org, user, queue, mrtService, addJob, configureQueue }) => {
      await configureQueue({ disposition: 'AUTOMATIC_CLOSE' });

      const actionedJob = await addJob({ creator: reportedUser });
      await addJob({ creator: reportedUser });

      const result = await mrtService.maybeClearOtherReportsForUser({
        orgId: org.id,
        actionedJob,
        actionedQueueId: queue.id,
        customActions: [
          {
            type: 'CUSTOM_ACTION',
            actions: [{ id: 'some-other-action' }],
            policies: [],
            itemIds: [actionedJob.payload.item.itemId],
            itemTypeId: actionedJob.payload.item.itemTypeIdentifier.id,
          },
        ],
        reviewerId: user.id,
        reviewerEmail,
      });

      expect(result).toBeUndefined();
    },
  );

  testWithQueue()(
    'skips NCMEC jobs when sweeping other reports for the same user',
    async ({
      org,
      user,
      queue,
      mrtService,
      addJob,
      configureQueue,
      pendingJobIds,
    }) => {
      await configureQueue({ disposition: 'AUTOMATIC_CLOSE' });

      const actionedJob = await addJob({ creator: reportedUser });
      const ncmecJob = await addJob({ creator: reportedUser, kind: 'NCMEC' });
      await addJob({ creator: reportedUser });

      const result = await mrtService.maybeClearOtherReportsForUser({
        orgId: org.id,
        actionedJob,
        actionedQueueId: queue.id,
        customActions: [triggerAction(actionedJob.payload.item)],
        reviewerId: user.id,
        reviewerEmail,
      });

      // Only the DEFAULT job is swept; the NCMEC job remains.
      expect(result?.jobsDisposed).toBe(1);
      expect(new Set(await pendingJobIds())).toEqual(
        new Set([actionedJob.id, ncmecJob.id]),
      );
    },
  );

  testWithQueue()(
    'is a no-op when the feature is disabled (null disposition)',
    async ({ org, user, queue, mrtService, addJob, configureQueue }) => {
      await configureQueue({ disposition: null, triggerActionIds: [] });

      const actionedJob = await addJob({ creator: reportedUser });
      await addJob({ creator: reportedUser });

      const result = await mrtService.maybeClearOtherReportsForUser({
        orgId: org.id,
        actionedJob,
        actionedQueueId: queue.id,
        customActions: [triggerAction(actionedJob.payload.item)],
        reviewerId: user.id,
        reviewerEmail,
      });

      expect(result).toBeUndefined();
    },
  );
});
