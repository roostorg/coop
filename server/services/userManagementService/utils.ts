import { promisify } from 'util';
import bcrypt from 'bcryptjs';

export async function hashPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, 5);
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
