import { faker } from '@faker-js/faker';
import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { serializeDerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import { type ContentItemType } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';

const { omit } = _;

describe('POST Content', () => {
  const orgId = uid(),
    userId = uid();
  let contentType1: ReadonlyDeep<ContentItemType>,
    contentType2: ReadonlyDeep<ContentItemType>;

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
    contentType1 = await ModerationConfigService.createContentType(orgId, {
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

    // eslint-disable-next-line better-mutation/no-mutation
    contentType2 = await ModerationConfigService.createContentType(orgId, {
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
      itemTypeId: contentType1.id,
    });
    await ModerationConfigService.deleteItemType({
      orgId,
      itemTypeId: contentType2.id,
    });
    await User.destroy({ where: { id: userId } });
    await shutdown();
  });

  beforeEach(() => {
    (analytics.bulkWrite as jest.Mock).mockClear();
  });

  test('should return the expected response', async () => {
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

    const bulkWrite = analytics.bulkWrite as jest.MockedFunction<
      Dependencies['DataWarehouseAnalytics']['bulkWrite']
    >;
    bulkWrite.mock.calls.forEach(([, , config]) => {
      expect(config?.batchTimeout).toEqual(0);
    });
  });

  it('should pass skipBatch param with sync requests', async () => {
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

    const bulkWrite = analytics.bulkWrite as jest.MockedFunction<
      Dependencies['DataWarehouseAnalytics']['bulkWrite']
    >;
    bulkWrite.mock.calls.forEach(([, , config]) => {
      expect(config?.batchTimeout).toEqual(0);
    });
  });

  it('should return a 202 with async camelCase requests', async () => {
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
  });

  // For now, we can't run this test routinely because we don't have mocking
  // set up (so it actually tries to contact Hive to transcribe the video).
  // But I ran it manually once and it works.
  test.skip('should return the requested derived fields', async () => {
    const seedOrgId = 'e7c89ce7729';
    const contentTypeId = uid();
    const fieldId = serializeDerivedFieldSpec({
      source: { type: 'CONTENT_FIELD', name: 'video', contentTypeId },
      derivationType: 'VIDEO_TRANSCRIPTION',
    });

    const contentType = await models.ItemType.create({
      id: contentTypeId,
      name: 'tes333t',
      description: faker.datatype.string(),
      orgId: seedOrgId,
      fields: [
        {
          name: 'video',
          type: 'VIDEO',
          required: false,
          container: null,
        },
      ],
      kind: 'CONTENT',
    });

    try {
      return await request
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
            contentTypeId,
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
    } finally {
      await contentType.destroy();
    }
  });

  test('should return null for empty/missing derived fields', async () => {
    const fieldId = serializeDerivedFieldSpec({
      source: {
        type: 'CONTENT_FIELD',
        name: 'video',
        contentTypeId: contentType2.id,
      },
      derivationType: 'VIDEO_TRANSCRIPTION',
    });

    return request
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

        expect(omit(body.derivedFields[fieldId], 'field.source.contentTypeId'))
          .toMatchInlineSnapshot(`
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
  });
});
