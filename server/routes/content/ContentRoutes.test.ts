import { faker } from '@faker-js/faker';
import _ from 'lodash';
import { uid } from 'uid';

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

    const contentType2 = await ModerationConfigService.createContentType(
      orgId,
      {
        name: 'tes333t',
        description: faker.datatype.string(),
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

    return { apiKey, contentType2, analytics: deps.DataWarehouseAnalytics };
  });

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
          description: faker.datatype.string(),
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
