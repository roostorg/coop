import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUserItemTypes from '../../test/fixtureHelpers/createUserItemTypes.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';

describe('GET policies', () => {
  test('Should return expected response', async () => {
    const testUserScoresRoute = makeTestWithFixture(async () => {
      const {
        request,
        shutdown,
        deps: { Sequelize: models, ModerationConfigService, ApiKeyService },
      } = await makeMockedServer();

      const { org, apiKey, cleanup: orgCleanup } = await createOrg(
        models,
        ModerationConfigService,
        ApiKeyService,
        uid(),
      );
      const { itemTypes, cleanup } = await createUserItemTypes({
        moderationConfigService: ModerationConfigService,
        orgId: org.id,
        extra: {},
      });
      return {
        itemType: itemTypes[0],
        apiKey,
        request,
        async cleanup() {
          await cleanup();
          await orgCleanup();
          await shutdown();
        },
      };
    });

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
});
