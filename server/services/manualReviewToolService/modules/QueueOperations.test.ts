import fc from 'fast-check';
import { uid } from 'uid';

import getBottle from '../../../iocContainer/index.js';
import createActions from '../../../test/fixtureHelpers/createActions.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
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
        actions,
        queue,
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

  // Regression for GHSA-mf74-gf5j-hxr9: addAccessibleQueuesForUser /
  // removeAccessibleQueuesForUser used to accept an arbitrary queueId /
  // userId with no org-scoping, so an authenticated user in Org A could
  // grant (or revoke) access to queues and users belonging to Org B.
  //
  // These fixtures build two independent orgs, each with a user and a
  // queue, then assert that the caller's orgId gates both the queue and
  // the user.
  const testWithTwoOrgs = () =>
    makeTestWithFixture(async () => {
      const container = (await getBottle()).container;

      const buildOrg = async () => {
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
        return { org, user, queue, orgCleanup, userCleanup, queueCleanup };
      };

      const attacker = await buildOrg();
      const victim = await buildOrg();

      return {
        attacker,
        victim,
        mrtService: container.ManualReviewToolService,
        kyselyPg: container.KyselyPg,
        cleanup: async () => {
          await attacker.queueCleanup();
          await victim.queueCleanup();
          await attacker.userCleanup();
          await victim.userCleanup();
          await attacker.orgCleanup();
          await victim.orgCleanup();
          await container.KyselyPg.destroy();
          await container.KyselyPgReadReplica.destroy();
        },
      };
    });

  testWithTwoOrgs()(
    'addAccessibleQueuesForUser must not grant access to a queue in a different org',
    async ({ attacker, victim, mrtService }) => {
      // Attacker (Org A) passes the victim's queueId (Org B) to grant their
      // own user access. This is a cross-org IDOR: the service must reject it
      // and no access row should be written.
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
      // Attacker (Org A) passes a userId belonging to Org B against their own
      // queue. The service must reject cross-user cross-org mutation.
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
      // Seed legitimate access for the victim's user on the victim's queue,
      // then have the attacker (Org A) pass the victim's queueId to revoke
      // it. Must be rejected; the seeded access must survive.
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
      // Attacker (Org A) passes a userId belonging to Org B against their
      // own queue. The service must reject the cross-user mutation -- this
      // is the path that would otherwise delete a victim reviewer's access.
      await expect(
        mrtService.removeAccessibleQueuesForUser({
          orgId: attacker.org.id,
          userId: victim.user.id,
          queueIds: [attacker.queue.id],
        }),
      ).rejects.toBeDefined();
    },
  );

  testWithTwoOrgs()(
    'addAccessibleQueuesForUser grants access within the same org',
    async ({ attacker, mrtService }) => {
      // Same-org happy path: the caller's own user gets access to the
      // caller's own queue. Guards against over-rejecting.
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
});
