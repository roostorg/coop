import { type ItemSubmission } from '../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ItemType } from '../moderationConfigService/types/itemTypes.js';
import NcmecEnqueueToMrt from './ncmecEnqueueToMrt.js';
import type NcmecReporting from './ncmecReporting.js';

const userType = {
  id: 'user-type',
  name: 'User',
  kind: 'USER',
  schema: [
    { name: 'name', type: 'STRING', required: false, container: null },
    { name: 'avatar', type: 'IMAGE', required: false, container: null },
  ],
  schemaFieldRoles: {},
  version: '1',
  schemaVariant: 'original',
} as unknown as ItemType;

const messageType = {
  id: 'msg-type',
  name: 'Message',
  kind: 'CONTENT',
  schema: [
    { name: 'text', type: 'STRING', required: false, container: null },
    { name: 'attachment', type: 'IMAGE', required: false, container: null },
    { name: 'creator', type: 'RELATED_ITEM', required: false, container: null },
  ],
  schemaFieldRoles: { creatorId: 'creator' },
  version: '1',
  schemaVariant: 'original',
} as unknown as ItemType;

const userItem = {
  itemId: 'user-1',
  itemTypeIdentifier: {
    id: 'user-type',
    version: '1',
    schemaVariant: 'original',
  },
  data: { name: 'Suspect', avatar: 'https://example.com/a.png' },
  submissionId: 'sub-user',
  submissionTime: new Date('2026-01-01T00:00:00Z'),
} as unknown as ItemSubmissionWithTypeIdentifier;

const messageItem = {
  itemId: 'msg-1',
  itemTypeIdentifier: {
    id: 'msg-type',
    version: '1',
    schemaVariant: 'original',
  },
  data: {
    text: 'hello',
    attachment: 'https://example.com/img.png',
    creator: { id: 'user-1', typeId: 'user-type' },
  },
  submissionId: 'sub-msg',
  submissionTime: new Date('2026-01-01T00:00:00Z'),
} as unknown as ItemSubmissionWithTypeIdentifier;

const fullUserSubmission = {
  itemId: 'user-1',
  itemType: userType,
  data: { name: 'Suspect', avatar: 'https://example.com/a.png' },
  submissionId: 'sub-user',
  submissionTime: new Date('2026-01-01T00:00:00Z'),
  creator: undefined,
} as unknown as ItemSubmission;

async function* emptyAsyncIterable(): AsyncGenerator<never> {}

function makeEnqueue(enqueueSpy: jest.Mock): NcmecEnqueueToMrt {
  return new NcmecEnqueueToMrt(
    {
      getPartialItems: async () => [fullUserSubmission],
    } as unknown as never,
    {
      getItemType: async ({
        itemTypeSelector,
      }: {
        itemTypeSelector: { id: string };
      }) => (itemTypeSelector.id === 'msg-type' ? messageType : userType),
    } as unknown as never,
    { enqueue: enqueueSpy } as unknown as never,
    {
      getItemSubmissionsByCreator: () => emptyAsyncIterable(),
    } as unknown as never,
    (async () => ({ status: 200 })) as unknown as never,
    { sign: () => undefined } as unknown as never,
    {
      getUserHasExistingNcmeReport: async () => false,
    } as unknown as NcmecReporting,
  );
}

function enqueuedPayload(enqueueSpy: jest.Mock): Record<string, unknown> {
  expect(enqueueSpy).toHaveBeenCalledTimes(1);
  const [input] = enqueueSpy.mock.calls[0] as unknown as [
    { payload: Record<string, unknown> },
  ];
  return input.payload;
}

describe('NcmecEnqueueToMrt reportedMessages in the job payload', () => {
  it('records the reported content item as a reported message', async () => {
    const enqueueSpy = jest.fn(async () => undefined);
    const result = await makeEnqueue(
      enqueueSpy,
    ).enqueueForHumanReviewIfApplicable({
      orgId: 'org-1',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      item: messageItem,
      correlationId: 'corr-1' as unknown as never,
      enqueueSource: 'REPORT',
      enqueueSourceInfo: { kind: 'REPORT' },
    });

    expect(result).toEqual({ status: 'ENQUEUED' });
    const payload = enqueuedPayload(enqueueSpy);
    expect(payload.kind).toBe('NCMEC');
    expect(payload.reportedMessages).toEqual([
      { id: 'msg-1', typeId: 'msg-type' },
    ]);
  });

  it('omits reportedMessages when the reported item is the user themself', async () => {
    const enqueueSpy = jest.fn(async () => undefined);
    const result = await makeEnqueue(
      enqueueSpy,
    ).enqueueForHumanReviewIfApplicable({
      orgId: 'org-1',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      item: userItem,
      correlationId: 'corr-1' as unknown as never,
      enqueueSource: 'REPORT',
      enqueueSourceInfo: { kind: 'REPORT' },
    });

    expect(result).toEqual({ status: 'ENQUEUED' });
    const payload = enqueuedPayload(enqueueSpy);
    expect(payload.kind).toBe('NCMEC');
    expect(payload).not.toHaveProperty('reportedMessages');
  });
});
