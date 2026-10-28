import crypto from 'node:crypto';
import { sql } from 'kysely';

import { serializeDerivedFieldSpec } from '../services/derivedFieldsService/index.js';
import createOrg from '../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../test/harness/transactionalTest.js';

const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org, defaultUserItemType } = await createOrg(deps);
  return { orgId: org.id, userTypeId: defaultUserItemType.id };
});

describe('API key permissions', () => {
  testWithOrg(
    'new keys have no access unless explicitly granted',
    async ({ deps, request, orgId }) => {
      const { apiKey } = await deps.ApiKeyService.createApiKey(
        orgId,
        'Empty',
        null,
        null,
      );
      expect(
        (await deps.ApiKeyService.getApiKeysForOrg(orgId)).find(
          (key) => key.name === 'Empty',
        )?.permissions,
      ).toEqual([]);
      await request
        .get('/api/v1/policies')
        .set('x-api-key', apiKey)
        .expect(403);
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({ items: [] })
        .expect(403);
    },
  );

  testWithOrg(
    'older application inserts retain only the fixed six compatibility grants',
    async ({ deps, request, orgId }) => {
      const apiKey = 'legacy-test-key';
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
      await sql`INSERT INTO public.api_keys (org_id, key_hash, name) VALUES (${orgId}, ${hash}, 'Older instance')`.execute(
        deps.KyselyPg,
      );
      expect(await deps.ApiKeyService.validateApiKey(apiKey)).toEqual({
        orgId,
        permissions: [
          'items:read',
          'items:write',
          'reports:write',
          'appeals:write',
          'actions:execute',
          'config:read',
        ],
      });
      await request
        .get('/api/v1/policies')
        .set('x-api-key', apiKey)
        .expect(200, { policies: [] });
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({ items: [] })
        .expect(202);
    },
  );

  testWithOrg(
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

  testWithOrg(
    'reports, appeals, and action execution require their own grants',
    async ({ deps, request, orgId, userTypeId }) => {
      const item = { id: 'item', typeId: userTypeId, data: {} };
      const report = {
        reporter: { kind: 'user', id: 'reporter', typeId: userTypeId },
        reportedAt: new Date().toISOString(),
        reportedItem: item,
      };
      const appeal = {
        appealId: 'appeal',
        appealedBy: { id: 'appealer', typeId: userTypeId },
        appealedAt: new Date().toISOString(),
        actionedItem: item,
        actionsTaken: [],
      };
      const reportKey = await deps.ApiKeyService.createApiKey(
        orgId,
        'Report',
        null,
        null,
        ['reports:write'],
      );
      const appealKey = await deps.ApiKeyService.createApiKey(
        orgId,
        'Appeal',
        null,
        null,
        ['appeals:write'],
      );
      const actionKey = await deps.ApiKeyService.createApiKey(
        orgId,
        'Action',
        null,
        null,
        ['actions:execute'],
      );
      await request
        .post('/api/v1/report')
        .set('x-api-key', appealKey.apiKey)
        .send(report)
        .expect(403);
      await request
        .post('/api/v1/report/appeal')
        .set('x-api-key', reportKey.apiKey)
        .send(appeal)
        .expect(403);
      await request
        .post('/api/v1/report')
        .set('x-api-key', reportKey.apiKey)
        .send(report)
        .expect(201);
      await request
        .post('/api/v1/report/appeal')
        .set('x-api-key', appealKey.apiKey)
        .send(appeal)
        .expect(204);
      const actions = await deps.ModerationConfigService.getActions({ orgId });
      const action = {
        itemId: 'user',
        itemTypeId: userTypeId,
        actionId: actions[0].id,
      };
      await request
        .post('/api/v1/actions')
        .set('x-api-key', reportKey.apiKey)
        .send(action)
        .expect(403);
      await request
        .post('/api/v1/actions')
        .set('x-api-key', actionKey.apiKey)
        .send(action)
        .expect(202);
      await request
        .get('/api/v1/actions')
        .set('x-api-key', actionKey.apiKey)
        .expect(403);
    },
  );

  testWithOrg(
    'read and write grants are independent and rotation preserves them',
    async ({ deps, request, orgId, userTypeId }) => {
      const read = await deps.ApiKeyService.createApiKey(
        orgId,
        'Read',
        null,
        null,
        ['items:read'],
      );
      const write = await deps.ApiKeyService.createApiKey(
        orgId,
        'Write',
        null,
        null,
        ['items:write'],
      );
      const scores = `/api/v1/user_scores?id=user&typeId=${userTypeId}`;
      await request.get(scores).set('x-api-key', read.apiKey).expect(200, '5');
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', read.apiKey)
        .send({ items: [] })
        .expect(403);
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', write.apiKey)
        .send({ items: [] })
        .expect(202);
      await request.get(scores).set('x-api-key', write.apiKey).expect(403);
      const rotated = await deps.ApiKeyService.rotateApiKey(
        orgId,
        'Read',
        null,
        read.record.id,
      );
      expect(rotated.record.permissions).toEqual(['items:read']);
      await request.get(scores).set('x-api-key', read.apiKey).expect(401);
      await request
        .get(scores)
        .set('x-api-key', rotated.apiKey)
        .expect(200, '5');
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', rotated.apiKey)
        .send({ items: [] })
        .expect(403);
      await deps.ApiKeyService.deleteApiKey(read.record.id, orgId);
      await request.get(scores).set('x-api-key', rotated.apiKey).expect(401);
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', write.apiKey)
        .send({ items: [] })
        .expect(202);
    },
  );

  testWithOrg(
    'configuration write does not imply configuration read',
    async ({ deps, request, orgId }) => {
      const read = await deps.ApiKeyService.createApiKey(
        orgId,
        'Config read',
        null,
        null,
        ['config:read'],
      );
      const write = await deps.ApiKeyService.createApiKey(
        orgId,
        'Config write',
        null,
        null,
        ['config:write'],
      );
      for (const resource of ['actions', 'item_types', 'policies']) {
        await request
          .get(`/api/v1/${resource}`)
          .set('x-api-key', read.apiKey)
          .expect(200);
        await request
          .get(`/api/v1/${resource}`)
          .set('x-api-key', write.apiKey)
          .expect(403);
      }
    },
  );

  testWithOrg('rejects unknown permission values', async ({ deps, orgId }) => {
    await expect(
      deps.ApiKeyService.createApiKey(orgId, 'Invalid', null, null, [
        'items:*',
      ]),
    ).rejects.toThrow('Unknown API key permission');
  });

  testWithOrg(
    'cannot rotate or delete a foreign organization key',
    async ({ deps, orgId }) => {
      const other = await createOrg(deps);
      const key = await deps.ApiKeyService.createApiKey(
        other.org.id,
        'Other',
        null,
        null,
        ['config:read'],
      );
      await expect(
        deps.ApiKeyService.rotateApiKey(orgId, 'Other', null, key.record.id),
      ).rejects.toThrow('Active API key not found');
      expect(await deps.ApiKeyService.deleteApiKey(key.record.id, orgId)).toBe(
        false,
      );
      expect(await deps.ApiKeyService.getApiKeysForOrg(orgId)).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: key.record.id }),
        ]),
      );
    },
  );
});
