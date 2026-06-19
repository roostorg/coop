import {
  ScalarTypes,
  type Field,
  type FieldType,
  type ItemIdentifier,
} from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type ItemSubmission,
  type SubmissionId,
} from '../itemProcessingService/makeItemSubmission.js';
import { type NormalizedItemData } from '../itemProcessingService/toNormalizedItemDataOrErrors.js';
import { type ContentItemType } from '../moderationConfigService/index.js';
import { getNcmecMessagesFromItemInvestigation } from './ncmecMessagesFromInvestigation.js';

const CONTENT_TYPE_ID = 'content-type';

const schema = [
  { name: 'time', type: ScalarTypes.DATETIME, required: true, container: null },
  {
    name: 'thread',
    type: ScalarTypes.RELATED_ITEM,
    required: false,
    container: null,
  },
] as const satisfies readonly Field<FieldType>[];

function makeSubmission(opts: {
  itemId: string;
  createdAt?: string;
  threadRef?: { id: string; typeId: string };
}): ItemSubmission {
  const itemType: ContentItemType = {
    id: CONTENT_TYPE_ID,
    name: 'Content',
    description: null,
    version: '1',
    schemaVariant: 'original',
    orgId: 'org-1',
    schema,
    kind: 'CONTENT',
    // Only declare the thread/createdAt roles when this submission belongs to a
    // thread; standalone posts carry no thread role.
    schemaFieldRoles: opts.threadRef
      ? { threadId: 'thread', createdAt: 'time' }
      : {},
  };
  const data = instantiateOpaqueType<NormalizedItemData>({
    ...(opts.createdAt ? { time: opts.createdAt } : {}),
    ...(opts.threadRef ? { thread: opts.threadRef } : {}),
  });
  return instantiateOpaqueType<ItemSubmission>({
    submissionId: instantiateOpaqueType<SubmissionId>(`sub-${opts.itemId}`),
    itemId: opts.itemId,
    data,
    itemType,
    creator: undefined,
  });
}

const threadKey = (id: ItemIdentifier) => `${id.id}\u0000${id.typeId}`;

/**
 * Minimal stub of the item-investigation service exposing only the three
 * read methods the function under test calls.
 */
function makeService(opts: {
  byCreator?: ItemSubmission[];
  reported?: Map<string, ItemSubmission>;
  threads?: Map<string, ItemSubmission[]>;
}): Dependencies['ItemInvestigationService'] {
  const { byCreator = [], reported = new Map(), threads = new Map() } = opts;

  async function* iterate(subs: ItemSubmission[]) {
    for (const latestSubmission of subs) {
      yield { latestSubmission };
    }
  }

  const stub = {
    getItemByIdentifier: async ({
      itemIdentifier,
    }: {
      itemIdentifier: ItemIdentifier;
    }) => {
      const sub = reported.get(threadKey(itemIdentifier));
      return sub ? { latestSubmission: sub } : null;
    },
    getItemSubmissionsByCreator: () => iterate(byCreator),
    getThreadSubmissionsByTime: ({ threadId }: { threadId: ItemIdentifier }) =>
      iterate(threads.get(threadKey(threadId)) ?? []),
  };

  return stub as unknown as Dependencies['ItemInvestigationService'];
}

const OPTS = {
  orgId: 'org-1',
  userId: { id: 'suspect', typeId: 'user-type' },
};

describe('getNcmecMessagesFromItemInvestigation', () => {
  it('buckets standalone posts (no thread role) under their own id', async () => {
    const result = await getNcmecMessagesFromItemInvestigation(
      makeService({
        byCreator: [
          makeSubmission({ itemId: 'p1' }),
          makeSubmission({ itemId: 'p2' }),
        ],
      }),
      { ...OPTS, reportedMessages: [] },
    );

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.threadId).sort()).toEqual(['p1', 'p2']);
    result.forEach((t) => expect(t.messages).toHaveLength(1));
  });

  it('groups a thread and expands it to all participants, deduping and sorting by createdAt', async () => {
    const threadRef = { id: 'thread-1', typeId: CONTENT_TYPE_ID };
    const suspectMsg = makeSubmission({
      itemId: 'm1',
      threadRef,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const victimMsg = makeSubmission({
      itemId: 'm2',
      threadRef,
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    const result = await getNcmecMessagesFromItemInvestigation(
      makeService({
        // Only the suspect's message is returned by the creator query, but the
        // thread expansion should pull in the other participant's message too.
        byCreator: [suspectMsg],
        threads: new Map([[threadKey(threadRef), [suspectMsg, victimMsg]]]),
      }),
      { ...OPTS, reportedMessages: [] },
    );

    expect(result).toHaveLength(1);
    expect(result[0].threadId).toBe('thread-1');
    expect(result[0].messages.map((m) => m.message.itemId)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('expands the thread of a reported message even when the suspect has no other items', async () => {
    const threadRef = { id: 'thread-2', typeId: CONTENT_TYPE_ID };
    const reportedMsg = makeSubmission({
      itemId: 'r1',
      threadRef,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const otherMsg = makeSubmission({
      itemId: 'r2',
      threadRef,
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    const result = await getNcmecMessagesFromItemInvestigation(
      makeService({
        reported: new Map([
          [threadKey({ id: 'r1', typeId: CONTENT_TYPE_ID }), reportedMsg],
        ]),
        threads: new Map([[threadKey(threadRef), [reportedMsg, otherMsg]]]),
      }),
      {
        ...OPTS,
        reportedMessages: [{ id: 'r1', typeId: CONTENT_TYPE_ID }],
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].threadId).toBe('thread-2');
    expect(result[0].messages.map((m) => m.message.itemId)).toEqual([
      'r1',
      'r2',
    ]);
  });
});
