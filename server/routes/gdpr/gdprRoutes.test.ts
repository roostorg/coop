import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { type ContentItemType } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';

describe('POST /gdrp/delete', () => {
  let contentType: ReadonlyDeep<ContentItemType>;
  const orgId = uid();

  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'],
    apiKey: Awaited<ReturnType<typeof createOrg>>['apiKey'],
    ApiKeyService: Dependencies['ApiKeyService'],
    ModerationConfigService: Dependencies['ModerationConfigService'],
    models: Dependencies['Sequelize'];

  beforeAll(async () => {
    try {
      // eslint-disable-next-line better-mutation/no-mutation
      ({
        request,
        shutdown,
        deps: { Sequelize: models, ModerationConfigService, ApiKeyService },
      } = await makeMockedServer());

      const { Org } = models;
      // eslint-disable-next-line better-mutation/no-mutation
      ({ apiKey } = await createOrg({ Org }, ModerationConfigService, ApiKeyService, orgId));
      // eslint-disable-next-line better-mutation/no-mutation
      contentType = await ModerationConfigService.createContentType(orgId, {
        name: 'TestUser',
        description: 'user type',
        schema: [
          {
            name: 'name',
            type: 'STRING',
            required: true,
            container: null,
          },
        ],
        schemaFieldRoles: {},
      });
    } catch (e) {
      console.log({ e });
      throw e;
    }
  });

  afterAll(async () => {
    const { Org } = models;
    await Org.destroy({ where: { id: orgId } });
    await shutdown();
  });

  test('should return the expected response', async () => {
    const responseSnapshotMatcher = {
      requestId: expect.any(String),
    };
    await request
      .post('/api/v1/gdpr/delete')
      .set('x-api-key', apiKey)
      .send({
        userIds: [
          { id: 'pflock', typeId: contentType.id },
          { id: 'jholm', typeId: contentType.id },
        ],
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(
          responseSnapshotMatcher,
          `
          {
            "requestId": Any<String>,
          }
          `,
        );
      });
  });
});
