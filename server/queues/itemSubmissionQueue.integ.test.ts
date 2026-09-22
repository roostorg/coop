import { Queue } from 'bullmq';
import { uid } from 'uid';

import getBottle, {
  type Dependencies,
  type ItemSubmissionMessageValue,
} from '../iocContainer/index.js';
import { type NormalizedItemData } from '../services/itemProcessingService/index.js';
import { toCorrelationId } from '../utils/correlationIds.js';
import { jsonStringify } from '../utils/encoding.js';
import { sleep } from '../utils/misc.js';
import { instantiateOpaqueType } from '../utils/typescript-types.js';
import {
  makeItemSubmissionBulkWrite,
  type ItemSubmissionBulkWrite,
} from './itemSubmissionQueue.js';

describe('item submission queue shutdown', () => {
  let redis: Dependencies['IORedis'];
  let queue: Queue<ItemSubmissionMessageValue>;
  let write: ItemSubmissionBulkWrite;
  let closing: Promise<void> | undefined;

  beforeEach(async () => {
    redis = (await getBottle()).container.IORedis;
    await redis.ping();
    const name = `test-item-submission-${uid()}`;
    queue = new Queue(name, { connection: redis });
    write = makeItemSubmissionBulkWrite(redis, name);
    closing = undefined;
  });

  afterEach(async () => {
    await (closing ?? write.close());
    await queue.obliterate({ force: true });
    await queue.close();
    await redis.quit();
  });

  test.each([false, true])(
    'does not wait for a batch when there are no items (empty write: %s)',
    async (emptyWrite) => {
      if (emptyWrite) {
        await write([]);
      }
      closing = write.close();
      // The old unconditional 1.5-second drain delay must not run for an
      // unused writer. Allow ample time for closing the local Redis queue.
      await expect(
        Promise.race([
          closing.then(() => 'closed'),
          sleep(750).then(() => 'still waiting'),
        ]),
      ).resolves.toBe('closed');
    },
  );

  test('drains a scheduled batch even if followed by an empty write', async () => {
    const message: ItemSubmissionMessageValue = {
      metadata: {
        syntheticThreadId: 'thread-1',
        requestId: toCorrelationId({ type: 'post-items', id: 'request-1' }),
        orgId: 'org-1',
      },
      itemSubmissionWithTypeIdentifier: {
        submissionId: 'submission-1',
        submissionTime: new Date('2026-01-01T00:00:00Z'),
        itemId: 'item-1',
        dataJSON: jsonStringify(
          instantiateOpaqueType<NormalizedItemData>({ text: 'test' }),
        ),
        itemTypeIdentifier: {
          id: 'type-1',
          version: 'version-1',
          schemaVariant: 'original',
        },
      },
    };
    const pendingWrite = write([message]);
    await write([]);
    closing = write.close();
    await closing;

    await expect(pendingWrite).resolves.toEqual({ error: false, results: [] });
    const jobs = await queue.getWaiting();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toEqual({
      ...message,
      itemSubmissionWithTypeIdentifier: {
        ...message.itemSubmissionWithTypeIdentifier,
        submissionTime: '2026-01-01T00:00:00.000Z',
      },
    });
  });
});
