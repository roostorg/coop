import fc from 'fast-check';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org, apiKey } = await createOrg(deps);
  const other = await createOrg(deps);
  return {
    orgId: org.id,
    apiKey,
    otherOrgId: other.org.id,
    otherApiKey: other.apiKey,
  };
});

describe('GET policies', () => {
  testWithOrg(
    'returns the full public shape for only the authenticated organization',
    async ({ request, deps, apiKey, orgId, otherOrgId, otherApiKey }) => {
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
      const otherPolicy = await deps.ModerationConfigService.createPolicy({
        orgId: otherOrgId,
        policy: policyInput,
        invokedBy: {
          userId: '',
          orgId: otherOrgId,
          permissions: [UserPermission.MANAGE_POLICIES],
        },
      });
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
          async (callers) => {
            for (const other of callers) {
              const response = await request
                .get('/api/v1/policies/')
                .set('x-api-key', other ? otherApiKey : apiKey)
                .set('x-org-id', other ? orgId : otherOrgId)
                .query({ orgId: other ? orgId : otherOrgId })
                .expect(200);
              expect(response.body).toEqual({
                policies: [
                  {
                    id: other ? otherPolicy.id : policy.id,
                    ...policyInput,
                    semanticVersion: 1,
                    userStrikeCount: 1,
                    applyUserStrikeCountConfigToChildren: false,
                    penalty: 'NONE',
                  },
                ],
              });
            }
          },
        ),
        {
          numRuns: 20,
          examples: [[[false, true, false]], [[true, false, true]]],
        },
      );
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
