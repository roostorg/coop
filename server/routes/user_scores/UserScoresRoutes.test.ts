import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUserItemTypes from '../../test/fixtureHelpers/createUserItemTypes.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('GET policies', () => {
  const testUserScoresRoute = makeTransactionalTestWithFixture(
    async ({ deps }) => {
      const { ModerationConfigService, ApiKeyService, KyselyPg } = deps;

      const { org, apiKey } = await createOrg(
        { KyselyPg, ModerationConfigService, ApiKeyService },
        uid(),
      );
      const { itemTypes } = await createUserItemTypes({
        moderationConfigService: ModerationConfigService,
        orgId: org.id,
        extra: {},
      });
      return { itemType: itemTypes[0], apiKey };
    },
  );

  testUserScoresRoute(
    'Test that a random user gets a 5 returned back',
    async ({ itemType, request, apiKey }) => {
      await request
        .get('/api/v1/user_scores')
        .set('x-api-key', apiKey)
        .query({
          id: 'any user id',
          typeId: itemType.id,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toBe(5);
        });
    },
  );
});
