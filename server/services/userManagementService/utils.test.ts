import {
  hashPassword,
  passwordMatchesHash,
  passwordNeedsRehash,
} from './utils.js';

describe('hashPassword', () => {
  it('produces a bcrypt hash with work factor 12', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('round-trips with passwordMatchesHash and rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(
      passwordMatchesHash('correct horse battery staple', hash),
    ).resolves.toBe(true);
    await expect(passwordMatchesHash('tr0ub4dor&3', hash)).resolves.toBe(false);
  });

  it('still verifies legacy work-factor-5 hashes', async () => {
    // Hash of 'legacy-password' minted at the previous factor; guards the
    // upgrade path — existing rows must keep working until rehash-on-login.
    const legacyHash =
      '$2a$05$3X5WTL5K1.OfLy6mNBFxt.r6gyBSM25Ph609E.YYSKp9DltrxzJ32';
    await expect(
      passwordMatchesHash('legacy-password', legacyHash),
    ).resolves.toBe(true);
    await expect(
      passwordMatchesHash('wrong-password', legacyHash),
    ).resolves.toBe(false);
  });
});

describe('passwordNeedsRehash', () => {
  it('flags a legacy work-factor-5 hash', () => {
    const legacyHash =
      '$2a$05$3X5WTL5K1.OfLy6mNBFxt.r6gyBSM25Ph609E.YYSKp9DltrxzJ32';
    expect(passwordNeedsRehash(legacyHash)).toBe(true);
  });

  it('does not flag a hash already at the target work factor', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it('does not flag a hash above the target work factor', () => {
    // $2b$14$... — a higher cost than today's target of 12.
    const strongerHash =
      '$2b$14$3X5WTL5K1.OfLy6mNBFxt.r6gyBSM25Ph609E.YYSKp9DltrxzJ32';
    expect(passwordNeedsRehash(strongerHash)).toBe(false);
  });

  it('does not flag an unparseable/non-bcrypt string', () => {
    expect(passwordNeedsRehash('not-a-bcrypt-hash')).toBe(false);
  });
});
