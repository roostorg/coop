import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

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
