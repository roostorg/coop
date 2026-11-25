import { vi } from 'vitest';

import { MAX_ACTOR_NOTE_LENGTH } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../utils/encoding.js';

const test = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org, apiKey, defaultUserItemType } = await createOrg(deps);
  return { orgId: org.id, apiKey, itemTypeId: defaultUserItemType.id };
});

const body = { actionId: 'a', itemId: 'i', itemTypeId: 't' };
const mixedNote = `${'a'.repeat(MAX_ACTOR_NOTE_LENGTH - 2)}é😀`;

// [body, pointer (undefined = none), detail]: the wording and order JSON
// Schema (AJV) produced for the route's original schema.
const invalidBodies: [unknown, string | undefined, string][] = [
  [{ ...body, note: 1 }, '/note', '/note: must be string'],
  [{ ...body, note: null }, '/note', '/note: must be string'],
  [
    { ...body, note: 'a'.repeat(MAX_ACTOR_NOTE_LENGTH + 1) },
    '/note',
    `/note: must NOT have more than ${MAX_ACTOR_NOTE_LENGTH} characters`,
  ],
  [
    { ...body, note: `${mixedNote}😀` },
    '/note',
    `/note: must NOT have more than ${MAX_ACTOR_NOTE_LENGTH} characters`,
  ],
  [{ ...body, parameters: [] }, '/parameters', '/parameters: must be object'],
  [{ ...body, parameters: null }, '/parameters', '/parameters: must be object'],
  [{ ...body, actionId: null }, '/actionId', '/actionId: must be string'],
  [
    { itemId: 'i', itemTypeId: 't' },
    undefined,
    "/: must have required property 'actionId'",
  ],
  [
    { actionId: 1, itemTypeId: 't' },
    undefined,
    "/: must have required property 'itemId'; /actionId: must be string",
  ],
  [
    { ...body, reportedItems: [{ id: 'x' }] },
    '/reportedItems/0',
    "/reportedItems/0: must have required property 'typeId'",
  ],
  [
    { ...body, reportedItems: [{ id: null, typeId: 't' }] },
    '/reportedItems/0/id',
    '/reportedItems/0/id: must be string',
  ],
  [
    { ...body, reportedItems: [null] },
    '/reportedItems/0',
    '/reportedItems/0: must be object',
  ],
  [
    { ...body, policyIds: [null] },
    '/policyIds/0',
    '/policyIds/0: must be string',
  ],
];

describe('POST /api/v1/actions (AdonisJS auth + VineJS)', () => {
  test('rejects a missing or invalid API key, even with a malformed body', async ({
    request,
  }) => {
    const missing = await request.post('/api/v1/actions').send(body);
    expect(missing.status).toBe(401);
    expect(missing.body.errors[0]).toMatchObject({ title: 'Invalid API Key' });
    // Authentication runs first, as AdonisJS' `auth` middleware does (the
    // Express route validated the body first and answered 400).
    await request
      .post('/api/v1/actions')
      .set('x-api-key', 'invalid-key')
      .send({ note: 1 })
      .expect(401);
  });

  test('answers 503 when the key lookup itself fails', async ({
    request,
    apiKey,
    deps,
  }) => {
    vi.spyOn(deps.ApiKeyService, 'validateApiKey').mockRejectedValue(
      new Error('db down'),
    );
    const response = await request
      .post('/api/v1/actions')
      .set('x-api-key', apiKey)
      .send(body);
    expect(response.status).toBe(503);
    expect(response.body.errors[0]).toMatchObject({
      title: 'Unable to validate API key',
      detail: expect.stringContaining('not a problem with your key'),
    });
  });

  test('reports body errors in the JSON Schema wording', async ({
    request,
    apiKey,
  }) => {
    for (const [input, pointer, detail] of invalidBodies) {
      const response = await request
        .post('/api/v1/actions')
        .set('x-api-key', apiKey)
        .send(input as object);
      expect(response.status, jsonStringify(input)).toBe(400);
      expect(response.body.errors[0].pointer).toBe(pointer);
      expect(response.body.errors[0].detail).toBe(detail);
    }

    const notJson = await request
      .post('/api/v1/actions')
      .set('x-api-key', apiKey)
      .set('content-type', 'text/plain')
      .send('hi');
    expect(notJson.status).toBe(400);
    expect(notJson.body.errors[0].detail).toBe('/: must be object');
  });

  test('passes valid bodies to the handler', async ({ request, apiKey }) => {
    for (const input of [
      { ...body, note: '' },
      { ...body, note: 'a'.repeat(MAX_ACTOR_NOTE_LENGTH) },
      { ...body, note: mixedNote },
      { ...body, parameters: { nested: [null] } },
      // The handler treats a null optional parameter as not supplied.
      { ...body, parameters: { reason: null, 'a.b': null } },
    ]) {
      // Valid, so it reaches the handler, which can't find action 'a'.
      const response = await request
        .post('/api/v1/actions/')
        .set('x-api-key', apiKey)
        .send(input);
      expect(response.status).toBe(400);
      expect(response.body.errors[0]).toMatchObject({
        title: 'Invalid Action',
      });
    }
  });

  test('publishes the action as sent and answers 202', async ({
    request,
    apiKey,
    orgId,
    itemTypeId,
    deps,
  }) => {
    const [action] = await deps.ModerationConfigService.getActions({
      orgId,
      readFromReplica: false,
    });
    const publish = vi
      .spyOn(deps.ActionPublisher, 'publishActions')
      .mockResolvedValue(undefined as never);
    const reportedItems = [{ id: 'r', typeId: itemTypeId, extra: 1 }];
    const response = await request
      .post('/api/v1/actions')
      .set('x-api-key', apiKey)
      .send({
        actionId: action.id,
        itemId: 'item-1',
        itemTypeId,
        note: 'n',
        reportedItems,
      });
    expect(response.status).toBe(202);
    expect(response.headers['content-length']).toBe('0');
    expect(publish).toHaveBeenCalledOnce();
    // Unknown keys reach the handler, as before the port.
    expect(publish.mock.calls[0][0][0].reportedItems).toEqual(reportedItems);
  });
});
