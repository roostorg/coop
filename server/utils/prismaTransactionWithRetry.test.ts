import { Prisma, type PrismaPgClient } from '../storage/prisma/index.js';
import {
  isSerializationFailure,
  makePrismaTransactionWithRetry,
} from './prismaTransactionWithRetry.js';

function writeConflict(originalCode: string) {
  return new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034',
    clientVersion: 'test',
    meta: {
      driverAdapterError: { cause: { originalCode, kind: 'postgres' } },
    },
  });
}

/** What adapter-pg throws when COMMIT itself fails. */
function commitTimeError(originalCode: string) {
  return Object.assign(new Error('commit failed'), {
    name: 'DriverAdapterError',
    cause: { originalCode, kind: 'TransactionWriteConflict' },
  });
}

describe('isSerializationFailure', () => {
  it('matches 40001 wrapped as P2034, raised at COMMIT, or raw from pg', () => {
    expect(isSerializationFailure(writeConflict('40001'))).toBe(true);
    expect(isSerializationFailure(commitTimeError('40001'))).toBe(true);
    expect(isSerializationFailure({ code: '40001' })).toBe(true);
  });

  it('does not match deadlocks or other errors', () => {
    expect(isSerializationFailure(writeConflict('40P01'))).toBe(false);
    expect(isSerializationFailure(commitTimeError('40P01'))).toBe(false);
    expect(isSerializationFailure(new Error('boom'))).toBe(false);
  });
});

describe('makePrismaTransactionWithRetry', () => {
  it('retries serialization failures up to three attempts, including COMMIT-time ones', async () => {
    const $transaction = vi
      .fn()
      .mockRejectedValueOnce(writeConflict('40001'))
      .mockRejectedValueOnce(commitTimeError('40001'))
      .mockResolvedValueOnce('ok');
    const transactionWithRetry = makePrismaTransactionWithRetry({
      $transaction,
    } as unknown as PrismaPgClient);

    await expect(transactionWithRetry(async () => 'ok')).resolves.toBe('ok');
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry deadlocks', async () => {
    const $transaction = vi.fn().mockRejectedValue(writeConflict('40P01'));
    const transactionWithRetry = makePrismaTransactionWithRetry({
      $transaction,
    } as unknown as PrismaPgClient);

    await expect(transactionWithRetry(async () => 'ok')).rejects.toThrow(
      'write conflict',
    );
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
