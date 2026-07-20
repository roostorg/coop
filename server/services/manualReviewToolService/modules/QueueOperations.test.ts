import fc from 'fast-check';
import { uid } from 'uid';

import createActions from '../../../test/fixtureHelpers/createActions.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import makeDummyMrtJobPayload from '../../../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
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
    makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org } = await createOrg(
        {
          KyselyPg: deps.KyselyPg,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );

      const { user } = await createUser(deps.KyselyPg, org.id);
      const { itemTypes } = await createContentItemTypes({
        moderationConfigService: deps.ModerationConfigService,
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

      const { actions } = await createActions({
        actionAPI: deps.ActionAPIDataSource,
        itemTypeIds: itemTypes.map((it) => it.id),
        orgId: org.id,
        numActions: 3,
      });

      const { queue } = await createMrtQueue({
        orgId: org.id,
        mrtService: deps.ManualReviewToolService,
        userId: user.id,
      });

      return {
        org,
        actions,
        queue,
        mrtService: deps.ManualReviewToolService,
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

  // Regression: this used to read the queue with getJobs([state], 0, 0),
  // which defaults to descending order and returns the *newest* job — the
  // dashboard's "Oldest Task Age" column showed the newest task's age.
  testWithQueueAndActions()(
    'getOldestJobCreatedAt returns the oldest waiting job, not the newest',
    async ({ org, queue, mrtService }) => {
      const olderCreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const newerCreatedAt = new Date(Date.now() - 60 * 1000);

      // Enqueue the older job first: BullMQ pushes new jobs onto the head of
      // the wait list, so a descending read returns the most recently added
      // job and this test fails without the oldest-first fix.
      await mrtService['queueOps']['addJob']({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload: makeDummyMrtJobPayload({ createdAt: olderCreatedAt }),
      });
      await mrtService['queueOps']['addJob']({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload: makeDummyMrtJobPayload({ createdAt: newerCreatedAt }),
      });

      const oldest = await mrtService.getOldestJobCreatedAt({
        orgId: org.id,
        queueId: queue.id,
        isAppealsQueue: false,
      });

      expect(oldest).not.toBeNull();
      // BullMQ round-trips job data through JSON, so createdAt may come back
      // as an ISO string; compare by timestamp.
      expect(new Date(oldest!).getTime()).toEqual(olderCreatedAt.getTime());
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
});
