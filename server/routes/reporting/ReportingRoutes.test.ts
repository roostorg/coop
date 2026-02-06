/* eslint-disable max-lines */
import { faker } from '@faker-js/faker';

import { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';

describe('POST Report', () => {
  const orgId = '2a4634c81d5',
    userId = '834f573a46d';

  let contentTypeId: string;
  let userTypeId: string;
  let threadTypeId: string;

  let models: Dependencies['Sequelize'],
    deps: Awaited<ReturnType<typeof makeMockedServer>>['deps'],
    request: Awaited<ReturnType<typeof makeMockedServer>>['request'],
    shutdown: Awaited<ReturnType<typeof makeMockedServer>>['shutdown'],
    apiKey: Awaited<ReturnType<typeof createOrg>>['apiKey'];

  const getBulkWriteMock = () =>
    deps.DataWarehouseAnalytics.bulkWrite as jest.MockedFunction<
      Dependencies['DataWarehouseAnalytics']['bulkWrite']
    >;

  beforeAll(async () => {
    // eslint-disable-next-line better-mutation/no-mutation
    ({ deps, request, shutdown } = await makeMockedServer());

    // eslint-disable-next-line better-mutation/no-mutation
    models = deps.Sequelize;

    // eslint-disable-next-line better-mutation/no-mutation
    ({ apiKey } = await createOrg(
      models,
      deps.ModerationConfigService,
      deps.ApiKeyService,
      orgId,
    ));
    const userType = await deps.ModerationConfigService.createUserType(orgId, {
      name: 'test user type',
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

    const contentType = await deps.ModerationConfigService.createContentType(
      orgId,
      {
        name: 'test content type',
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
      },
    );

    const threadType = await deps.ModerationConfigService.createThreadType(
      orgId,
      {
        name: 'test thread type',
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
      },
    );
    // eslint-disable-next-line better-mutation/no-mutation
    contentTypeId = contentType.id;
    // eslint-disable-next-line better-mutation/no-mutation
    userTypeId = userType.id;
    // eslint-disable-next-line better-mutation/no-mutation
    threadTypeId = threadType.id;

    await models.User.create({
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
    const { Org, User, ItemType } = models;
    await Org.destroy({ where: { id: orgId } });
    await ItemType.destroy({ where: { id: contentTypeId } });
    await ItemType.destroy({ where: { id: userTypeId } });
    await ItemType.destroy({ where: { id: threadTypeId } });
    await User.destroy({ where: { id: userId } });
    await shutdown();
  });

  beforeEach(() => {
    // This is only safe while we're not running tests concurrently.
    // Consider using the `makeTestWithFixture` helper instead to make
    // a local copy of this state for each test.
    getBulkWriteMock().mockClear();
  });

  test('Should return the expected response for user report and thread', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: new Date().toISOString(),
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: userTypeId,
        data: { name: 'Some name' },
      },
      reportedItemThread: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(getBulkWriteMock().mock.calls[0]).toMatchObject([
      'REPORTING_SERVICE.REPORTS',
      [
        {
          ts: expect.any(Date),
          org_id: orgId,
          request_id: expect.any(String),
          reporter_kind: 'user',
          reported_at: expect.any(Date),
          reported_item_id: '21342135',
          reported_item_data: { name: 'Some name' },
          reported_item_type_id: userTypeId,
          reported_item_type_kind: 'USER',
          reported_item_type_schema: [
            { name: 'name', type: 'STRING', required: true, container: null },
            { name: 'video', type: 'VIDEO', required: false, container: null },
          ],
          reported_item_type_schema_variant: 'original',
          reported_item_type_version: expect.any(String),
          reported_item_type_schema_field_roles: {
            createdAt: undefined,
            displayName: undefined,
          },
          reporter_user_id: '5123521',
          reporter_user_item_type_id: contentTypeId,
          reported_item_thread: [
            {
              id: '21342135',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
            {
              id: '12345123',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
          ],
        },
      ],
    ]);
    expect(getBulkWriteMock().mock.calls[1]).toMatchObject([
      'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS',
      [],
    ]);
  });

  test('Should return the expected response for user report and additional items', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: new Date().toISOString(),
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: userTypeId,
        data: { name: 'Some name' },
      },
      additionalItems: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(getBulkWriteMock().mock.calls[0]).toMatchObject([
      'REPORTING_SERVICE.REPORTS',
      [
        {
          ts: expect.any(Date),
          org_id: orgId,
          request_id: expect.any(String),
          reporter_kind: 'user',
          reported_at: expect.any(Date),
          reported_item_id: '21342135',
          reported_item_data: { name: 'Some name' },
          reported_item_type_id: userTypeId,
          reported_item_type_kind: 'USER',
          reported_item_type_schema: [
            { name: 'name', type: 'STRING', required: true, container: null },
            { name: 'video', type: 'VIDEO', required: false, container: null },
          ],
          reported_item_type_schema_variant: 'original',
          reported_item_type_version: expect.any(String),
          reported_item_type_schema_field_roles: {
            createdAt: undefined,
            displayName: undefined,
          },
          reporter_user_id: '5123521',
          reporter_user_item_type_id: contentTypeId,
          additional_items: [
            {
              id: '21342135',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
            {
              id: '12345123',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
          ],
        },
      ],
    ]);
    expect(getBulkWriteMock().mock.calls[1]).toMatchObject([
      'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS',
      [],
    ]);
  });

  test('Should return the expected response for content report and additional items', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: new Date().toISOString(),
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: contentTypeId,
        data: { name: 'Some name' },
      },
      additionalItems: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(getBulkWriteMock().mock.calls[0]).toMatchObject([
      'REPORTING_SERVICE.REPORTS',
      [
        {
          ts: expect.any(Date),
          org_id: orgId,
          request_id: expect.any(String),
          reporter_kind: 'user',
          reported_at: expect.any(Date),
          reported_item_id: '21342135',
          reported_item_data: { name: 'Some name' },
          reported_item_type_id: contentTypeId,
          reported_item_type_kind: 'CONTENT',
          reported_item_type_schema: [
            { name: 'name', type: 'STRING', required: true, container: null },
            {
              name: 'video',
              type: 'VIDEO',
              required: false,
              container: null,
            },
          ],
          reported_item_type_schema_variant: 'original',
          reported_item_type_version: expect.any(String),
          reported_item_type_schema_field_roles: {
            createdAt: undefined,
            displayName: undefined,
          },
          reporter_user_id: '5123521',
          reporter_user_item_type_id: contentTypeId,
          additional_items: [
            {
              id: '21342135',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
            {
              id: '12345123',
              typeIdentifier: {
                id: contentTypeId,
                version: expect.any(String),
                schemaVariant: 'original',
              },
              data: { name: 'Some name' },
            },
          ],
        },
      ],
    ]);
    expect(getBulkWriteMock().mock.calls[1]).toMatchObject([
      'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS',
      [],
    ]);
  });

  test('Should fail thread report and additional items', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: new Date().toISOString(),
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: threadTypeId,
        data: { name: 'Some name' },
      },
      additionalItems: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(`
          {
            "errors": [
              {
                "status": 400,
                "title": "Invalid report containing additional items on a Thread type.",
                "type": [
                  "/errors/invalid-user-input",
                ],
              },
            ],
          }
        `);
      });
  });

  test('Should pass thread report and item thread content items', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: new Date().toISOString(),
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: threadTypeId,
        data: { name: 'Some name' },
      },
      itemThreadContentItems: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(201);
  });

  test('Should fail invalid reportedAt date', async () => {
    const payload = {
      reporter: { kind: 'user', id: '5123521', typeId: contentTypeId },
      reportedAt: 'invalid date',
      reportedForReason: { policyId: '1231241254', reason: 'Some Reason' },
      reportedItem: {
        id: '21342135',
        typeId: userTypeId,
        data: { name: 'Some name' },
      },
      additionalItems: [
        {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        {
          id: '12345123',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      ],
    };

    await request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchInlineSnapshot(`
          {
            "errors": [
              {
                "status": 400,
                "title": "Invalid reportedAt time",
                "type": [
                  "/errors/invalid-user-input",
                ],
              },
            ],
          }
        `);
      });
  });
});
