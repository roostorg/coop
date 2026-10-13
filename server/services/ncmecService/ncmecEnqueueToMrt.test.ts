import { vi, type Mock } from 'vitest';

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

type ExistingReportCheck = (params: {
  orgId: string;
  userId: string;
  userItemTypeId: string;
}) => Promise<boolean>;

function makeEnqueue(
  enqueueSpy: Mock,
  existingReportCheck: ExistingReportCheck = async () => false,
  getPartialItems: Mock = vi.fn(async () => [fullUserSubmission]),
  getItemType: Mock = vi.fn(
    async ({ itemTypeSelector }: { itemTypeSelector: { id: string } }) =>
      itemTypeSelector.id === 'msg-type' ? messageType : userType,
  ),
): NcmecEnqueueToMrt {
  return new NcmecEnqueueToMrt(
    {
      getPartialItems,
    } as unknown as never,
    { getItemType } as unknown as never,
    { enqueue: enqueueSpy } as unknown as never,
    {
      getItemSubmissionsByCreator: () => emptyAsyncIterable(),
    } as unknown as never,
    (async () => ({ status: 200 })) as unknown as never,
    { sign: () => undefined } as unknown as never,
    {
      getUserHasExistingNcmeReport: existingReportCheck,
    } as unknown as NcmecReporting,
  );
}

function enqueuedPayload(enqueueSpy: Mock): Record<string, unknown> {
  expect(enqueueSpy).toHaveBeenCalledTimes(1);
  const [input] = enqueueSpy.mock.calls[0] as unknown as [
    { payload: Record<string, unknown> },
  ];
  return input.payload;
}

describe('NcmecEnqueueToMrt reportedMessages in the job payload', () => {
  it('records the reported content item as a reported message', async () => {
    const enqueueSpy = vi.fn(async () => undefined);
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
    const enqueueSpy = vi.fn(async () => undefined);
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

describe('NcmecEnqueueToMrt existing-report checks', () => {
  it('checks the resolved creator when the reported item is Content', async () => {
    const enqueueSpy = vi.fn(async () => undefined);
    const existingReportCheck = vi.fn(async () => true);
    const getPartialItems = vi.fn(async () => [fullUserSubmission]);

    const result = await makeEnqueue(
      enqueueSpy,
      existingReportCheck,
      getPartialItems,
    ).enqueueForHumanReviewIfApplicable({
      orgId: 'org-1',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      item: messageItem,
      correlationId: 'corr-1' as unknown as never,
      enqueueSource: 'REPORT',
      enqueueSourceInfo: { kind: 'REPORT' },
    });

    expect(existingReportCheck).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      userItemTypeId: 'user-type',
    });
    expect(result).toEqual({ status: 'SKIPPED' });
    expect(getPartialItems).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('reuses the validated MRT target without repeating item-type lookups', async () => {
    const enqueueSpy = vi.fn(async () => undefined);
    const existingReportCheck = vi.fn(async () => false);
    const getPartialItems = vi.fn(async () => [fullUserSubmission]);
    const getItemType = vi.fn(async () => {
      throw new Error('item types changed after decision validation');
    });

    const result = await makeEnqueue(
      enqueueSpy,
      existingReportCheck,
      getPartialItems,
      getItemType,
    ).enqueueForHumanReviewIfApplicable({
      orgId: 'org-1',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      item: messageItem,
      correlationId: 'corr-1' as unknown as never,
      enqueueSource: 'MRT_JOB',
      enqueueSourceInfo: { kind: 'MRT_JOB' },
      reenqueuedFrom: { jobId: 'original-job' as unknown as never },
      validatedNcmecTarget: {
        reportedItemType: messageType,
        targetUser: {
          success: true,
          userIdentifier: { id: 'user-1', typeId: 'user-type' },
          userItemType: userType as ItemType & { kind: 'USER' },
        },
      },
    });

    expect(result).toEqual({ status: 'ENQUEUED' });
    expect(getItemType).not.toHaveBeenCalled();
    expect(existingReportCheck).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      userItemTypeId: 'user-type',
    });
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });
});
