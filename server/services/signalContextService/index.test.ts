import { ScalarTypes } from '@roostorg/coop-types';
import { vi } from 'vitest';

import { makeSignalContextLoaderFactory } from './index.js';

const orgId = 'org-1';

function field(
  name: string,
  type: string,
  container: null | {
    containerType: string;
    keyScalarType: string | null;
    valueScalarType: string;
  } = null,
) {
  return { name, type, container, required: false };
}

function submission(
  itemId: string,
  kind: 'CONTENT' | 'THREAD' | 'USER' = 'CONTENT',
  schema = [field('text', ScalarTypes.STRING)],
  data: Record<string, unknown> = { text: itemId },
  roles: Record<string, string> = {},
) {
  return {
    submissionId: `submission-${itemId}`,
    itemId,
    data,
    creator: kind === 'USER' ? undefined : { id: 'user-1', typeId: 'user' },
    itemType: {
      id: `${kind.toLowerCase()}-type`,
      name: `${kind} item`,
      kind,
      schema,
      schemaFieldRoles: roles,
      description: null,
      version: '1',
      schemaVariant: 'original',
      orgId,
    },
  } as any;
}

function factory(
  getItemByIdentifier = vi.fn(),
  getThreadSubmissionsByTime = vi.fn(),
  options?: { sectionTimeoutMs?: number },
) {
  return makeSignalContextLoaderFactory(
    { getItemByIdentifier, getThreadSubmissionsByTime },
    options,
  );
}

function fullInput(item: ReturnType<typeof submission>) {
  return item;
}

