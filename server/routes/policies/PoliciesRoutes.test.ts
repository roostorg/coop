import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createPolicy from '../../test/fixtureHelpers/createPolicy.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';

describe('GET policies', () => {
  const orgId = uid(),
    policyId1 = uid(),
    policyId2 = uid();

  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'],
    apiKey: Awaited<ReturnType<typeof createOrg>>['apiKey'],
    models: Dependencies['Sequelize'],
    ModerationConfigService: Dependencies['ModerationConfigService'],
    ApiKeyService: Dependencies['ApiKeyService'];

  beforeAll(async () => {
    // eslint-disable-next-line better-mutation/no-mutation
    ({
      request,
      shutdown,
      deps: { Sequelize: models, ModerationConfigService, ApiKeyService },
    } = await makeMockedServer());

    const { Org } = models;
    // eslint-disable-next-line better-mutation/no-mutation
    ({ apiKey } = await createOrg({ Org }, ModerationConfigService, ApiKeyService, orgId));
  });

  afterAll(async () => {
    const { Org, Policy } = models;
    await Policy.destroy({ where: { id: policyId1 } });
    await Policy.destroy({ where: { id: policyId2 } });
    await Org.destroy({ where: { id: orgId } });
    await shutdown();
  });

  test.skip('Should return expected response', async () => {
    const policy1 = await createPolicy({
      moderationConfigService: ModerationConfigService,
      orgId,
    });
    const policy2 = await createPolicy({
      moderationConfigService: ModerationConfigService,
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
  });
});
