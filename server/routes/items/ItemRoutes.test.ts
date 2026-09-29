import { faker } from '@faker-js/faker';
import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { createBodySchemaValidator } from '../../utils/bodySchemaValidation.js';
import itemRoutes from './ItemRoutes.js';

describe('POST Items', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { ModerationConfigService, ApiKeyService, KyselyPg } = deps;
    const orgId = uid();
    const { apiKey } = await createOrg(
      { KyselyPg, ModerationConfigService, ApiKeyService },
      orgId,
    );

    const contentType = await ModerationConfigService.createContentType(orgId, {
      name: 'test',
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

    await createUser(KyselyPg, orgId, { id: uid() });

    return { apiKey, contentType, analytics: deps.DataWarehouseAnalytics };
  });

  testWithFixture(
    'should return the expected response',
    async ({ request, apiKey, contentType, analytics }) => {
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

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout ?? undefined).toEqual(undefined);
      });
    },
  );

  testWithFixture(
    'accepts an item with a type selector and nested data',
    async ({ request, apiKey, contentType }) => {
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: uid(),
              data: { name: 'John Doe', metadata: { source: 'test' } },
              type: { id: contentType.id },
            },
          ],
        })
        .expect(202);
    },
  );

  testWithFixture(
    'should return errors for only items that failed to be validated',
    async ({ request, apiKey, contentType, analytics }) => {
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

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout ?? undefined).toEqual(undefined);
      });
    },
  );
});

test('POST /items/async accepts object data and rejects arrays and null', async () => {
  const app = express();
  app.use(express.json());
  const schema = itemRoutes.routes[0].bodySchema!;
  app.post(
    '/api/v1/items/async',
    createBodySchemaValidator(schema),
    (_req, res) => res.sendStatus(204),
  );
  app.use(((error, _req, res, _next) => {
    res.status(error.status ?? 500).json(error);
  }) satisfies ErrorRequestHandler);
  const item = { id: 'i', typeId: 't' };

  await request(app)
    .post('/api/v1/items/async')
    .send({ items: [{ ...item, data: { nested: [null] } }] })
    .expect(204);
  for (const data of [[], null]) {
    await request(app)
      .post('/api/v1/items/async')
      .send({ items: [{ ...item, data }] })
      .expect(400);
  }
});

test('POST /items/async requires exactly one valid item type selector branch', async () => {
  const app = express();
  app.use(express.json());
  const schema = itemRoutes.routes[0].bodySchema!;
  app.post(
    '/api/v1/items/async',
    createBodySchemaValidator(schema),
    (_req, res) => res.sendStatus(204),
  );
  app.use(((error, _req, res, _next) => {
    res.status(error.status ?? 500).json(error);
  }) satisfies ErrorRequestHandler);
  const item = { id: 'item-1', data: {} };

  await request(app)
    .post('/api/v1/items/async')
    .send({ items: [{ ...item, type: { id: 'post' }, typeId: 123 }] })
    .expect(204);
  await request(app)
    .post('/api/v1/items/async')
    .send({ items: [{ ...item, typeId: 'post', type: null }] })
    .expect(204);
  await request(app)
    .post('/api/v1/items/async')
    .send({ items: [{ ...item, typeId: 'post', type: { id: 'post' } }] })
    .expect(400);
});
