import { type Kysely } from 'kysely';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import createUserItemTypes from '../../../test/fixtureHelpers/createUserItemTypes.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ItemType } from '../../moderationConfigService/index.js';
import { type NcmecReportingServicePg } from '../../ncmecService/dbTypes.js';
import {
  NCMEC_ESCALATION_SKIP_WARNING,
  type ManualReviewDecisionComponent,
} from './JobDecisioning.js';
import { jobIdToGuid } from './QueueOperations.js';

const testWithFixture = () =>
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
    const { itemTypes: userItemTypes, cleanup: userItemTypesCleanup } =
      await createUserItemTypes({
        moderationConfigService: container.ModerationConfigService,
        orgId: org.id,
        extra: {},
      });
    const {
      itemTypes: contentItemTypesWithoutCreator,
      cleanup: contentItemTypesWithoutCreatorCleanup,
    } = await createContentItemTypes({
      moderationConfigService: container.ModerationConfigService,
      orgId: org.id,
      extra: {},
    });
    const {
      itemTypes: contentItemTypesWithCreator,
      cleanup: contentItemTypesWithCreatorCleanup,
    } = await createContentItemTypes({
      moderationConfigService: container.ModerationConfigService,
      orgId: org.id,
      includeCreator: true,
      extra: {},
    });
    const { queue, cleanup: queueCleanup } = await createMrtQueue({
      orgId: org.id,
      mrtService: container.ManualReviewToolService,
      userId: user.id,
    });

    const mrtService = container.ManualReviewToolService;
    const mrtPg = mrtService['pgQuery'];
    const queueOps = mrtService['queueOps'];
    const ncmecPg = container.KyselyPg as Kysely<NcmecReportingServicePg>;

    const addFreshJob = async (
      itemType: ItemType = userItemTypes[0],
      data: NormalizedItemData = instantiateOpaqueType<NormalizedItemData>({}),
    ) => {
      const item = instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        data,
        itemTypeIdentifier: {
          id: itemType.id,
          version: itemType.version,
          schemaVariant: 'original',
        },
        creator: { id: uuidv1(), typeId: uuidv1() },
        itemId: uuidv1(),
      });

      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload: {
          createdAt: new Date(),
          policyIds: [],
          payload: { kind: 'DEFAULT', item, reportHistory: [] },
        },
      });
      return item;
    };

    const decideNextJob = async (
      decisionComponents: ManualReviewDecisionComponent[],
    ) => {
      const dequeuedJob = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });

      if (!dequeuedJob) {
        throw new Error("should've returned a job");
      }

      return mrtService.submitDecision({
        queueId: queue.id,
        reportHistory: [],
        jobId: dequeuedJob.job.id,
        lockToken: dequeuedJob.lockToken,
        decisionComponents,
        relatedActions: [],
        reviewerId: user.id,
        reviewerEmail: 'test@test.com',
        orgId: org.id,
      });
    };

    // Mimics a previously-submitted (non-test) NCMEC report for the given
    // subject so the skip check trips.
    const insertNcmecReport = async (subject: {
      userId: string;
      userItemTypeId: string;
    }) =>
      ncmecPg
        .insertInto('ncmec_reporting.ncmec_reports')
        .values({
          org_id: org.id,
          report_id: uuidv1(),
          user_id: subject.userId,
          user_item_type_id: subject.userItemTypeId,
          reported_media: [
            {
              id: uuidv1(),
              typeId: subject.userItemTypeId,
              xml: '<fileDetails/>',
              ncmecFileId: 'file-1',
            },
          ],
          report_xml: '<report/>',
          additional_files: null,
          reported_messages: null,
          is_test: false,
        })
        .execute();

    return {
      addFreshJob,
      contentItemTypeWithCreator: contentItemTypesWithCreator[0],
      contentItemTypeWithoutCreator: contentItemTypesWithoutCreator[0],
      decideNextJob,
      mrtService,
      org,
      queue,
      insertNcmecReport,
      mrtPg,
      user,
      userItemType: userItemTypes[0],
      cleanup: async () => {
        await ncmecPg
          .deleteFrom('ncmec_reporting.ncmec_reports')
          .where('org_id', '=', org.id)
          .execute();
        await queueCleanup();
        await contentItemTypesWithCreatorCleanup();
        await contentItemTypesWithoutCreatorCleanup();
        await userItemTypesCleanup();
        await userCleanup();
        await orgCleanup();
        await container.KyselyPg.destroy();
        await container.KyselyPgReadReplica.destroy();
      },
    };
  });

