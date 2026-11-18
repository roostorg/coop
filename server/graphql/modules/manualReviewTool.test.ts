import { and, eq } from 'drizzle-orm';
import { uid } from 'uid';

import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  assertManualReviewJobIdsWithinLimit,
  MAX_MANUAL_REVIEW_JOB_IDS,
} from './manualReviewTool.js';

describe('manual review job ID limit', () => {
  it('accepts up to the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS }, (_, i) => `${i}`),
      ),
    ).not.toThrow();
  });

  it('rejects requests over the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS + 1 }, (_, i) => `${i}`),
      ),
    ).toThrow(`At most ${MAX_MANUAL_REVIEW_JOB_IDS} job IDs may be requested.`);
  });
});

describe('queue role assignment visibility', () => {
  const testWithQueue = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps);
    const { user: creator } = await createUser(deps.DrizzlePg, org.id);
    const roles = schema.roles;
    const [assignedRole] = await deps.DrizzlePg.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.orgId, org.id), eq(roles.key, UserRole.MODERATOR)));
    if (!assignedRole) {
      throw new Error('expected a moderator role');
    }
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
        const { user: viewer } = await createUser(deps.DrizzlePg, org.id, {
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
          expect(response.body.errors).toBeUndefined();
        }
      }
    },
  );
});
