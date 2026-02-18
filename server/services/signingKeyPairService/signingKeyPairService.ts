import crypto from 'node:crypto';
import { type ReadonlyDeep } from 'type-fest';

import { inject } from '../../iocContainer/index.js';
import { cached, type Cached } from '../../utils/caching.js';

/**
 * This service generates + stores key pairs for request signing, which it can
 * then retrieve. It operates under the assumption that the resulting key will
 * be stored somewhere, and then retrieved from storage for signing requests or
 * to show to the user in the UI.
 *
 * After rotating, storage (e.g. AWS Secrets Manager) may be eventually
 * consistent, so the next read can still return the old key. We cache the new
 * public key here briefly so the UI refetch/refresh sees the correct key.
 */
const ROTATED_KEY_TTL_MS = 10_000;
const recentlyRotatedPublicKeys = new Map<
  string,
  { key: CryptoKey; expiresAt: number }
>();

class SigningKeyPairService {
  private fetchPrivateKey: Cached<(key: SigningKeyId) => Promise<CryptoKey>>;

  constructor(private readonly store: SigningKeyPairStorage) {
    this.fetchPrivateKey = cached({
      producer: async (key) => store.fetchPrivateKey(key),
      directives: { freshUntilAge: 86_400 /* 1 day */ },
    });
  }

  private async createSigningKeys() {
    return crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
  }

  /**
   * Generates and stores the private + public key for the org. Returns a
   * CryptoKey object for the public key, which contains details that would be
   * needed to actually verify a signature made using the corresponding private
   * key.
   *
   * @param orgId The org for which to generate a key pair.
   * @returns The generated public key that could be used by the org.
   */
  public async createAndStoreSigningKeys(orgId: string) {
    const keyPair = await this.createSigningKeys();
    await this.store.storeKeyPair({ orgId }, keyPair);
    return keyPair.publicKey;
  }

  /**
   * Generates a new key pair, overwrites the stored pair for the org, and
   * invalidates any cached private key so the new key is used for signing.
   * Use this to rotate the webhook signature verification key.
   *
   * @param orgId The org for which to rotate the key pair.
   * @returns The new public key (for exporting to PEM and showing once to the user).
   */
  public async rotateSigningKeys(orgId: string) {
    const keyPair = await this.createSigningKeys();
    await this.store.storeKeyPair({ orgId }, keyPair);
    if (this.fetchPrivateKey.invalidate) {
      await this.fetchPrivateKey.invalidate({ orgId });
    }
    recentlyRotatedPublicKeys.set(orgId, {
      key: keyPair.publicKey,
      expiresAt: Date.now() + ROTATED_KEY_TTL_MS,
    });
    return keyPair.publicKey;
  }

  /**
   * Returns the public key for verification. If we just rotated for this org,
   * we return the new key from memory so the next read is correct even when
   * storage (e.g. AWS Secrets Manager) is eventually consistent.
   */
  public async getSignatureVerificationInfo(orgId: string) {
    const entry = recentlyRotatedPublicKeys.get(orgId);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.key;
      }
      recentlyRotatedPublicKeys.delete(orgId);
    }
    return this.store.fetchPublicKey({ orgId });
  }

  public async sign(orgId: string, data: ArrayBuffer) {
    // This will throw a NotFoundError if no key is found for the org
    const privateKey = await this.fetchPrivateKey({ orgId });
    return {
      signature: await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        // We're relying on the `sign()` function to not mutate the key it's
        // given because these key objects get reused many times after they're
        // loaded from the cache. In reality, this assumption is safe -- it
        // doesn't actually mutate the input -- but the types for sign() are
        // slightly wrong, in that they don't promise that, so we just cast it
        // to the non-readonly-version and trust the function.
        privateKey satisfies ReadonlyDeep<CryptoKey> as CryptoKey,
        data,
      ),
    };
  }

  public async close() {
    return this.fetchPrivateKey.close();
  }
}

// Interface that storage implementations must satisfy
export type SigningKeyPairStorage = {
  storeKeyPair(keyId: SigningKeyId, keyPair: CryptoKeyPair): Promise<void>;
  fetchPublicKey(keyId: SigningKeyId): Promise<CryptoKey>;
  fetchPrivateKey(keyId: SigningKeyId): Promise<CryptoKey>;
};

// Intentionally an object to support future extensions where each
// org has more than one key.
export type SigningKeyId = { orgId: string };

export default inject(['SigningKeyPairStorageService'], SigningKeyPairService);
export { type SigningKeyPairService };