describe('JobDecisioning NCMEC escalation skip warnings', () => {
  testWithFixture()(
    'warns when the escalated user already has a submitted NCMEC report',
    async ({ addFreshJob, decideNextJob, insertNcmecReport }) => {
      const item = await addFreshJob();
      await insertNcmecReport({
        userId: item.itemId,
        userItemTypeId: item.itemTypeIdentifier.id,
      });

      const result = await decideNextJob([
        { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE', newJobKind: 'NCMEC' },
      ]);

      expect(result.warnings).toEqual([NCMEC_ESCALATION_SKIP_WARNING]);
    },
  );

  testWithFixture()(
    'returns no warnings for a user with no NCMEC report',
    async ({ addFreshJob, decideNextJob }) => {
      await addFreshJob();
      const result = await decideNextJob([
        { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE', newJobKind: 'NCMEC' },
      ]);
      expect(result.warnings).toEqual([]);
    },
  );

  testWithFixture()(
    "warns when the escalated Content item's creator already has a submitted NCMEC report",
    async ({
      addFreshJob,
      contentItemTypeWithCreator,
      decideNextJob,
      insertNcmecReport,
      userItemType,
    }) => {
      const creator = { id: uuidv1(), typeId: userItemType.id };
      await addFreshJob(
        contentItemTypeWithCreator,
        instantiateOpaqueType<NormalizedItemData>({ creatorId: creator }),
      );
      await insertNcmecReport({
        userId: creator.id,
        userItemTypeId: creator.typeId,
      });

      const result = await decideNextJob([
        { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE', newJobKind: 'NCMEC' },
      ]);

      expect(result.warnings).toEqual([NCMEC_ESCALATION_SKIP_WARNING]);
    },
  );

  testWithFixture()(
    'returns no warnings for a decision that does not escalate to NCMEC',
    async ({ addFreshJob, decideNextJob }) => {
      await addFreshJob();
      const result = await decideNextJob([{ type: 'IGNORE' }]);
      expect(result.warnings).toEqual([]);
    },
  );
});

describe('JobDecisioning NCMEC escalation eligibility', () => {
  testWithFixture()(
    'allows Content whose creator references a User item type',
    async ({
      addFreshJob,
      contentItemTypeWithCreator,
      decideNextJob,
      userItemType,
    }) => {
      await addFreshJob(
        contentItemTypeWithCreator,
        instantiateOpaqueType<NormalizedItemData>({
          creatorId: { id: uuidv1(), typeId: userItemType.id },
        }),
      );

      await expect(
        decideNextJob([
          { type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE', newJobKind: 'NCMEC' },
        ]),
      ).resolves.toEqual({ warnings: [] });
    },
  );

  testWithFixture()(
    'rejects Content without a creator and leaves the review job in its queue',
    async ({
      addFreshJob,
      contentItemTypeWithoutCreator,
      mrtPg,
      mrtService,
      org,
      queue,
      user,
    }) => {
      await addFreshJob(contentItemTypeWithoutCreator);

      const dequeuedJob = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });
      if (!dequeuedJob) {
        throw new Error("should've returned a job");
      }

      await expect(
        mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE',
              newJobKind: 'NCMEC',
            },
          ],
          relatedActions: [],
          reviewerId: user.id,
          reviewerEmail: 'test@test.com',
          orgId: org.id,
        }),
      ).rejects.toMatchObject({
        name: 'NcmecEscalationUnavailableError',
        status: 400,
        detail:
          'Content items must have a creator ID that references a User item before they can be enqueued to NCMEC.',
      });

      const decision = await mrtPg
        .selectFrom('manual_review_tool.manual_review_decisions')
        .select('id')
        .where('id', '=', jobIdToGuid(dequeuedJob.job.id))
        .executeTakeFirst();
      expect(decision).toBeUndefined();

      await mrtService.releaseJobLock({
        orgId: org.id,
        queueId: queue.id,
        jobId: dequeuedJob.job.id,
        lockToken: dequeuedJob.lockToken,
      });
      const retriedJob = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });
      expect(retriedJob?.job.id).toBe(dequeuedJob.job.id);
    },
  );
});
