import {
  hashPassword,
  passwordMatchesHash,
  passwordNeedsRehash,
} from './utils.js';

// Hash of 'legacy-password' minted at bcrypt cost 5 — a genuine sample of what
// production rows look like before the Argon2id migration.
const LEGACY_BCRYPT_HASH =
  '$2a$05$3X5WTL5K1.OfLy6mNBFxt.r6gyBSM25Ph609E.YYSKp9DltrxzJ32';

// Just needs to look like a cost-12 bcrypt hash, not be a genuine one:
// `passwordNeedsRehash` never parses the cost out of a bcrypt string (see
// below), so there's no reason to pay for an actual cost-12 bcryptjs hash —
// pure-JS, so noticeably slow — just to prove "regardless of cost factor".
const STRONG_BCRYPT_HASH_SHAPE =
  '$2a$12$3X5WTL5K1.OfLy6mNBFxt.r6gyBSM25Ph609E.YYSKp9DltrxzJ32';

const PASSWORD = 'correct horse battery staple';

describe('hashPassword', () => {
  it('produces an Argon2id hash at the OWASP-recommended parameters', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('round-trips with passwordMatchesHash and rejects a wrong password', async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(passwordMatchesHash(PASSWORD, hash)).resolves.toBe(true);
    await expect(passwordMatchesHash('tr0ub4dor&3', hash)).resolves.toBe(false);
  });

  it('salts each hash, so the same password never hashes identically twice', async () => {
    await expect(hashPassword(PASSWORD)).resolves.not.toBe(
      await hashPassword(PASSWORD),
    );
  });
});

describe('passwordMatchesHash', () => {
  it('still verifies legacy bcrypt hashes', async () => {
    // The bcrypt branch can never be retired: an account that never logs in
    // again is never re-hashed, so its bcrypt hash lives forever.
    await expect(
      passwordMatchesHash('legacy-password', LEGACY_BCRYPT_HASH),
    ).resolves.toBe(true);
    await expect(
      passwordMatchesHash('wrong-password', LEGACY_BCRYPT_HASH),
    ).resolves.toBe(false);
  });

  it('propagates the error when argon2 cannot evaluate the stored hash', async () => {
    // `argon2Verify` isn't uniform on corrupt input: a bad base64 salt throws,
    // while a truncated digest quietly resolves `false`. Our code doesn't
    // choose either behavior — `passwordMatchesHash` calls straight through
    // to the library — so both shapes are pinned here to catch a future
    // `@node-rs/argon2` upgrade silently changing which one happens.
    //
    // The throw is deliberately not swallowed: this module has no tracer, and
    // a silent `false` would make an operational Argon2 failure (the 19 MiB
    // allocation failing under memory pressure takes down *every* login) look
    // identical to one user mistyping their password. The login path lets it
    // propagate to its outer catch-all, which logs it and surfaces a generic
    // error — see `userApiCredentials.test.ts`.
    await expect(
      passwordMatchesHash(PASSWORD, '$argon2id$v=19$m=19456,t=2,p=1$!!!!$!!!!'),
    ).rejects.toThrow();

    await expect(
      passwordMatchesHash(PASSWORD, '$argon2id$v=19$corrupt'),
    ).resolves.toBe(false);
  });
});

describe('passwordNeedsRehash', () => {
  it('flags any bcrypt hash, regardless of cost factor', () => {
    // Cost is no longer the question — bcrypt itself is. Both a weak legacy
    // hash and one at a strong cost factor are upgraded to Argon2id on login.
    expect(passwordNeedsRehash(LEGACY_BCRYPT_HASH)).toBe(true);
    expect(passwordNeedsRehash(STRONG_BCRYPT_HASH_SHAPE)).toBe(true);
  });

  it('does not flag a hash already at the target parameters', async () => {
    expect(passwordNeedsRehash(await hashPassword(PASSWORD))).toBe(false);
  });

  it('flags an Argon2id hash whose parameters differ from the target', () => {
    // Any deviation counts, not just a weaker one — hashes must converge on a
    // single configuration rather than leaving a tail of odd ones behind.
    const differing = [
      '$argon2id$v=19$m=9216,t=2,p=1$c2FsdHNhbHQ$aGFzaA', // weaker memory
      '$argon2id$v=19$m=19456,t=1,p=1$c2FsdHNhbHQ$aGFzaA', // weaker iterations
      '$argon2id$v=19$m=65536,t=4,p=1$c2FsdHNhbHQ$aGFzaA', // stronger
      '$argon2id$v=19$m=19456,t=2,p=4$c2FsdHNhbHQ$aGFzaA', // parallelism drift
      '$argon2id$v=16$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA', // older argon2 version
    ];
    for (const hash of differing) {
      expect(passwordNeedsRehash(hash)).toBe(true);
    }
  });

  it('flags a non-Argon2id variant of argon2', () => {
    // argon2i and argon2d are weaker choices for password storage than
    // argon2id; accepting them as current would strand a user on one.
    expect(
      passwordNeedsRehash('$argon2i$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA'),
    ).toBe(true);
  });

  it('flags an unparseable hash', () => {
    // Unreachable in practice — this is only called after a successful verify
    // — but re-hashing is the safe direction for anything we can't read.
    expect(passwordNeedsRehash('not-a-hash')).toBe(true);
  });
});
