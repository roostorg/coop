import { vi } from 'vitest';

import { MAX_ACTOR_NOTE_LENGTH } from '../../services/moderationConfigService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const test = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { apiKey, defaultUserItemType } = await createOrg(deps);
  return { apiKey, itemTypeId: defaultUserItemType.id };
});

describe('POST /api/v1/actions (AdonisJS auth + VineJS)', () => {
  test('rejects a missing or invalid API key', async ({ request }) => {
    const body = { actionId: 'a', itemId: 'i', itemTypeId: 't' };
    const missing = await request.post('/api/v1/actions').send(body);
    expect(missing.status).toBe(401);
    expect(missing.body.errors[0]).toMatchObject({ title: 'Invalid API Key' });
    await request
      .post('/api/v1/actions')
      .set('x-api-key', 'invalid-key')
      .send(body)
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
      .send({ actionId: 'a', itemId: 'i', itemTypeId: 't' });
    expect(response.status).toBe(503);
  });

  test('reports body errors in the JSON Schema wording', async ({
    request,
    apiKey,
  }) => {
    const post = async (body: unknown) =>
      request
        .post('/api/v1/actions')
        .set('x-api-key', apiKey)
        .send(body as object);
    const body = { actionId: 'a', itemId: 'i', itemTypeId: 't' };

    const cases: [unknown, string, string][] = [
      [{ ...body, note: 1 }, '/note', '/note: must be string'],
      [
        { ...body, note: 'a'.repeat(MAX_ACTOR_NOTE_LENGTH + 1) },
        '/note',
        `/note: must NOT have more than ${MAX_ACTOR_NOTE_LENGTH} characters`,
      ],
      [
        { ...body, parameters: [] },
        '/parameters',
        '/parameters: must be object',
      ],
      [
        { itemId: 'i', itemTypeId: 't' },
        '',
        "/: must have required property 'actionId'",
      ],
      [
        { ...body, reportedItems: [{ id: 'x' }] },
        '/reportedItems/0',
        "/reportedItems/0: must have required property 'typeId'",
      ],
    ];
    for (const [input, pointer, detail] of cases) {
      const response = await post(input);
      expect(response.status).toBe(400);
      expect(response.body.errors[0]).toMatchObject({
        ...(pointer ? { pointer } : {}),
        detail,
      });
    }

    // Valid bodies reach the handler, which looks up the (unknown) action.
    const mixedNote = `${'a'.repeat(MAX_ACTOR_NOTE_LENGTH - 2)}é😀`;
    for (const input of [
      { ...body, note: mixedNote },
      { ...body, parameters: { nested: [null] } },
    ]) {
      const response = await post(input);
      expect(response.status).toBe(400);
      expect(response.body.errors[0]).toMatchObject({
        title: 'Invalid Action',
      });
    }
  });

  test('a null optional field is rejected, as JSON Schema did', async ({
    request,
    apiKey,
  }) => {
    for (const field of ['note', 'parameters']) {
      const response = await request
        .post('/api/v1/actions')
        .set('x-api-key', apiKey)
        .send({ actionId: 'a', itemId: 'i', itemTypeId: 't', [field]: null });
      expect(response.status).toBe(400);
      expect(response.body.errors[0].pointer).toBe(`/${field}`);
    }
  });

  test('publishes the action and answers 202', async ({
    request,
    apiKey,
    itemTypeId,
    deps,
  }) => {
    const [action] = await deps.ModerationConfigService.getActions({
      orgId: (await deps.ApiKeyService.validateApiKey(apiKey))!,
      readFromReplica: false,
    });
    const publish = vi
      .spyOn(deps.ActionPublisher, 'publishActions')
      .mockResolvedValue(undefined as never);
    const response = await request
      .post('/api/v1/actions')
      .set('x-api-key', apiKey)
      .send({ actionId: action.id, itemId: 'item-1', itemTypeId, note: 'n' });
    expect(response.status).toBe(202);
    expect(response.headers['content-length']).toBe('0');
    expect(publish).toHaveBeenCalledOnce();
  });
});
