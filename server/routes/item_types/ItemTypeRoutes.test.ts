import { type ItemSchema } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const schema: ItemSchema = [
  { name: 'title', type: 'STRING', required: true, container: null },
];

const testWithTypes = makeTransactionalTestWithFixture(async ({ deps }) => {
  const service = deps.ModerationConfigService;
  const { org, apiKey, defaultUserItemType: user } = await createOrg(deps);
  await createOrg(deps);
  const original = await service.createContentType(org.id, {
    name: 'Post',
    description: 'A post',
    schema,
    schemaFieldRoles: { displayName: 'title' },
  });
  const thread = await service.createThreadType(org.id, {
    name: 'Conversation',
    description: null,
    schema,
    schemaFieldRoles: { displayName: 'title' },
  });
  const content = await service.updateContentType(org.id, {
    id: original.id,
    name: 'Updated Post',
    schemaFieldRoles: { displayName: 'title' },
  });
  return { apiKey, orgId: org.id, user, content, thread };
});

describe('GET item types', () => {
  testWithTypes(
    'returns only current schemas and roles for the authenticated organization',
    async ({ request, apiKey, orgId, content, thread, user }) => {
      const response = await request
        .get('/api/v1/item_types/')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(Object.keys(response.body)).toEqual(['itemTypes']);
      expect(response.body.itemTypes).toHaveLength(3);
      expect(response.body.itemTypes).toEqual(
        expect.arrayContaining([
          {
            id: content.id,
            orgId,
            name: 'Updated Post',
            description: 'A post',
            kind: 'CONTENT',
            schema,
            schemaFieldRoles: { displayName: 'title' },
            version: content.version,
            schemaVariant: 'original',
          },
          {
            id: thread.id,
            orgId,
            name: 'Conversation',
            description: null,
            kind: 'THREAD',
            schema,
            schemaFieldRoles: { displayName: 'title' },
            version: thread.version,
            schemaVariant: 'original',
          },
          {
            id: user.id,
            orgId,
            name: user.name,
            description: user.description,
            kind: 'USER',
            schema: user.schema,
            schemaFieldRoles: user.schemaFieldRoles,
            version: user.version,
            schemaVariant: 'original',
            isDefaultUserType: true,
          },
        ]),
      );
    },
  );

  testWithTypes(
    'rejects missing and invalid API keys before reading item types',
    async ({ request, deps }) => {
      const read = jest.spyOn(deps.ModerationConfigService, 'getItemTypes');
      await request.get('/api/v1/item_types/').expect(401);
      await request
        .get('/api/v1/item_types/')
        .set('x-api-key', 'invalid-key')
        .expect(401);
      expect(read).not.toHaveBeenCalled();
    },
  );

  testWithTypes(
    'returns an empty collection',
    async ({ request, apiKey, deps }) => {
      jest
        .spyOn(deps.ModerationConfigService, 'getItemTypes')
        .mockResolvedValue([]);
      const response = await request
        .get('/api/v1/item_types/')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(response.body).toEqual({ itemTypes: [] });
    },
  );
});
