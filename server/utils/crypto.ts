import { type CipherKey, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): CipherKey {
  const key = process.env.SSO_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SSO_ENCRYPTION_KEY environment variable is not set');
  }
  
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      'SSO_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  }
  return buf as CipherKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64 string in the format: iv:ciphertext:authTag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, new Uint8Array(iv), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([new Uint8Array(cipher.update(plaintext, 'utf8')), new Uint8Array(cipher.final())]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 * Returns null if the value doesn't look like an encrypted string (for
 * backwards compatibility with pre-encryption plaintext values).
 */
export function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    // Not in encrypted format — return as-is for backwards compatibility
    // with secrets stored before encryption was enabled
    return encryptedValue;
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, new Uint8Array(iv), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(new Uint8Array(authTag));
  return decipher.update(new Uint8Array(encrypted), undefined, 'utf8') + decipher.final('utf8');
}
