import { type Kysely } from 'kysely';
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
import { type NcmecReportingServicePg } from '../../ncmecService/dbTypes.js';
import { type ManualReviewDecisionComponent } from './JobDecisioning.js';

const EXPECTED_WARNING =
  'NCMEC escalation was skipped: this user already has a submitted NCMEC report.';

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
    const ncmecPg = container.KyselyPg as Kysely<NcmecReportingServicePg>;

    const addFreshJob = async () => {
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
      decideNextJob,
      insertNcmecReport,
      cleanup: async () => {
        await ncmecPg
          .deleteFrom('ncmec_reporting.ncmec_reports')
          .where('org_id', '=', org.id)
          .execute();
        await queueCleanup();
        await itemTypesCleanup();
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

      expect(result.warnings).toEqual([EXPECTED_WARNING]);
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
    'returns no warnings for a decision that does not escalate to NCMEC',
    async ({ addFreshJob, decideNextJob }) => {
      await addFreshJob();
      const result = await decideNextJob([{ type: 'IGNORE' }]);
      expect(result.warnings).toEqual([]);
    },
  );
});
