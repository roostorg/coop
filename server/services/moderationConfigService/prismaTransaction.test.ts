import {
  markPrismaTransaction,
  type PrismaPgClient,
  type PrismaPgTransaction,
} from '../../storage/prisma/index.js';
import { runInPrismaTransaction } from './prismaTransaction.js';

describe('runInPrismaTransaction', () => {
  const tx = markPrismaTransaction({}) as PrismaPgTransaction;

  it("joins the caller's transaction", async () => {
    await expect(
      runInPrismaTransaction(tx, {}, async (inner) => inner === tx),
    ).resolves.toBe(true);
  });

  it('refuses an isolation level inside a joined transaction', async () => {
    await expect(
      runInPrismaTransaction(
        tx,
        { isolationLevel: 'Serializable' },
        async () => 'ran',
      ),
    ).rejects.toThrow(
      "Cannot run at Serializable inside the caller's transaction",
    );
  });

  it('opens a new transaction at the requested level on the root client', async () => {
    const $transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn({}));
    const root = { $transaction } as unknown as PrismaPgClient;
    await runInPrismaTransaction(
      root,
      { isolationLevel: 'Serializable' },
      async () => 'ran',
    );
    expect($transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });
});