describe('SignalContextLoader', () => {
  test('loads CONTENT thread oldest-first, excludes current, and keeps recent messages', async () => {
    const current = submission(
      'current',
      'CONTENT',
      [
        field('thread', ScalarTypes.RELATED_ITEM),
        field('text', ScalarTypes.STRING),
      ],
      { thread: { id: 'thread-1', typeId: 'thread-type' }, text: 'current' },
      { threadId: 'thread' },
    );
    const messages = ['old', 'middle', 'current', 'new'].map((id) =>
      submission(id),
    );
    const getThread = vi.fn(async function* () {
      for (const item of [...messages].reverse())
        yield { latestSubmission: item };
    });
    const loader = factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(current),
    });

    const context = await loader.load({
      includeThread: true,
      maxThreadMessages: 2,
    });

    expect(context.thread?.id).toBe('thread-1');
    expect(context.thread?.messages.map((it) => it.itemId)).toEqual([
      'middle',
      'new',
    ]);
    expect(context.thread?.truncated).toBe(true);
    expect(getThread).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: { id: 'thread-1', typeId: 'thread-type' },
      }),
    );
  });

  test('ends the thread at the item and fetches only the requested count', async () => {
    const postedAt = '2026-01-02T03:04:05.000Z';
    const current = submission(
      'current',
      'CONTENT',
      [
        field('thread', ScalarTypes.RELATED_ITEM),
        field('postedAt', ScalarTypes.DATETIME),
      ],
      { thread: { id: 'thread-1', typeId: 'thread-type' }, postedAt },
      { threadId: 'thread', createdAt: 'postedAt' },
    );
    const getThread = vi.fn(async function* () {
      yield* [];
    });
    await factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(current),
    }).load({ includeThread: true, maxThreadMessages: 5 });

    expect(getThread).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 7,
        newestReturnedSubmissionDate: new Date(postedAt),
      }),
    );
  });

  test('leaves user items out of the thread', async () => {
    const current = submission('current', 'THREAD');
    const getThread = vi.fn(async function* () {
      yield { latestSubmission: submission('someone', 'USER') };
      yield { latestSubmission: submission('m1') };
    });
    const context = await factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(current),
    }).load({ includeThread: true });

    expect(context.thread?.messages.map((it) => it.itemId)).toEqual(['m1']);
  });

  test('detects truncation when the item is in the fetched page', async () => {
    const current = submission('current', 'THREAD');
    // Newest first, as storage returns them; the mock honours `limit`.
    const page = [
      submission('m3'),
      current,
      submission('m2'),
      submission('m1'),
    ];
    const getThread = vi.fn(async function* ({ limit }: { limit: number }) {
      yield* page.slice(0, limit).map((latestSubmission) => ({
        latestSubmission,
      }));
    });
    const context = await factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(current),
    }).load({ includeThread: true, maxThreadMessages: 2 });

    expect(context.thread?.messages.map((it) => it.itemId)).toEqual([
      'm2',
      'm3',
    ]);
    expect(context.thread?.truncated).toBe(true);
  });

  test('uses a THREAD item as its own thread', async () => {
    const item = submission('thread-1', 'THREAD');
    const getThread = vi.fn(async function* () {
      yield { latestSubmission: submission('message-1') };
    });
    const context = await factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(item),
    }).load({ includeThread: true });

    expect(getThread).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: { id: 'thread-1', typeId: 'thread-type' },
      }),
    );
    expect(context.thread?.messages[0].itemId).toBe('message-1');
  });

  test('loads parent and reports a missing parent', async () => {
    const item = submission(
      'child',
      'CONTENT',
      [field('parent', ScalarTypes.RELATED_ITEM)],
      { parent: { id: 'parent', typeId: 'content-type' } },
      { parentId: 'parent' },
    );
    const getItem = vi.fn(async () => null);
    const context = await factory(getItem)({
      orgId,
      ruleInput: fullInput(item),
    }).load({ includeParent: true });

    expect(context.parent).toBeUndefined();
    expect(context.unavailable).toContain('parent');
  });

  test('aborts the parent lookup when it times out', async () => {
    const item = submission(
      'child',
      'CONTENT',
      [field('parent', ScalarTypes.RELATED_ITEM)],
      { parent: { id: 'parent', typeId: 'content-type' } },
      { parentId: 'parent' },
    );
    let lookupSignal: AbortSignal | undefined;
    const getItem = vi.fn(async (opts: { signal?: AbortSignal }) => {
      lookupSignal = opts.signal;
      return new Promise<never>(() => undefined);
    });
    const context = await factory(getItem, vi.fn(), { sectionTimeoutMs: 10 })({
      orgId,
      ruleInput: fullInput(item),
    }).load({ includeParent: true });

    expect(context.unavailable).toContain('parent');
    expect(lookupSignal?.aborted).toBe(true);
  });

  test('omits parent and thread without marking them unavailable when the item has no reference', async () => {
    const item = submission(
      'standalone',
      'CONTENT',
      [
        field('parent', ScalarTypes.RELATED_ITEM),
        field('thread', ScalarTypes.RELATED_ITEM),
        field('createdAt', ScalarTypes.DATETIME),
      ],
      { createdAt: '2026-01-01T00:00:00.000Z' },
      { parentId: 'parent', threadId: 'thread', createdAt: 'createdAt' },
    );
    const getItem = vi.fn();
    const getThread = vi.fn();
    const context = await factory(
      getItem,
      getThread,
    )({
      orgId,
      ruleInput: fullInput(item),
    }).load({ includeParent: true, includeThread: true });

    expect(context.parent).toBeUndefined();
    expect(context.thread).toBeUndefined();
    expect(context.unavailable).toBeUndefined();
    expect(getItem).not.toHaveBeenCalled();
    expect(getThread).not.toHaveBeenCalled();
  });

  test('USER items are attached by identity only', async () => {
    const user = submission('user-1', 'USER');
    const getItem = vi.fn(async () => ({ latestSubmission: user }));
    const factoryInstance = factory(getItem);
    const userContext = await factoryInstance({
      orgId,
      ruleInput: fullInput(user),
    }).load({
      includeFullItem: true,
      includeParent: true,
      includeThread: true,
    });
    expect(userContext.item).toEqual({
      itemId: 'user-1',
      itemTypeId: 'user-type',
      itemTypeName: 'USER item',
      itemTypeKind: 'USER',
      data: {},
    });
    expect(userContext.parent).toBeUndefined();
    expect(userContext.thread).toBeUndefined();

    const identifier = {
      itemId: 'user-1',
      itemType: { id: 'user-type', kind: 'USER', name: 'User' },
    } as any;
    const identifierContext = await factoryInstance({
      orgId,
      ruleInput: identifier,
    }).load({ includeFullItem: true });
    expect(identifierContext.item?.data).toEqual({});
    expect(identifierContext.item?.creator).toBeUndefined();

    const leanContext = await factoryInstance({
      orgId,
      ruleInput: identifier,
    }).load({});
    expect(leanContext.item).toMatchObject({
      itemId: 'user-1',
      itemTypeId: 'user-type',
      data: {},
    });
  });

  test('section timeout resolves with unavailable', async () => {
    const item = submission('thread-1', 'THREAD');
    const getThread = vi.fn(async function* () {
      yield* [];
      await new Promise<never>(() => undefined);
    });
    const loader = factory(vi.fn(), getThread, { sectionTimeoutMs: 10 })({
      orgId,
      ruleInput: fullInput(item),
    });

    const result = loader.load({ includeThread: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(result).resolves.toMatchObject({
      unavailable: ['thread'],
    });
  });

  test('does not trim large threads by size; plugins apply their own limits', async () => {
    const item = submission(
      'current',
      'CONTENT',
      [field('thread', ScalarTypes.RELATED_ITEM)],
      { thread: { id: 'thread-1', typeId: 'thread-type' } },
      { threadId: 'thread' },
    );
    const messages = ['one', 'two', 'three'].map((id) =>
      submission(id, 'CONTENT', [field('body', ScalarTypes.STRING)], {
        body: 'x'.repeat(150_000),
      }),
    );
    const getThread = vi.fn(async function* () {
      for (const message of [...messages].reverse())
        yield { latestSubmission: message };
    });
    const context = await factory(
      vi.fn(),
      getThread,
    )({
      orgId,
      ruleInput: fullInput(item),
    }).load({ includeThread: true });

    expect(context.thread?.messages.map((it) => it.itemId)).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(context.thread?.truncated).toBe(false);
  });

  test('memoizes equivalent needs and shares underlying item loads', async () => {
    const parent = { id: 'parent', typeId: 'content-type' };
    const item = submission(
      'child',
      'CONTENT',
      [field('parent', ScalarTypes.RELATED_ITEM)],
      { parent },
      { parentId: 'parent' },
    );
    const getItem = vi.fn(async () => ({
      latestSubmission: submission('parent'),
    }));
    const loader = factory(getItem)({ orgId, ruleInput: fullInput(item) });

    await Promise.all([
      loader.load({ includeParent: true }),
      loader.load({ includeParent: true }),
      loader.load({ includeParent: true, includeThread: true }),
    ]);

    expect(getItem).toHaveBeenCalledTimes(1);
  });
});
