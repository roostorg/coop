import fc from 'fast-check';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import createActions from '../../../test/fixtureHelpers/createActions.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import makeDummyMrtJobPayload from '../../../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import { UserPermission, UserRole } from '../../userManagementService/index.js';
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
        user,
        actions,
        queue,
        kyselyPg: deps.KyselyPg,
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

  // These operations previously bypassed queue permissions, allowing any
  // authenticated user to read and dequeue jobs from every queue in the org.
  testWithQueueAndActions()(
    'getReviewableQueuesForUser excludes a queue the user is not a member of',
    async ({ org, queue, mrtService, deps }) => {
      const { user: outsider } = await createUser(deps.KyselyPg, org.id);
      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: {
          userId: outsider.id,
          permissions: [UserPermission.VIEW_MRT],
          orgId: org.id,
        },
      });
      expect(reviewable.map((q) => q.id)).not.toContain(queue.id);
    },
  );

  testWithQueueAndActions()(
    'getReviewableQueuesForUser includes a queue the user is a member of',
    async ({ org, queue, user, mrtService }) => {
      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: {
          userId: user.id,
          permissions: [UserPermission.VIEW_MRT],
          orgId: org.id,
        },
      });
      expect(reviewable.map((q) => q.id)).toContain(queue.id);
    },
  );

  testWithQueueAndActions()(
    'getReviewableQueuesForUser returns nothing for a user without VIEW_MRT, even for a queue they are a member of',
    async ({ org, user, mrtService }) => {
      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: { userId: user.id, permissions: [], orgId: org.id },
      });
      expect(reviewable).toEqual([]);
    },
  );

  testWithQueueAndActions()(
    'getReviewableQueuesForUser lets EDIT_MRT_QUEUES holders view every queue',
    async ({ org, queue, mrtService, deps }) => {
      const { user: outsider } = await createUser(deps.KyselyPg, org.id);
      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: {
          userId: outsider.id,
          permissions: [UserPermission.EDIT_MRT_QUEUES],
          orgId: org.id,
        },
      });
      expect(reviewable.map((q) => q.id)).toContain(queue.id);
    },
  );

  testWithQueueAndActions()(
    'getReviewableQueuesForUser filters requested queue IDs by reviewer access',
    async ({ org, queue, user, mrtService, deps }) => {
      const { user: outsider } = await createUser(deps.KyselyPg, org.id);
      await expect(
        mrtService.getReviewableQueuesForUser({
          invoker: {
            userId: outsider.id,
            permissions: [UserPermission.VIEW_MRT],
            orgId: org.id,
          },
          queueIds: [queue.id],
        }),
      ).resolves.toEqual([]);
      await expect(
        mrtService.getReviewableQueuesForUser({
          invoker: {
            userId: user.id,
            permissions: [UserPermission.VIEW_MRT],
            orgId: org.id,
          },
          queueIds: [queue.id],
        }),
      ).resolves.toEqual([expect.objectContaining({ id: queue.id })]);
    },
  );

  testWithQueueAndActions()(
    'getReviewableQueuesForUser lets a queue manager filter without membership',
    async ({ org, queue, mrtService, deps }) => {
      const { user: outsider } = await createUser(deps.KyselyPg, org.id);
      await expect(
        mrtService.getReviewableQueuesForUser({
          invoker: {
            userId: outsider.id,
            permissions: [UserPermission.EDIT_MRT_QUEUES],
            orgId: org.id,
          },
          queueIds: [queue.id],
        }),
      ).resolves.toEqual([expect.objectContaining({ id: queue.id })]);
    },
  );

  testWithQueueAndActions()(
    'getExistingJobsForItem is scoped to the given queue IDs',
    async ({ org, queue, user, mrtService, kyselyPg }) => {
      const jobPayload = makeDummyMrtJobPayload();
      await mrtService['queueOps']['addJob']({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload,
      });
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;
      await kyselyPg
        .insertInto('manual_review_tool.job_creations')
        .values({
          id: bullJobIdtoExternalJobId(
            itemIdToBullJobId({ id: itemId, typeId: itemTypeId }),
          ),
          org_id: org.id,
          item_id: itemId,
          item_type_id: itemTypeId,
          queue_id: queue.id,
          created_at: new Date(),
          enqueue_source_info: {},
        })
        .execute();

      const inQueue = await mrtService.getExistingJobsForItem({
        orgId: org.id,
        itemId,
        itemTypeId,
        queueIds: [queue.id],
      });
      expect(inQueue.map((it) => it.queueId)).toEqual([queue.id]);

      const { queue: otherQueue } = await createMrtQueue({
        orgId: org.id,
        mrtService,
        userId: user.id,
        name: `other-queue-${uid()}`,
      });
      const otherQueueOnly = await mrtService.getExistingJobsForItem({
        orgId: org.id,
        itemId,
        itemTypeId,
        queueIds: [otherQueue.id],
      });
      expect(otherQueueOnly).toEqual([]);

      const noQueues = await mrtService.getExistingJobsForItem({
        orgId: org.id,
        itemId,
        itemTypeId,
        queueIds: [],
      });
      expect(noQueues).toEqual([]);
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
    'grant and revoke sequences preserve the tenant-scoped access model',
    async ({ attacker, victim, mrtService, deps }) => {
      const tenants = [attacker, victim];
      let queues = [attacker.queue, victim.queue];
      for (const { org, user } of tenants) {
        const { queue } = await createMrtQueue({
          orgId: org.id,
          userId: user.id,
          mrtService,
          name: 'second-queue',
        });
        queues = [...queues, queue];
      }
      const queueIds = queues.map((queue) => queue.id);
      const missingQueueId = uuidv1();
      const missingUserId = uid();
      const arbitraryOperation = fc.record({
        grant: fc.boolean(),
        actor: fc.integer({ min: 0, max: 1 }),
        user: fc.integer({ min: 0, max: 2 }),
        queues: fc.array(fc.integer({ min: 0, max: 4 }), {
          minLength: 1,
          maxLength: 5,
        }),
      });
      const operation = fc.oneof(
        arbitraryOperation,
        arbitraryOperation.map((op) => ({
          ...op,
          user: op.actor,
          queues: op.queues.map((index) => op.actor + 2 * (index % 2)),
        })),
      );

      await fc.assert(
        fc.asyncProperty(
          fc.array(operation, { minLength: 1, maxLength: 16 }),
          async (operations) => {
            // The outer fixture rolls back per test, not per generated case.
            await deps.KyselyPg.deleteFrom(
              'manual_review_tool.users_and_accessible_queues',
            )
              .where('queue_id', 'in', queueIds)
              .execute();
            let expected: string[] = [];

            for (const op of operations) {
              const orgId = tenants[op.actor].org.id;
              const userId = tenants[op.user]?.user.id ?? missingUserId;
              const requestedQueues = op.queues.map(
                (index) => queues[index]?.id ?? missingQueueId,
              );
              const permitted =
                op.user === op.actor &&
                op.queues.every((index) => index < 4 && index % 2 === op.actor);
              const input = { orgId, userId, queueIds: requestedQueues };
              const result = op.grant
                ? mrtService.addAccessibleQueuesForUser(input)
                : mrtService.removeAccessibleQueuesForUser(input);

              if (permitted) {
                await result;
                const edges = requestedQueues.map((id) => `${userId}:${id}`);
                expected = op.grant
                  ? [...new Set([...expected, ...edges])]
                  : expected.filter((edge) => !edges.includes(edge));
              } else {
                await expect(result).rejects.toMatchObject({
                  name: 'AccessibleQueueNotInOrgError',
                });
              }

              const stored = await deps.KyselyPg.selectFrom(
                'manual_review_tool.users_and_accessible_queues',
              )
                .select(['user_id', 'queue_id'])
                .where('queue_id', 'in', queueIds)
                .execute();
              expect(
                new Set(stored.map((row) => `${row.user_id}:${row.queue_id}`)),
              ).toEqual(new Set(expected));
            }
          },
        ),
        {
          numRuns: 30,
          examples: [
            [
              [
                { grant: true, actor: 0, user: 0, queues: [0, 2, 0] },
                { grant: true, actor: 1, user: 1, queues: [1, 3] },
                { grant: false, actor: 0, user: 0, queues: [0, 1] },
                { grant: true, actor: 0, user: 0, queues: [0, 1] },
                { grant: false, actor: 0, user: 1, queues: [1] },
                { grant: true, actor: 0, user: 1, queues: [0] },
                { grant: false, actor: 0, user: 0, queues: [2, 0, 2] },
                { grant: true, actor: 0, user: 0, queues: [0, 4] },
                { grant: true, actor: 0, user: 2, queues: [0] },
              ],
            ],
          ],
        },
      );
    },
    20_000,
  );

  testWithTwoOrgs()(
    'createManualReviewQueue must not grant access to a user in a different org',
    async ({ attacker, victim, mrtService }) => {
      await expect(
        mrtService.createManualReviewQueue({
          name: 'attacker-queue',
          description: null,
          userIds: [victim.user.id],
          roleIds: [],
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
          roleIds: [],
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

  // A queue creator holds EDIT_MRT_QUEUES; the reviewer is a plain Moderator
  // who is never added to the queue individually, so any access they get comes
  // solely from a role assignment.
  const testWithRoleAssignableQueue = () =>
    makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org } = await createOrg(
        {
          KyselyPg: deps.KyselyPg,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const { user: creator } = await createUser(deps.KyselyPg, org.id, {
        role: UserRole.ADMIN,
      });
      const { user: moderator } = await createUser(deps.KyselyPg, org.id, {
        role: UserRole.MODERATOR,
      });
      return {
        org,
        creator,
        moderator,
        apiKeyService: deps.ApiKeyService,
        moderationConfigService: deps.ModerationConfigService,
        kyselyPg: deps.KyselyPg,
        mrtService: deps.ManualReviewToolService,
      };
    });

  const reviewerInvoker = (userId: string, orgId: string) => ({
    userId,
    permissions: [UserPermission.VIEW_MRT],
    orgId,
  });

  const getRoleId = async (
    db: QueueFixtureRole['kyselyPg'],
    orgId: string,
    role: UserRole,
  ) =>
    db
      .selectFrom('public.roles')
      .select('id')
      .where('org_id', '=', orgId)
      .where('key', '=', role)
      .executeTakeFirstOrThrow()
      .then((row) => row.id);

  const createQueueWithRoles = async (
    mrtService: QueueFixtureRole['mrtService'],
    org: QueueFixtureRole['org'],
    creator: QueueFixtureRole['creator'],
    roleIds: string[],
  ) =>
    mrtService.createManualReviewQueue({
      name: `role-queue-${uid()}`,
      description: null,
      userIds: [creator.id],
      roleIds,
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId: creator.id,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      },
    });

  type QueueFixtureRole = Parameters<
    Parameters<ReturnType<typeof testWithRoleAssignableQueue>>[1]
  >[0];

  testWithRoleAssignableQueue()(
    'a role assigned to a queue grants its members reviewer access',
    async ({ org, creator, moderator, mrtService, kyselyPg }) => {
      const roleId = await getRoleId(kyselyPg, org.id, UserRole.MODERATOR);
      const queue = await createQueueWithRoles(mrtService, org, creator, [
        roleId,
      ]);

      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: reviewerInvoker(moderator.id, org.id),
      });
      expect(reviewable.map((q) => q.id)).toContain(queue.id);
    },
  );

  testWithRoleAssignableQueue()(
    'a repeated role assignment creates the queue with one assignment and grants access',
    async ({ org, creator, moderator, mrtService, kyselyPg }) => {
      const roleId = await getRoleId(kyselyPg, org.id, UserRole.MODERATOR);
      const queue = await createQueueWithRoles(mrtService, org, creator, [
        roleId,
        roleId,
      ]);

      expect(
        await mrtService.getAssignedRoleIdsForQueue({
          orgId: org.id,
          queueId: queue.id,
        }),
      ).toEqual([roleId]);
      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: reviewerInvoker(moderator.id, org.id),
      });
      expect(reviewable.map((q) => q.id)).toContain(queue.id);
    },
  );

  testWithRoleAssignableQueue()(
    'a queue with no assigned roles is not reviewable by an unassigned moderator',
    async ({ org, creator, moderator, mrtService }) => {
      const queue = await createQueueWithRoles(mrtService, org, creator, []);

      const reviewable = await mrtService.getReviewableQueuesForUser({
        invoker: reviewerInvoker(moderator.id, org.id),
      });
      expect(reviewable.map((q) => q.id)).not.toContain(queue.id);
    },
  );

  testWithRoleAssignableQueue()(
    'getQueueForOrg returns a role-accessible queue for a moderator',
    async ({ org, creator, moderator, mrtService, kyselyPg }) => {
      const roleId = await getRoleId(kyselyPg, org.id, UserRole.MODERATOR);
      const queue = await createQueueWithRoles(mrtService, org, creator, [
        roleId,
      ]);

      const fetched = await mrtService.getQueueForOrg({
        orgId: org.id,
        userId: moderator.id,
        queueId: queue.id,
      });
      expect(fetched?.id).toBe(queue.id);
    },
  );

  testWithRoleAssignableQueue()(
    'queue visibility matches tenant, capability, direct and role assignments',
    async ({ org, creator, moderator, mrtService, kyselyPg, deps }) => {
      const roleId = await getRoleId(kyselyPg, org.id, UserRole.MODERATOR);
      const queues = [
        await createQueueWithRoles(mrtService, org, creator, []),
        await createQueueWithRoles(mrtService, org, creator, []),
        await createQueueWithRoles(mrtService, org, creator, []),
      ];
      const { org: otherOrg } = await createOrg(deps);
      const { user: otherUser } = await createUser(kyselyPg, otherOrg.id);
      const otherQueue = await createQueueWithRoles(
        mrtService,
        otherOrg,
        otherUser,
        [],
      );
      const allQueueIds = [...queues.map((queue) => queue.id), otherQueue.id];
      const assignments = fc.array(
        fc.record({ direct: fc.boolean(), role: fc.boolean() }),
        { minLength: 3, maxLength: 3 },
      );

      await fc.assert(
        fc.asyncProperty(
          assignments,
          fc.option(fc.subarray([0, 1, 2, 3]), { nil: undefined }),
          async (access, requested) => {
            // Seed a known mix of assigned and unassigned queues independently
            // of the update under test, including on every shrink attempt.
            const localIds = queues.map((queue) => queue.id);
            await kyselyPg
              .deleteFrom('manual_review_tool.users_and_accessible_queues')
              .where('queue_id', 'in', localIds)
              .execute();
            await kyselyPg
              .deleteFrom('manual_review_tool.roles_and_accessible_queues')
              .where('queue_id', 'in', localIds)
              .execute();
            await kyselyPg
              .insertInto('manual_review_tool.users_and_accessible_queues')
              .values(
                [queues[0], queues[2]].map((queue) => ({
                  queue_id: queue.id,
                  user_id: moderator.id,
                })),
              )
              .execute();
            await kyselyPg
              .insertInto('manual_review_tool.roles_and_accessible_queues')
              .values(
                [queues[0], queues[2]].map((queue) => ({
                  queue_id: queue.id,
                  role_id: roleId,
                })),
              )
              .execute();
            for (const [index, queue] of queues.entries()) {
              await mrtService.updateManualReviewQueue({
                orgId: org.id,
                queueId: queue.id,
                autoCloseJobs: false,
                userIds: access[index].direct
                  ? [creator.id, moderator.id]
                  : [creator.id],
                roleIds: access[index].role ? [roleId] : [],
                actionIdsToHide: [],
                actionIdsToUnhide: [],
              });
            }
            for (const permissions of [
              [],
              [UserPermission.VIEW_CHILD_SAFETY_DATA],
              [UserPermission.VIEW_MRT],
              [UserPermission.EDIT_MRT_QUEUES],
              [UserPermission.VIEW_MRT, UserPermission.EDIT_MRT_QUEUES],
            ]) {
              const expected = queues.filter(
                (_, index) =>
                  (requested === undefined || requested.includes(index)) &&
                  (permissions.includes(UserPermission.EDIT_MRT_QUEUES) ||
                    (permissions.includes(UserPermission.VIEW_MRT) &&
                      (access[index].direct || access[index].role))),
              );
              const actual = await mrtService.getReviewableQueuesForUser({
                invoker: { orgId: org.id, userId: moderator.id, permissions },
                queueIds: requested?.map((index) => allQueueIds[index]),
              });
              expect(actual.map((queue) => queue.id).sort()).toEqual(
                expected.map((queue) => queue.id).sort(),
              );
            }
          },
        ),
        {
          numRuns: 30,
          examples: [
            [
              [
                { direct: true, role: false },
                { direct: false, role: true },
                { direct: false, role: false },
              ],
              undefined,
            ],
            [
              [
                { direct: false, role: true },
                { direct: true, role: false },
                { direct: true, role: true },
              ],
              [],
            ],
          ],
        },
      );
    },
    20_000,
  );

  testWithRoleAssignableQueue()(
    'a role from another organization is rejected without changing queue access',
    async ({
      org,
      creator,
      moderator,
      mrtService,
      kyselyPg,
      moderationConfigService,
      apiKeyService,
    }) => {
      const roleId = await getRoleId(kyselyPg, org.id, UserRole.MODERATOR);
      const queue = await createQueueWithRoles(mrtService, org, creator, [
        roleId,
      ]);
      const { org: otherOrg } = await createOrg(
        {
          KyselyPg: kyselyPg,
          ModerationConfigService: moderationConfigService,
          ApiKeyService: apiKeyService,
        },
        uid(),
      );
      await createUser(kyselyPg, otherOrg.id, { role: UserRole.MODERATOR });
      const otherRoleId = await getRoleId(
        kyselyPg,
        otherOrg.id,
        UserRole.MODERATOR,
      );

      await expect(
        mrtService.updateManualReviewQueue({
          orgId: org.id,
          queueId: queue.id,
          userIds: [creator.id],
          roleIds: [otherRoleId],
          actionIdsToHide: [],
          actionIdsToUnhide: [],
        }),
      ).rejects.toThrow(
        "Queue, user, or role does not belong to the caller's organization",
      );
      expect(
        await mrtService.getAssignedRoleIdsForQueue({
          orgId: org.id,
          queueId: queue.id,
        }),
      ).toEqual([roleId]);
      expect(
        (
          await mrtService.getReviewableQueuesForUser({
            invoker: reviewerInvoker(moderator.id, org.id),
          })
        ).map((q) => q.id),
      ).toContain(queue.id);
    },
  );

  // Regression: RESTRICT FK must block queue deletion when routing rules reference it.
  type QueueFixture = Parameters<
    Parameters<ReturnType<typeof testWithQueueAndActions>>[1]
  >[0];
  type RuleTable =
    | 'manual_review_tool.routing_rules'
    | 'manual_review_tool.appeals_routing_rules';

  const expectDeletionBlockedByRoutingRule = async (
    { org, user, mrtService, kyselyPg }: QueueFixture,
    table: RuleTable,
    ruleName: string,
  ) => {
    const secondQueue = await mrtService.createManualReviewQueue({
      name: `delete-test-queue-${uid()}`,
      description: null,
      userIds: [user.id],
      roleIds: [],
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
    'deleteManualReviewQueue rejects when a routing rule references the queue',
    async (ctx) =>
      expectDeletionBlockedByRoutingRule(
        ctx,
        'manual_review_tool.routing_rules',
        'block-rule',
      ),
  );

  testWithQueueAndActions()(
    'deleteManualReviewQueue rejects when an appeals routing rule references the queue',
    async (ctx) =>
      expectDeletionBlockedByRoutingRule(
        ctx,
        'manual_review_tool.appeals_routing_rules',
        'block-appeals-rule',
      ),
  );
});
