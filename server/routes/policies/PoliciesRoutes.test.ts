import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org, apiKey } = await createOrg(deps);
  const other = await createOrg(deps);
  return { orgId: org.id, apiKey, otherOrgId: other.org.id };
});

describe('GET policies', () => {
  testWithOrg(
    'returns the full public shape for only the authenticated organization',
    async ({ request, deps, apiKey, orgId, otherOrgId }) => {
      const policyInput = {
        name: 'Spam',
        parentId: null,
        policyText: 'No spam',
        enforcementGuidelines: 'Remove unsolicited advertising',
        policyType: 'SPAM' as const,
      };
      const policy = await deps.ModerationConfigService.createPolicy({
        orgId,
        policy: policyInput,
        invokedBy: {
          userId: '',
          orgId,
          permissions: [UserPermission.MANAGE_POLICIES],
        },
      });
      await deps.ModerationConfigService.createPolicy({
        orgId: otherOrgId,
        policy: policyInput,
        invokedBy: {
          userId: '',
          orgId: otherOrgId,
          permissions: [UserPermission.MANAGE_POLICIES],
        },
      });
      const response = await request
        .get('/api/v1/policies/')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(response.body).toEqual({
        policies: [
          {
            id: policy.id,
            ...policyInput,
            semanticVersion: 1,
            userStrikeCount: 1,
            applyUserStrikeCountConfigToChildren: false,
            penalty: 'NONE',
          },
        ],
      });
    },
  );

  testWithOrg(
    'rejects missing and invalid API keys before reading policies',
    async ({ request, deps }) => {
      const read = jest.spyOn(deps.ModerationConfigService, 'getPolicies');
      await request.get('/api/v1/policies/').expect(401);
      await request
        .get('/api/v1/policies/')
        .set('x-api-key', 'invalid-key')
        .expect(401);
      expect(read).not.toHaveBeenCalled();
    },
  );

  testWithOrg('returns an empty collection', async ({ request, apiKey }) => {
    const response = await request
      .get('/api/v1/policies/')
      .set('x-api-key', apiKey)
      .expect(200);
    expect(response.body).toEqual({ policies: [] });
  });
});
