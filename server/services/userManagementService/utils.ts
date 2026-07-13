import { promisify } from 'util';
import bcrypt from 'bcryptjs';

// Work factor 12 per OWASP minimum-10 guidance. Hashes created at the old
// factor (5) remain verifiable — bcrypt embeds the factor in the hash — and
// are upgraded opportunistically by `passwordNeedsRehash` + the
// rehash-on-login hook in `userApiCredentials.ts`.
const TARGET_BCRYPT_COST = 12;

export async function hashPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, TARGET_BCRYPT_COST);
}

// Matches the bcrypt.compare semantics used by the now-removed Sequelize
// `User.passwordMatchesHash` static; kept here so `UserApi.changePassword` and
// the Passport local strategy share a single implementation.
const bcryptCompare = promisify(bcrypt.compare);

export async function passwordMatchesHash(
  givenPassword: string,
  hash: string,
): Promise<boolean> {
  return bcryptCompare(givenPassword, hash);
}

// bcrypt hashes embed their cost factor (`$2a$<cost>$...`); a hash minted at
// a lower cost than today's target still verifies correctly (bcrypt reads
// the embedded factor, not a global one) but is weaker than we'd hash a new
// password at. `bcrypt.getRounds` on a non-bcrypt string returns `NaN`, and
// `NaN < TARGET_BCRYPT_COST` is always `false` — so unparseable hashes
// safely fall out as "no rehash" without a separate check.
export function passwordNeedsRehash(hash: string): boolean {
  return bcrypt.getRounds(hash) < TARGET_BCRYPT_COST;
}
