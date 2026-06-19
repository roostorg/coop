import { uid } from 'uid';

import getBottle from '../../../iocContainer/index.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTestWithFixture } from '../../../test/utils.js';

process.env.UI_URL ??= 'http://localhost:3000';
process.env.OTEL_SERVICE_NAME ??= 'coop-test';

describe('MrtRecoveryOperations', () => {
  const testWithFixture = makeTestWithFixture(async () => {
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

    const { queue, cleanup: queueCleanup } = await createMrtQueue({
      orgId: org.id,
      mrtService: container.ManualReviewToolService,
      userId: user.id,
    });

    return {
      container,
      org,
      user,
      queue,
      cleanup: async () => {
        await container.KyselyPg.deleteFrom(
          'manual_review_tool.mrt_queue_recovery_state',
        )
          .where('org_id', '=', org.id)
          .execute();
        await container.KyselyPg.deleteFrom('manual_review_tool.job_creations')
          .where('org_id', '=', org.id)
          .execute();
        await queueCleanup();
        await userCleanup();
        await orgCleanup();
        await container.KyselyPg.destroy();
        await container.KyselyPgReadReplica.destroy();
      },
    };
  });

  testWithFixture(
    'tracks retries and reset state',
    async ({ container, org, queue }) => {
      const jobId = `recover:${uid()}`;
      const itemId = uid();
      const itemTypeId = uid();

      const secondaryOrg = await createOrg(
        {
          KyselyPg: container.KyselyPg,
          ModerationConfigService: container.ModerationConfigService,
          ApiKeyService: container.ApiKeyService,
        },
        uid(),
      );
      const secondaryUser = await createUser(
        container.KyselyPg,
        secondaryOrg.org.id,
      );
      const secondaryQueue = await createMrtQueue({
        orgId: secondaryOrg.org.id,
        mrtService: container.ManualReviewToolService,
        userId: secondaryUser.user.id,
      });
      const secondaryJobId = `recover:${uid()}`;

      try {
        await container.KyselyPg.insertInto('manual_review_tool.job_creations')
          .values({
            id: jobId,
            org_id: org.id,
            item_id: itemId,
            item_type_id: itemTypeId,
            queue_id: queue.id,
            created_at: new Date(),
            enqueue_source_info: { kind: 'MRT_JOB' },
            policy_ids: [],
          })
          .execute();

        await container.KyselyPg.insertInto('manual_review_tool.job_creations')
          .values({
            id: secondaryJobId,
            org_id: secondaryOrg.org.id,
            item_id: uid(),
            item_type_id: uid(),
            queue_id: secondaryQueue.queue.id,
            created_at: new Date(),
            enqueue_source_info: { kind: 'MRT_JOB' },
            policy_ids: [],
          })
          .execute();

        const first =
          await container.ManualReviewToolService.recordRecoveryFailure({
            jobId,
            orgId: org.id,
            queueId: queue.id,
            itemId,
            itemTypeId,
            error: 'first failure',
            maxRetries: 2,
          });
        expect(first.retryCount).toBe(1);
        expect(first.status).toBe('PENDING');

        const second =
          await container.ManualReviewToolService.recordRecoveryFailure({
            jobId,
            orgId: org.id,
            queueId: queue.id,
            itemId,
            itemTypeId,
            error: 'second failure',
            maxRetries: 2,
          });
        expect(second.retryCount).toBe(2);
        expect(second.status).toBe('FAILED');

        const otherOrgFailure =
          await container.ManualReviewToolService.recordRecoveryFailure({
            jobId: secondaryJobId,
            orgId: secondaryOrg.org.id,
            queueId: secondaryQueue.queue.id,
            itemId: uid(),
            itemTypeId: uid(),
            error: 'other org failure',
            maxRetries: 1,
          });
        expect(otherOrgFailure.status).toBe('FAILED');

        const [storedFailed] =
          await container.ManualReviewToolService.getRecoveryStatesForJobIds([
            jobId,
          ]);
        expect(storedFailed).toMatchObject({
          jobId,
          orgId: org.id,
          queueId: queue.id,
          itemId,
          itemTypeId,
          status: 'FAILED',
          retryCount: 2,
          lastError: 'second failure',
        });

        const resetCount =
          await container.ManualReviewToolService.resetFailedRecoveryStates({
            orgId: org.id,
            jobIds: [jobId, secondaryJobId],
          });
        expect(resetCount).toBe(1);

        const [storedReset] =
          await container.ManualReviewToolService.getRecoveryStatesForJobIds([
            jobId,
          ]);
        expect(storedReset).toMatchObject({
          jobId,
          status: 'PENDING',
          retryCount: 0,
          lastError: null,
        });

        const [storedOtherOrg] =
          await container.ManualReviewToolService.getRecoveryStatesForJobIds([
            secondaryJobId,
          ]);
        expect(storedOtherOrg).toMatchObject({
          jobId: secondaryJobId,
          orgId: secondaryOrg.org.id,
          status: 'FAILED',
          retryCount: 1,
          lastError: 'other org failure',
        });
      } finally {
        await secondaryQueue.cleanup();
        await secondaryUser.cleanup();
        await secondaryOrg.cleanup();
      }
    },
  );
});
