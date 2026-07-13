import fc from 'fast-check';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
import createActions from '../../../test/fixtureHelpers/createActions.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import { UserPermission } from '../../userManagementService/index.js';
import {
  bullJobIdtoExternalJobId,
  itemIdToBullJobId,
  parseExternalId,
} from './QueueOperations.js';

describe('QueueOperations', () => {
  it('External ID functions should be inverses of one another', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (itemTypeId, itemId, guid) => {
          const bullId = itemIdToBullJobId({ typeId: itemTypeId, id: itemId });
          const externalId = bullJobIdtoExternalJobId(bullId, guid);
          const inverse = parseExternalId(externalId);
          expect(inverse).toEqual({ bullId, guid });
        },
      ),
    );
  });

  const testWithQueueAndActions = () =>
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
          extra: {
            fields: [
              {
                name: 'someField',
                type: 'NUMBER',
                required: false,
                container: null,
              },
            ],
          },
        });

      const { actions, cleanup: actionsCleanup } = await createActions({
        actionAPI: container.ActionAPIDataSource,
        itemTypeIds: itemTypes.map((it) => it.id),
        orgId: org.id,
        numActions: 3,
      });

      const { queue, cleanup: queuesCleanup } = await createMrtQueue({
        orgId: org.id,
        mrtService: container.ManualReviewToolService,
        userId: user.id,
      });

      return {
        org,
        user,
        actions,
        queue,
        kyselyPg: container.KyselyPg,
        mrtService: container.ManualReviewToolService,
        cleanup: async () => {
          await queuesCleanup();
          await actionsCleanup();
          await itemTypesCleanup();
          await userCleanup();
          await orgCleanup();
          await container.KyselyPg.destroy();
          await container.KyselyPgReadReplica.destroy();
        },
      };
    });

  testWithQueueAndActions()(
    'Queues should default to having no actions hidden',
    async ({ org, queue, mrtService }) => {
      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(hiddenActions.length).toEqual(0);
    },
  );

  testWithQueueAndActions()(
    'Test hiding an action',
    async ({ org, queue, mrtService, actions }) => {
      const actionToHide = actions[Math.floor(Math.random() * actions.length)];
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: [actionToHide.id],
        actionIdsToUnhide: [],
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(1);
      expect(hiddenActions[0]).toEqual(actionToHide.id);
    },
  );

  testWithQueueAndActions()(
    'Test unhiding an action',
    async ({ org, queue, mrtService, actions }) => {
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actions.map((it) => it.id),
        actionIdsToUnhide: [],
      });

      const actionToUnhide =
        actions[Math.floor(Math.random() * actions.length)];
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: [],
        actionIdsToUnhide: [actionToUnhide.id],
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(actions.length - 1);
      expect(hiddenActions).not.toContain(actionToUnhide.id);
    },
  );

  testWithQueueAndActions()(
    'Test hiding some actions and unhiding some others',
    async ({ org, queue, mrtService, actions }) => {
      const actionsToHide = actions.slice(0, 2);
      const actionsToToggle = actions.slice(2, 3);

      // First hide the actions we're going to unhide later
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actionsToToggle.map((it) => it.id),
        actionIdsToUnhide: [],
      });
      const initiallyHiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(initiallyHiddenActions.length).toEqual(1);
      expect(initiallyHiddenActions[0]).toEqual(actionsToToggle[0].id);

      // Then unhide the currently hidden actions while hiding others
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actionsToHide.map((it) => it.id),
        actionIdsToUnhide: actionsToToggle.map((it) => it.id),
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(2);
      expect(
        hiddenActions.every((it) =>
          actionsToHide.map((it) => it.id).includes(it),
        ),
      ).toEqual(true);
      expect(
        hiddenActions.some((it) =>
          actionsToToggle.map((it) => it.id).includes(it),
        ),
      ).toEqual(false);
    },
  );

  // Regression: `deleteAllJobsFromQueue` is irreversible and used to accept
  // EDIT_MRT_QUEUES (held by moderator managers) -- that gap accidentally
  // cleared a production queue. It now requires MANAGE_ORG.
  testWithQueueAndActions()(
    'deleteAllJobsFromQueue rejects EDIT_MRT_QUEUES without MANAGE_ORG',
    async ({ org, queue, mrtService }) => {
      await expect(
        mrtService.deleteAllJobsFromQueue({
          orgId: org.id,
          queueId: queue.id,
          userPermissions: [UserPermission.EDIT_MRT_QUEUES],
        }),
      ).rejects.toMatchObject({ name: 'DeleteAllJobsUnauthorizedError' });
    },
  );

  testWithQueueAndActions()(
    'deleteAllJobsFromQueue accepts MANAGE_ORG',
    async ({ org, queue, mrtService }) => {
      await expect(
        mrtService.deleteAllJobsFromQueue({
          orgId: org.id,
          queueId: queue.id,
          userPermissions: [UserPermission.MANAGE_ORG],
        }),
      ).resolves.toBeUndefined();
    },
  );

  const testWithTwoOrgs = () =>
    makeTransactionalTestWithFixture(async ({ deps }) => {
      const buildOrg = async () => {
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
        return { org, user, queue };
      };

      return {
        attacker: await buildOrg(),
        victim: await buildOrg(),
        mrtService: deps.ManualReviewToolService,
      };
    });

  testWithTwoOrgs()(
    'addAccessibleQueuesForUser must not grant access to a queue in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.addAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: attacker.user.id,
          queueIds: [victim.queue.id],
        }),
      ).rejects.toBeDefined();

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: victim.org.id,
        queueId: victim.queue.id,
        userId: attacker.user.id,
      });
      expect(viewers.map((v) => v.userId)).not.toContain(attacker.user.id);
    },
  );

  testWithTwoOrgs()(
    'addAccessibleQueuesForUser must not grant access for a user in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.addAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: victim.user.id,
          queueIds: [attacker.queue.id],
        }),
      ).rejects.toBeDefined();

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: attacker.org.id,
        queueId: attacker.queue.id,
        userId: victim.user.id,
      });
      expect(viewers.map((v) => v.userId)).not.toContain(victim.user.id);
    },
  );

  testWithTwoOrgs()(
    'removeAccessibleQueuesForUser must not revoke access for a queue in a different org',
    async ({ attacker, victim, mrtService }) => {
      await mrtService.addAccessibleQueuesForUser({
        orgId: victim.org.id,
        userId: victim.user.id,
        queueIds: [victim.queue.id],
      });

      await expect(
        mrtService.removeAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: attacker.user.id,
          queueIds: [victim.queue.id],
        }),
      ).rejects.toBeDefined();

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: victim.org.id,
        queueId: victim.queue.id,
        userId: victim.user.id,
      });
      expect(viewers.map((v) => v.userId)).toContain(victim.user.id);
    },
  );

  testWithTwoOrgs()(
    'removeAccessibleQueuesForUser must not revoke access for a user in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.removeAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: victim.user.id,
          queueIds: [attacker.queue.id],
        }),
      ).rejects.toBeDefined();

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: attacker.org.id,
        queueId: attacker.queue.id,
        userId: attacker.user.id,
      });
      expect(viewers.map((v) => v.userId)).toContain(attacker.user.id);
    },
  );

  testWithTwoOrgs()(
    'addAccessibleQueuesForUser grants access within the same org',
    async ({ attacker, mrtService }) => {
      await expect(
        mrtService.addAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: attacker.user.id,
          queueIds: [attacker.queue.id],
        }),
      ).resolves.toBeDefined();

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: attacker.org.id,
        queueId: attacker.queue.id,
        userId: attacker.user.id,
      });
      expect(viewers.map((v) => v.userId)).toContain(attacker.user.id);
    },
  );

  testWithTwoOrgs()(
    'createManualReviewQueue must not grant access to a user in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.createManualReviewQueue({
          name: 'attacker-queue',
          description: null,
          userIds: [victim.user.id],
          hiddenActionIds: [],
          isAppealsQueue: false,
          invokedBy: {
            userId: attacker.user.id,
            permissions: [UserPermission.EDIT_MRT_QUEUES],
            orgId: attacker.org.id,
          },
        }),
      ).rejects.toMatchObject({ name: 'AccessibleQueueNotInOrgError' });
    },
  );

  testWithTwoOrgs()(
    'updateManualReviewQueue must not grant access to a user in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.updateManualReviewQueue({
          orgId: attacker.org.id,
          queueId: attacker.queue.id,
          userIds: [attacker.user.id, victim.user.id],
          actionIdsToHide: [],
          actionIdsToUnhide: [],
        }),
      ).rejects.toMatchObject({ name: 'AccessibleQueueNotInOrgError' });

      const viewers = await mrtService.getUsersWhoCanSeeQueue({
        orgId: attacker.org.id,
        queueId: attacker.queue.id,
        userId: attacker.user.id,
      });
      expect(viewers.map((v) => v.userId)).not.toContain(victim.user.id);
    },
  );

  // Regression: deleting a queue that a routing rule points to used to silently
  // cascade-delete the rule, breaking routing for the org. The FK is now
  // RESTRICT, so the service throws QueueHasDependentRoutingRulesError instead.
  type QueueFixture = Parameters<
    Parameters<ReturnType<typeof testWithQueueAndActions>>[1]
  >[0];

  const expectDeletionBlockedByRoutingRule = async (
    { org, user, mrtService, kyselyPg }: QueueFixture,
    table:
      | 'manual_review_tool.routing_rules'
      | 'manual_review_tool.appeals_routing_rules',
    ruleName: string,
  ) => {
    const secondQueue = await mrtService.createManualReviewQueue({
      name: `delete-test-queue-${uid()}`,
      description: null,
      userIds: [user.id],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId: user.id,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      },
    });

    await kyselyPg
      .insertInto(table)
      .values({
        id: uuidv1(),
        org_id: org.id,
        name: ruleName,
        description: null,
        status: 'LIVE',
        condition_set: { conditions: [], conjunction: 'AND' },
        destination_queue_id: secondQueue.id,
        creator_id: user.id,
        sequence_number: 99,
      })
      .execute();

    await expect(
      mrtService.deleteManualReviewQueue(org.id, secondQueue.id),
    ).rejects.toMatchObject({ name: 'QueueHasDependentRoutingRulesError' });

    // Clean up manually since the queue was not deleted.
    await kyselyPg
      .deleteFrom(table)
      .where('destination_queue_id', '=', secondQueue.id)
      .execute();
    await mrtService.deleteManualReviewQueueForTestsDO_NOT_USE(
      org.id,
      secondQueue.id,
    );
  };

  testWithQueueAndActions()(
    'deleteManualReviewQueue throws QueueHasDependentRoutingRulesError when a routing rule references the queue',
    async (ctx) =>
      expectDeletionBlockedByRoutingRule(
        ctx,
        'manual_review_tool.routing_rules',
        'block-deletion-rule',
      ),
  );

  testWithQueueAndActions()(
    'deleteManualReviewQueue throws QueueHasDependentRoutingRulesError when an appeals routing rule references the queue',
    async (ctx) =>
      expectDeletionBlockedByRoutingRule(
        ctx,
        'manual_review_tool.appeals_routing_rules',
        'block-deletion-appeals-rule',
      ),
  );
});
