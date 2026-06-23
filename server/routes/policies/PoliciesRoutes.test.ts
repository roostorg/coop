import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createPolicy from '../../test/fixtureHelpers/createPolicy.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('GET policies', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { ModerationConfigService, ApiKeyService, KyselyPg } = deps;
    const { org, apiKey } = await createOrg(
      { KyselyPg, ModerationConfigService, ApiKeyService },
      uid(),
    );
    return { orgId: org.id, apiKey };
  });

  testWithFixture.skip(
    'Should return expected response',
    async ({ deps, request, orgId, apiKey }) => {
      const policy1 = await createPolicy({
        moderationConfigService: deps.ModerationConfigService,
        orgId,
      });
      const policy2 = await createPolicy({
        moderationConfigService: deps.ModerationConfigService,
        orgId,
      });
      await request
        .post('/api/v1/policies')
        .set('x-api-key', apiKey)
        .send()
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchInlineSnapshot(`
          {
            policies:
              [
                {
                  id: '${policy1.policy.id}',
                  name: '${policy1.policy.name}',
                  parentId: null,
                },
                {
                  id: '${policy2.policy.id}',
                  name: '${policy2.policy.name}',
                  parentId: null
                }
              ]
          }
        `);
        });
    },
  );
});
