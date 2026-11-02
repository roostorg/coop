import { faker } from '@faker-js/faker';
import _ from 'lodash';
import { uid } from 'uid';

import { API_KEY_PERMISSIONS } from '../../services/apiKeyService/index.js';
import { serializeDerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const { omit } = _;

describe('POST Content', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { ModerationConfigService, ApiKeyService, KyselyPg } = deps;
    const orgId = uid();
    const { apiKey } = await createOrg(
      { KyselyPg, ModerationConfigService, ApiKeyService },
      orgId,
    );

    await ModerationConfigService.createContentType(orgId, {
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

    const contentType2 = await ModerationConfigService.createContentType(
      orgId,
      {
        name: 'tes333t',
        description: faker.string.sample(),
        schema: [
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

    await createUser(KyselyPg, orgId, { id: uid() });

    return {
      orgId,
      apiKey,
      contentType2,
      analytics: deps.DataWarehouseAnalytics,
    };
  });

  testWithFixture(
    'content evaluation requires write, and derived data additionally requires read',
    async ({ deps, request, orgId }) => {
      const type = await deps.ModerationConfigService.createContentType(orgId, {
        name: 'Video',
        schema: [
          { name: 'video', type: 'VIDEO', required: false, container: null },
        ],
        schemaFieldRoles: {},
      });
      const field = serializeDerivedFieldSpec({
        source: {
          type: 'CONTENT_FIELD',
          name: 'video',
          contentTypeId: type.id,
        },
        derivationType: 'VIDEO_TRANSCRIPTION',
      });
      const body = {
        contentId: 'item',
        contentType: 'Video',
        content: {},
        sync: true,
      };
      const write = await deps.ApiKeyService.createApiKey(
        orgId,
        'Write',
        null,
        null,
        ['items:write'],
      );
      const read = await deps.ApiKeyService.createApiKey(
        orgId,
        'Read',
        null,
        null,
        ['items:read'],
      );
      const both = await deps.ApiKeyService.createApiKey(
        orgId,
        'Both',
        null,
        null,
        ['items:write', 'items:read'],
      );
      await request
        .post('/api/v1/content')
        .set('x-api-key', write.apiKey)
        .send(body)
        .expect(200, { actionsTriggered: [], derivedFields: {} });
      await request
        .post('/api/v1/content')
        .set('x-api-key', read.apiKey)
        .send(body)
        .expect(403);
      const url = `/api/v1/content?includeDerivedField=${field}`;
      await request
        .post(url)
        .set('x-api-key', write.apiKey)
        .send(body)
        .expect(403);
      await request
        .post(url)
        .set('x-api-key', read.apiKey)
        .send(body)
        .expect(403);
      const response = await request
        .post(url)
        .set('x-api-key', both.apiKey)
        .send(body)
        .expect(200);
      expect(response.body.derivedFields[field].value).toBeNull();

      const longUrl = `/api/v1/content?${'a=1&'.repeat(1000)}includeDerivedField=${field}`;
      await request
        .post(longUrl)
        .set('x-api-key', write.apiKey)
        .send(body)
        .expect(403);
      const longResponse = await request
        .post(longUrl)
        .set('x-api-key', both.apiKey)
        .send(body)
        .expect(200);
      expect(longResponse.body.derivedFields[field].value).toBeNull();
    },
  );

  testWithFixture(
    'POST /content rejects valid keys without items:write',
    async ({ deps, request, orgId }) => {
      const payload = {
        contentId: 'item',
        contentType: 'test',
        content: { name: 'Post' },
        sync: true,
      };
      for (const permissions of [
        [],
        API_KEY_PERMISSIONS.filter(
          (permission) => permission.value !== 'items:write',
        ).map((permission) => permission.value),
      ]) {
        const { apiKey } = await deps.ApiKeyService.createApiKey(
          orgId,
          'Restricted',
          null,
          null,
          permissions,
        );
        await request
          .post('/api/v1/content')
          .set('x-api-key', apiKey)
          .send(payload)
          .expect(403);
      }
      const { apiKey } = await deps.ApiKeyService.createApiKey(
        orgId,
        'Allowed',
        null,
        null,
        ['items:write'],
      );
      await request
        .post('/api/v1/content')
        .set('x-api-key', apiKey)
        .send(payload)
        .expect(200);
    },
  );

  testWithFixture(
    'should return the expected response',
    async ({ request, apiKey, analytics }) => {
      await request
        .post('/api/v1/content')
        .set('x-api-key', apiKey)
        .send({
          contentId: uid(),
          contentType: 'test',
          userId: '32323',
          content: { name: 'John Doe' },
          sync: true,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchInlineSnapshot(`
          {
            "actionsTriggered": [],
            "derivedFields": {},
          }
        `);
        });

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout).toEqual(0);
      });
    },
  );

  testWithFixture(
    'should pass skipBatch param with sync requests',
    async ({ request, apiKey, analytics }) => {
      await request
        .post('/api/v1/content')
        .set('x-api-key', apiKey)
        .send({
          contentId: uid(),
          contentType: 'test',
          userId: '32323',
          content: { name: 'John Doe' },
          sync: true,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchInlineSnapshot(`
          {
            "actionsTriggered": [],
            "derivedFields": {},
          }
        `);
        });

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout).toEqual(0);
      });
    },
  );

  testWithFixture(
    'should return a 202 with async camelCase requests',
    async ({ request, apiKey }) => {
      await request
        .post('/api/v1/content')
        .set('x-api-key', apiKey)
        .send({
          contentId: uid(),
          contentType: 'test',
          userId: '32323',
          content: { name: 'John Doe' },
        })
        .expect(202);
    },
  );

  // For now, we can't run this test routinely because we don't have mocking
  // set up (so it actually tries to contact Hive to transcribe the video).
  // But I ran it manually once and it works.
  testWithFixture.skip(
    'should return the requested derived fields',
    async ({ deps, request }) => {
      const seedOrgId = 'e7c89ce7729';
      const contentType = await deps.ModerationConfigService.createContentType(
        seedOrgId,
        {
          name: 'tes333t',
          description: faker.string.sample(),
          schema: [
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
      const fieldId = serializeDerivedFieldSpec({
        source: {
          type: 'CONTENT_FIELD',
          name: 'video',
          contentTypeId: contentType.id,
        },
        derivationType: 'VIDEO_TRANSCRIPTION',
      });

      await request
        .post(`/api/v1/content?includeDerivedField=${fieldId}`)
        .set('x-api-key', `fakeSecret.${seedOrgId}`)
        .send({
          contentId: uid(),
          contentType: 'tes333t',
          userId: '32323',
          content: {
            video:
              'https://videodelivery.net/8ebf92122bcf448d92b6ffee185046cd/downloads/default.mp4',
          },
          sync: true,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.derivedFields[fieldId].field.source.contentTypeId).toBe(
            contentType.id,
          );

          expect(body.derivedFields[fieldId].value).toMatchInlineSnapshot(
            `"Yeah. To do you. What? Do you like to say something?"`,
          );
          expect(
            omit(body.derivedFields[fieldId].field, 'source.contentTypeId'),
          ).toMatchInlineSnapshot(`
                      Object {
                        "derivationType": "VideoTranscription",
                        "source": Object {
                          "name": "video",
                          "type": "CONTENT_FIELD",
                        },
                      }
                  `);
        })
        .catch((e) => {
          console.log(e);
          throw e;
        });
    },
  );

  testWithFixture(
    'should return null for empty/missing derived fields',
    async ({ request, apiKey, contentType2 }) => {
      const fieldId = serializeDerivedFieldSpec({
        source: {
          type: 'CONTENT_FIELD',
          name: 'video',
          contentTypeId: contentType2.id,
        },
        derivationType: 'VIDEO_TRANSCRIPTION',
      });

      await request
        .post(`/api/v1/content?includeDerivedField=${fieldId}`)
        .set('x-api-key', apiKey)
        .send({
          contentId: uid(),
          contentType: 'tes333t',
          userId: '32323',
          content: {}, // VIDEO field is missing!
          sync: true,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.derivedFields[fieldId].field.source.contentTypeId).toBe(
            contentType2.id,
          );

          expect(
            omit(body.derivedFields[fieldId], 'field.source.contentTypeId'),
          ).toMatchInlineSnapshot(`
            {
              "field": {
                "derivationType": "VIDEO_TRANSCRIPTION",
                "source": {
                  "name": "video",
                  "type": "CONTENT_FIELD",
                },
              },
              "value": null,
            }
          `);
        })
        .catch((e) => {
          console.log(e);
          throw e;
        });
    },
  );
});
