import bcrypt from 'bcryptjs';

export async function hashPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, 5);
}
