import { decrypt, encrypt } from './crypto.js';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

describe('crypto helpers', () => {
  const previousEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (previousEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = previousEncryptionKey;
    }
  });

  test('encrypts and decrypts with boringnode', () => {
    const plaintext = 'super-secret';
    const encrypted = encrypt(plaintext);

    expect(encrypted.startsWith('coop:v1:sso.')).toBe(true);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test('throws for plaintext values without the coop version prefix', () => {
    expect(() => decrypt('plain-text-secret')).toThrow(
      'Encrypted value is not in the supported format',
    );
  });
});
