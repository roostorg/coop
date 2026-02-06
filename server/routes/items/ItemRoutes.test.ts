import { faker } from '@faker-js/faker';
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { type ContentItemType } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';

describe('POST Items', () => {
  const orgId = uid(),
    userId = uid();
  let contentType: ReadonlyDeep<ContentItemType>;

  let request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'],
    apiKey: Awaited<ReturnType<typeof createOrg>>['apiKey'],
    models: Dependencies['Sequelize'],
    ModerationConfigService: Dependencies['ModerationConfigService'],
    ApiKeyService: Dependencies['ApiKeyService'],
    analytics: Dependencies['DataWarehouseAnalytics'];

  beforeAll(async () => {
    // eslint-disable-next-line better-mutation/no-mutation
    ({
      request,
      shutdown,
      deps: {
        Sequelize: models,
        DataWarehouseAnalytics: analytics,
        ModerationConfigService,
        ApiKeyService,
      },
    } = await makeMockedServer());

    const { User, Org } = models;
    // eslint-disable-next-line better-mutation/no-mutation
    ({ apiKey } = await createOrg({ Org }, ModerationConfigService, ApiKeyService, orgId));
    // eslint-disable-next-line better-mutation/no-mutation
    contentType = await ModerationConfigService.createContentType(orgId, {
      name: 'test',
      description: faker.datatype.string(),
      schema: [
        {
          name: 'name',
          type: 'STRING',
          required: true,
          container: null,
        },
        {
          name: 'video',
          type: 'VIDEO',
          required: false,
          container: null,
        },
      ],
      schemaFieldRoles: {},
    });

    await User.create({
      id: userId,
      orgId,
      password: faker.random.alphaNumeric(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      email: faker.internet.email(),
      loginMethods: ['password'],
    });
  });

  afterAll(async () => {
    const { Org, User } = models;
    await Org.destroy({ where: { id: orgId } });
    await ModerationConfigService.deleteItemType({
      orgId,
      itemTypeId: contentType.id,
    });
    await User.destroy({ where: { id: userId } });
    await shutdown();
  });

  beforeEach(() => {
    (analytics.bulkWrite as jest.Mock).mockClear();
  });

  test('should return the expected response', async () => {
    await request
      .post('/api/v1/items/async')
      .set('x-api-key', apiKey)
      .send({
        items: [
          {
            id: uid(),
            data: { name: 'John Doe' },
            typeId: contentType.id,
          },
        ],
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(`{}`);
      });

    const bulkWrite = analytics.bulkWrite as jest.MockedFunction<
      Dependencies['DataWarehouseAnalytics']['bulkWrite']
    >;
    bulkWrite.mock.calls.forEach(([, , config]) => {
      expect(config?.batchTimeout ?? undefined).toEqual(undefined);
    });
  });

  test('should return errors for only items that failed to be validated', async () => {
    const failingUid = uid();
    const failingUid2 = uid();
    await request
      .post('/api/v1/items/async')
      .set('x-api-key', apiKey)
      .send({
        items: [
          {
            id: uid(),
            data: { name: 'John Doe' },
            typeId: contentType.id,
          },
          {
            id: failingUid,
            data: { video: 'https://my-dummy-video.com/' },
            typeId: contentType.id,
          },
          {
            id: failingUid2,
            data: { video: 'https://second-dummy-video.com/' },
            typeId: contentType.id,
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(`
          {
            "errors": [
              {
                "detail": "The field 'name' is required, but was not provided.",
                "pointer": "/items/1",
                "status": 400,
                "title": "Invalid Data for Item",
                "type": [
                  "/errors/data-invalid-for-item-type",
                  "/errors/invalid-user-input",
                ],
              },
              {
                "detail": "The field 'name' is required, but was not provided.",
                "pointer": "/items/2",
                "status": 400,
                "title": "Invalid Data for Item",
                "type": [
                  "/errors/data-invalid-for-item-type",
                  "/errors/invalid-user-input",
                ],
              },
            ],
          }
        `);
      });

    const bulkWrite = analytics.bulkWrite as jest.MockedFunction<
      Dependencies['DataWarehouseAnalytics']['bulkWrite']
    >;
    bulkWrite.mock.calls.forEach(([, , config]) => {
      expect(config?.batchTimeout ?? undefined).toEqual(undefined);
    });
  });
});
