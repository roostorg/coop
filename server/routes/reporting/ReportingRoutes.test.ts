import { faker } from '@faker-js/faker';
import { uid } from 'uid';
import { vi } from 'vitest';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('POST Report', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    const { apiKey } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );
    const userType = await deps.ModerationConfigService.createUserType(orgId, {
      name: 'test user type',
      description: faker.string.sample(),
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
        description: faker.string.sample(),
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
        description: faker.string.sample(),
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

    await createUser(deps.KyselyPg, orgId, { id: uid() });

    return {
      apiKey,
      orgId,
      contentTypeId: contentType.id,
      userTypeId: userType.id,
      threadTypeId: threadType.id,
      getBulkWriteMock: () => deps.DataWarehouseAnalytics.bulkWrite,
    };
  });

  testWithFixture(
    'Should return the expected response for user report and thread',
    async ({
      request,
      apiKey,
      orgId,
      contentTypeId,
      userTypeId,
      getBulkWriteMock,
    }) => {
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
    },
  );

  testWithFixture(
    'Should return the expected response for user report and additional items',
    async ({
      request,
      apiKey,
      orgId,
      contentTypeId,
      userTypeId,
      getBulkWriteMock,
    }) => {
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
    },
  );

  testWithFixture(
    'Should accept non-Content (user) items in additional items',
    async ({
      request,
      apiKey,
      orgId,
      contentTypeId,
      userTypeId,
      getBulkWriteMock,
      deps,
    }) => {
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
            id: '12345123',
            typeId: userTypeId,
            data: { name: 'Some name' },
          },
        ],
      };

      // Spy (calling through) so we can assert what gets forwarded to MRT.
      const enqueueSpy = vi.spyOn(deps.ManualReviewToolService, 'enqueue');

      try {
        await request
          .post('/api/v1/report')
          .set('x-api-key', apiKey)
          .send(payload)
          .expect(201);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // The user item is still indexed/recorded on the report row...
        expect(getBulkWriteMock().mock.calls[0]).toMatchObject([
          'REPORTING_SERVICE.REPORTS',
          [
            {
              org_id: orgId,
              reported_item_id: '21342135',
              reported_item_type_kind: 'CONTENT',
              additional_items: [
                {
                  id: '12345123',
                  typeIdentifier: {
                    id: userTypeId,
                    version: expect.any(String),
                    schemaVariant: 'original',
                  },
                  data: { name: 'Some name' },
                },
              ],
            },
          ],
        ]);

        // ...but it must NOT leak into MRT's Content-only `additionalContentItems`.
        expect(enqueueSpy).toHaveBeenCalled();
        const enqueueArg = enqueueSpy.mock.calls[0]?.[0] as
          | {
              payload?: {
                additionalContentItems?: ReadonlyArray<{ id: string }>;
              };
            }
          | undefined;
        expect(enqueueArg?.payload?.additionalContentItems ?? []).toEqual([]);
      } finally {
        enqueueSpy.mockRestore();
      }
    },
  );

  testWithFixture(
    'Should return the expected response for content report and additional items',
    async ({ request, apiKey, orgId, contentTypeId, getBulkWriteMock }) => {
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
    },
  );

  testWithFixture(
    'Should fail thread report and additional items',
    async ({ request, apiKey, contentTypeId, threadTypeId }) => {
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
    },
  );

  testWithFixture(
    'Should pass thread report and item thread content items',
    async ({ request, apiKey, contentTypeId, threadTypeId }) => {
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
    },
  );

  testWithFixture(
    'Should record report context in the warehouse and MRT report history',
    async ({
      request,
      apiKey,
      orgId,
      contentTypeId,
      userTypeId,
      getBulkWriteMock,
      deps,
    }) => {
      const payload = {
        reporter: { kind: 'user', id: '5123521', typeId: userTypeId },
        reportedAt: new Date().toISOString(),
        reportedItem: {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
        reportContext: {
          surface: 'profile',
          client: { name: 'Ivory', version: '2.3.1', platform: null },
          attributes: { experimentArm: 'new_flow_b', retried: false },
        },
      };

      const enqueueSpy = vi.spyOn(deps.ManualReviewToolService, 'enqueue');

      try {
        await request
          .post('/api/v1/report')
          .set('x-api-key', apiKey)
          .send(payload)
          .expect(201);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const expectedContext = {
          surface: 'profile',
          client: { name: 'Ivory', version: '2.3.1' },
          attributes: { experimentArm: 'new_flow_b', retried: false },
        };

        expect(getBulkWriteMock().mock.calls[0]).toMatchObject([
          'REPORTING_SERVICE.REPORTS',
          [
            {
              org_id: orgId,
              reported_item_id: '21342135',
              report_surface: 'profile',
              report_client_name: 'Ivory',
              report_client_version: '2.3.1',
              report_context_attributes: expectedContext.attributes,
            },
          ],
        ]);
        // Null fields are omitted so the column keeps its '' default.
        expect(getBulkWriteMock().mock.calls[0]?.[1]?.[0]).not.toHaveProperty(
          'report_client_platform',
        );

        expect(enqueueSpy).toHaveBeenCalled();
        const enqueueArg = enqueueSpy.mock.calls[0]?.[0] as
          { payload?: { reportHistory?: ReadonlyArray<unknown> } } | undefined;
        expect(enqueueArg?.payload?.reportHistory).toEqual([
          expect.objectContaining({ context: expectedContext }),
        ]);
      } finally {
        enqueueSpy.mockRestore();
      }
    },
  );

  testWithFixture(
    'Should not write report context columns when no context is sent',
    async ({
      request,
      apiKey,
      contentTypeId,
      userTypeId,
      getBulkWriteMock,
    }) => {
      await request
        .post('/api/v1/report')
        .set('x-api-key', apiKey)
        .send({
          reporter: { kind: 'user', id: '5123521', typeId: userTypeId },
          reportedAt: new Date().toISOString(),
          reportedItem: {
            id: '21342135',
            typeId: contentTypeId,
            data: { name: 'Some name' },
          },
        })
        .expect(201);

      const row = getBulkWriteMock().mock.calls[0]?.[1]?.[0];
      for (const column of [
        'report_surface',
        'report_client_name',
        'report_client_version',
        'report_client_platform',
        'report_context_attributes',
      ]) {
        expect(row).not.toHaveProperty(column);
      }
    },
  );

  testWithFixture(
    'Should reject invalid report context',
    async ({ request, apiKey, contentTypeId, userTypeId }) => {
      const basePayload = {
        reporter: { kind: 'user', id: '5123521', typeId: userTypeId },
        reportedAt: new Date().toISOString(),
        reportedItem: {
          id: '21342135',
          typeId: contentTypeId,
          data: { name: 'Some name' },
        },
      };

      for (const reportContext of [
        { surface: 'x'.repeat(257) },
        { attributes: { nested: { not: 'allowed' } } },
        {
          attributes: Object.fromEntries(
            Array.from({ length: 51 }, (_, i) => [`key${i}`, i]),
          ),
        },
      ]) {
        await request
          .post('/api/v1/report')
          .set('x-api-key', apiKey)
          .send({ ...basePayload, reportContext })
          .expect(400);
      }
    },
  );

  testWithFixture(
    'Should fail invalid reportedAt date',
    async ({ request, apiKey, contentTypeId, userTypeId }) => {
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
    },
  );
});
