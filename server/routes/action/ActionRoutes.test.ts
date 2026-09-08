import _ from 'lodash';

import { type ItemSchema } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const { sortBy } = _;

const schema: ItemSchema = [
  { name: 'title', type: 'STRING', required: true, container: null },
];
const parameters = [
  {
    name: 'reason',
    displayName: 'Reason',
    type: 'STRING',
    required: true,
    maxLength: 100,
    defaultValue: 'Spam',
  },
];

const testWithConfig = makeTransactionalTestWithFixture(async ({ deps }) => {
  const service = deps.ModerationConfigService;
  const { org, apiKey, defaultUserItemType } = await createOrg(deps);
  const other = await createOrg(deps);
  const content = await service.createContentType(org.id, {
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
  // Leave an older version in Postgres: reads should only expose the current one.
  const currentContent = await service.updateContentType(org.id, {
    id: content.id,
    name: 'Updated Post',
    schemaFieldRoles: { displayName: 'title' },
  });
  const customInput = {
    name: 'Remove',
    description: 'Remove post',
    type: 'CUSTOM_ACTION' as const,
    callbackUrl:
      'https://user:url-secret@example.com/webhook?token=query-secret',
    callbackUrlHeaders: { Authorization: 'header-secret' },
    callbackUrlBody: { token: 'body-secret' },
    applyUserStrikes: true,
    parameters,
  };
  const custom = await service.createAction(org.id, {
    ...customInput,
    itemTypeIds: [content.id],
  });
  const unassigned = await service.createAction(org.id, {
    ...customInput,
    name: 'Unassigned',
    itemTypeIds: [],
  });
  const otherAction = await service.createAction(other.org.id, {
    ...customInput,
    itemTypeIds: [other.defaultUserItemType.id],
  });
  const builtIns = (await service.getActions({ orgId: org.id })).filter(
    (action) => action.actionType !== 'CUSTOM_ACTION',
  );
  return {
    orgId: org.id,
    apiKey,
    other,
    custom,
    unassigned,
    otherAction,
    content: currentContent,
    thread,
    user: defaultUserItemType,
    builtIns,
  };
});

describe('GET actions', () => {
  testWithConfig(
    'GET actions returns metadata and assignments without webhook credentials',
    async ({
      request,
      apiKey,
      orgId,
      custom,
      unassigned,
      builtIns,
      content,
      thread,
      user,
      deps,
    }) => {
      const read = jest.spyOn(deps.ModerationConfigService, 'getActions');
      const readAssignments = jest.spyOn(
        deps.ModerationConfigService,
        'getActionItemTypeIds',
      );
      const response = await request
        .get('/api/v1/actions/')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(read).toHaveBeenCalledTimes(1);
      expect(readAssignments).toHaveBeenCalledTimes(1);
      expect(Object.keys(response.body)).toEqual(['actions']);
      expect(response.body.actions).toHaveLength(5);
      expect(response.body.actions).toEqual(
        expect.arrayContaining([
          {
            id: custom.id,
            orgId,
            name: 'Remove',
            description: 'Remove post',
            actionType: 'CUSTOM_ACTION',
            applyUserStrikes: true,
            penalty: 'NONE',
            parameters,
            itemTypeIds: [content.id],
          },
          {
            id: unassigned.id,
            orgId,
            name: 'Unassigned',
            description: 'Remove post',
            actionType: 'CUSTOM_ACTION',
            applyUserStrikes: true,
            penalty: 'NONE',
            parameters,
            itemTypeIds: [],
          },
          ...builtIns.map((action) => ({
            id: action.id,
            orgId,
            name: action.name,
            description: action.description,
            actionType: action.actionType,
            applyUserStrikes: action.applyUserStrikes,
            penalty: action.penalty,
            parameters: [],
            itemTypeIds: sortBy(
              action.actionType === 'ENQUEUE_TO_MRT'
                ? [content.id, thread.id, user.id]
                : action.actionType === 'ENQUEUE_AUTHOR_TO_MRT'
                  ? [content.id]
                  : [content.id, user.id],
            ),
          })),
        ]),
      );
      for (const secret of [
        'url-secret',
        'query-secret',
        'header-secret',
        'body-secret',
      ]) {
        expect(response.text).not.toContain(secret);
      }
    },
  );

  testWithConfig(
    'bulk assignments return only current explicit and kind-based matches in the requested organization',
    async ({
      deps,
      orgId,
      custom,
      builtIns,
      content,
      thread,
      user,
      other,
      otherAction,
    }) => {
      const result = await deps.ModerationConfigService.getActionItemTypeIds({
        orgId,
      });
      const builtInIds = Object.fromEntries(
        builtIns.map((action) => [action.actionType, action.id]),
      );
      expect(Object.fromEntries(result)).toEqual({
        [custom.id]: [content.id],
        [builtInIds.ENQUEUE_TO_MRT]: sortBy([content.id, thread.id, user.id]),
        [builtInIds.ENQUEUE_AUTHOR_TO_MRT]: [content.id],
        [builtInIds.ENQUEUE_TO_NCMEC]: sortBy([content.id, user.id]),
      });
      const otherResult =
        await deps.ModerationConfigService.getActionItemTypeIds({
          orgId: other.org.id,
        });
      expect(otherResult.get(otherAction.id)).toEqual([
        other.defaultUserItemType.id,
      ]);
      expect(otherResult.has(custom.id)).toBe(false);
    },
  );

  testWithConfig(
    'rejects missing and invalid API keys before reading actions',
    async ({ request, deps }) => {
      const read = jest.spyOn(deps.ModerationConfigService, 'getActions');
      const readAssignments = jest.spyOn(
        deps.ModerationConfigService,
        'getActionItemTypeIds',
      );
      await request.get('/api/v1/actions/').expect(401);
      await request
        .get('/api/v1/actions/')
        .set('x-api-key', 'invalid-key')
        .expect(401);
      expect(read).not.toHaveBeenCalled();
      expect(readAssignments).not.toHaveBeenCalled();
    },
  );

  testWithConfig(
    'returns an empty collection',
    async ({ request, apiKey, deps }) => {
      jest
        .spyOn(deps.ModerationConfigService, 'getActions')
        .mockResolvedValue([]);
      const response = await request
        .get('/api/v1/actions/')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(response.body).toEqual({ actions: [] });
    },
  );
});
