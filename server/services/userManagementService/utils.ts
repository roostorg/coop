import { promisify } from 'util';
import {
  Algorithm,
  hash as argon2Hash,
  verify as argon2Verify,
} from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

// OWASP's Password Storage Cheat Sheet recommends Argon2id with a minimum of
// 19 MiB of memory, 2 iterations, and 1 degree of parallelism.
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // KiB — 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

// The only Argon2 version in use; 0x13 (19) is what every current
// implementation emits, and what the `$v=19$` in our hashes means.
const ARGON2_VERSION = 19;

// Parameters of an Argon2id hash, as encoded in its PHC string:
// `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<digest>`. Deliberately anchored to
// `argon2id` — an `argon2i`/`argon2d` hash should be re-minted, not accepted.
const ARGON2ID_PARAMS =
  /^\$argon2id\$v=(?<version>\d+)\$m=(?<memoryCost>\d+),t=(?<timeCost>\d+),p=(?<parallelism>\d+)\$/;

export async function hashPassword(rawPassword: string) {
  return argon2Hash(rawPassword, ARGON2_OPTIONS);
}

// Passwords predating the Argon2id migration are bcrypt, and stay verifiable
// forever: an account that never logs in again is never re-hashed, so this
// branch can't be retired on any timeline. Dispatch is on the hash prefix
// rather than a try/catch, because `argon2Verify` *throws* on a bcrypt hash
// instead of returning false.
const bcryptCompare = promisify(bcrypt.compare);

// Throws if the hash cannot be evaluated at all — `argon2Verify` rejects a
// malformed digest rather than returning false. That is deliberately *not*
// swallowed here: this module has no tracer, and silently returning false
// would make an operational failure of Argon2 (e.g. the 19 MiB allocation
// failing under memory pressure, which affects every login) indistinguishable
// from a user mistyping their password. The caller has a tracer, logs the
// exception, and decides how to fail — see `verifyEmailPasswordCredentials`.
export async function passwordMatchesHash(
  givenPassword: string,
  hash: string,
): Promise<boolean> {
  if (!hash.startsWith('$argon2')) {
    return bcryptCompare(givenPassword, hash);
  }
  return argon2Verify(hash, givenPassword);
}

// Called only after `passwordMatchesHash` has already returned true, so the
// hash is known-parseable here — but this fails safe (toward re-hashing) for
// anything it can't read, since a fresh Argon2id hash is never the wrong
// answer for a password we just verified.
//
// Any deviation from the current parameters counts, not just a weaker one, so
// that every hash converges on exactly one configuration rather than leaving a
// tail of stronger-but-different hashes around forever. This mirrors
// `needsRehash` in the reference `argon2` package, which compares v/m/t/p for
// strict equality:
// https://github.com/ranisalt/node-argon2/blob/60e11ef/argon2.cjs#L134-L161
// — with one addition: it does not check the algorithm variant, so an argon2i
// hash with matching parameters slips past it. The `argon2id` anchor in
// `ARGON2ID_PARAMS` is what closes that gap here.
export function passwordNeedsRehash(hash: string): boolean {
  const params = ARGON2ID_PARAMS.exec(hash)?.groups;
  if (params == null) {
    // bcrypt at any cost factor, a non-argon2id variant, or an unreadable hash.
    return true;
  }
  return (
    Number(params.version) !== ARGON2_VERSION ||
    Number(params.memoryCost) !== ARGON2_OPTIONS.memoryCost ||
    Number(params.timeCost) !== ARGON2_OPTIONS.timeCost ||
    Number(params.parallelism) !== ARGON2_OPTIONS.parallelism
  );
}
