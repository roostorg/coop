import { sql } from 'kysely';
import { assert } from 'vitest';

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
    'permission edits change access on the next request without rotating the key',
    async ({ deps, request, orgId }) => {
      const { apiKey, record } = await deps.ApiKeyService.createApiKey(
        orgId,
        'Reports',
        null,
        null,
      );
      await request
        .get('/api/v1/policies')
        .set('x-api-key', apiKey)
        .expect(403);
      await deps.ApiKeyService.updateApiKey(
        record.id,
        orgId,
        record.name,
        null,
        ['config:read'],
      );
      await request
        .get('/api/v1/policies')
        .set('x-api-key', apiKey)
        .expect(200);
      await deps.ApiKeyService.updateApiKey(
        record.id,
        orgId,
        record.name,
        null,
        [],
      );
      await request
        .get('/api/v1/policies')
        .set('x-api-key', apiKey)
        .expect(403);
    },
  );

  testWithOrg(
    'older application inserts retain only the fixed six compatibility grants',
    async ({ deps, request, orgId }) => {
      const { apiKey, record } = await deps.ApiKeyService.createApiKey(
        orgId,
        'Older instance',
        null,
        null,
      );
      await deps.ApiKeyService.deleteApiKey(record.id, orgId);
      await sql`INSERT INTO public.api_keys (org_id, key_hash, name) VALUES (${orgId}, ${record.keyHash}, 'Older instance')`.execute(
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
        read.record.id,
      );
      assert.isNotNull(rotated);
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
        deps.ApiKeyService.rotateApiKey(orgId, key.record.id),
      ).resolves.toBeNull();
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
