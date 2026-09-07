import { type Kysely } from 'kysely';

import { type ManualReviewToolServicePg } from '../dbTypes.js';
import { type JobId } from '../manualReviewToolService.js';
import ClaimOperations from './ClaimOperations.js';

it('cancels a stalled claim insert and propagates the timeout to the caller', async () => {
  const executeTakeFirst = jest.fn(
    async (opts: { signal: AbortSignal; inflightQueryAbortStrategy: string }) =>
      new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
      }),
  );
  const db = {
    insertInto: () => ({ values: () => ({ executeTakeFirst }) }),
  } as unknown as Kysely<ManualReviewToolServicePg>;
  const claims = new ClaimOperations(db);

  await expect(
    claims.logClaim({
      orgId: 'org',
      queueId: 'queue',
      userId: 'user',
      jobId: 'job' as JobId,
    }),
  ).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(executeTakeFirst).toHaveBeenCalledWith({
    signal: expect.any(AbortSignal),
    inflightQueryAbortStrategy: 'cancel query',
  });
});
