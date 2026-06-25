import { Encryption } from '@boringnode/encryption';
import { aes256gcm } from '@boringnode/encryption/drivers/aes_256_gcm';

const CURRENT_ENCRYPTER_ID = 'sso';
const ENCRYPTION_NAMESPACE = 'coop';
const ENCRYPTION_VERSION = 'v1';

function getEncryptionSecret(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

function getEncryption(): Encryption {
  const secret = getEncryptionSecret();
  return new Encryption(
    aes256gcm({
      id: CURRENT_ENCRYPTER_ID,
      keys: [secret],
    }),
  );
}

function getCiphertextPrefix(): string {
  return `${ENCRYPTION_NAMESPACE}:${ENCRYPTION_VERSION}:`;
}

function unwrapCiphertext(value: string): string {
  const prefix = getCiphertextPrefix();
  if (!value.startsWith(prefix)) {
    throw new Error('Encrypted value is not in the supported format');
  }

  const ciphertext = value.slice(prefix.length);
  if (!ciphertext) {
    throw new Error('Encrypted value is not in the supported format');
  }

  return ciphertext;
}

/**
 * Encrypts a plaintext string using the shared boringnode encrypter.
 * Returns a string in the format:
 * coop:v1:<boringnode-ciphertext>
 */
export function encrypt(plaintext: string): string {
  return `${getCiphertextPrefix()}${getEncryption().encrypt(plaintext)}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 */
export function decrypt(encryptedValue: string): string {
  const decrypted = getEncryption().decrypt<string>(
    unwrapCiphertext(encryptedValue),
  );
  if (typeof decrypted !== 'string') {
    throw new Error('Failed to decrypt encrypted value');
  }
  return decrypted;
}
