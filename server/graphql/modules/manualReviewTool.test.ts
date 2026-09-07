import { uid } from 'uid';

import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('queue role assignment visibility', () => {
  const testWithQueue = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps);
    const { user: creator } = await createUser(deps.KyselyPg, org.id);
    const assignedRole = await deps.KyselyPg.selectFrom('public.roles')
      .select('id')
      .where('org_id', '=', org.id)
      .where('key', '=', UserRole.MODERATOR)
      .executeTakeFirstOrThrow();
    const queue = await deps.ManualReviewToolService.createManualReviewQueue({
      name: `queue-${uid()}`,
      description: null,
      userIds: [creator.id],
      roleIds: [assignedRole.id],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        orgId: org.id,
        userId: creator.id,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
      },
    });
    return { org, queue, assignedRole };
  });

  testWithQueue(
    'allows assigned reviewers and queue editors to read role assignments, but denies unassigned reviewers',
    async ({ deps, request, org, queue, assignedRole }) => {
      for (const role of [
        UserRole.EXTERNAL_MODERATOR,
        UserRole.MODERATOR,
        UserRole.MODERATOR_MANAGER,
      ]) {
        const { user: viewer } = await createUser(deps.KyselyPg, org.id, {
          role,
          approvedByAdmin: true,
          loginMethods: ['password'],
          password: 'Queue-access-test-password-123!',
        });
        const login = await request.post('/api/v1/graphql').send({
          query: `mutation Login($input: LoginInput!) {
          login(input: $input) { __typename }
        }`,
          variables: {
            input: {
              email: viewer.email,
              password: 'Queue-access-test-password-123!',
            },
          },
        });
        expect(login.body.data?.login.__typename).toBe('LoginSuccessResponse');

        const response = await request.post('/api/v1/graphql').send({
          query: `query QueueRoles($id: ID!) {
          manualReviewQueue(id: $id) { assignedRoleIds }
        }`,
          variables: { id: queue.id },
        });
        if (role !== UserRole.EXTERNAL_MODERATOR) {
          expect(response.body.errors).toBeUndefined();
          expect(response.body.data.manualReviewQueue.assignedRoleIds).toEqual([
            assignedRole.id,
          ]);
        } else {
          expect(response.body.data?.manualReviewQueue).toBeNull();
          expect(response.body.errors).toEqual([
            expect.objectContaining({
              extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
            }),
          ]);
        }
      }
    },
  );
});
