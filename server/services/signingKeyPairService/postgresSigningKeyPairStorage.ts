import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';

import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import { type SigningKeyData } from '../../storage/postgres/schema/json-types.js';
import { jsonParse, jsonStringify, type JsonOf } from '../../utils/encoding.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import {
  type SigningKeyId,
  type SigningKeyPairStorage,
} from './signingKeyPairService.js';

type JWTCryptoKeyPairWithAlgorithm = SigningKeyData;

/**
 * PostgreSQL storage for signing key pairs
 */
export class PostgresSigningKeyPairStorage implements SigningKeyPairStorage {
  constructor(private readonly db: CoopDb) {}

  async storeKeyPair(
    keyId: SigningKeyId,
    keyPair: crypto.webcrypto.CryptoKeyPair,
  ): Promise<void> {
    const [privateKey, publicKey] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.privateKey),
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
    ]);

    const keyData: JWTCryptoKeyPairWithAlgorithm = {
      publicKeyWithAlgorithm: {
        key: publicKey,
        algorithm: keyPair.publicKey.algorithm,
      },
      privateKeyWithAlgorithm: {
        key: privateKey,
        algorithm: keyPair.privateKey.algorithm,
      },
    };

    // Drizzle serializes jsonb values itself, so pass the object, not a
    // pre-stringified string (which would be stored as a JSON string scalar).
    await this.db
      .insert(schema.signingKeys)
      .values({ orgId: keyId.orgId, keyData })
      .onConflictDoUpdate({
        target: schema.signingKeys.orgId,
        set: { keyData },
      });
  }

  private async fetchKeyPair(
    keyId: SigningKeyId,
  ): Promise<crypto.webcrypto.CryptoKeyPair> {
    const [result] = await this.db
      .select({ keyData: schema.signingKeys.keyData })
      .from(schema.signingKeys)
      .where(eq(schema.signingKeys.orgId, keyId.orgId))
      .limit(1);

    if (!result) {
      throw new CoopError({
        status: 404,
        name: 'SigningKeyPairNotFound',
        type: [ErrorType.SigningKeyPairNotFound],
        title: `Could not find signing key pair`,
        detail: `Key ID: ${jsonStringify(keyId)}.`,
        shouldErrorSpan: true,
      });
    }

    // Older rows may hold a JSON string scalar rather than an object.
    const keyData =
      typeof result.keyData === 'string'
        ? jsonParse(result.keyData as JsonOf<JWTCryptoKeyPairWithAlgorithm>)
        : result.keyData;
    const { privateKeyWithAlgorithm, publicKeyWithAlgorithm } = keyData;

    return {
      privateKey: await crypto.subtle.importKey(
        'jwk',
        privateKeyWithAlgorithm.key,
        this.exportedAlgorithmToImportableAlgorithm(
          privateKeyWithAlgorithm.algorithm,
        ),
        true,
        ['sign'],
      ),
      publicKey: await crypto.subtle.importKey(
        'jwk',
        publicKeyWithAlgorithm.key,
        this.exportedAlgorithmToImportableAlgorithm(
          publicKeyWithAlgorithm.algorithm,
        ),
        true,
        ['verify'],
      ),
    };
  }

  async fetchPublicKey(
    keyId: SigningKeyId,
  ): Promise<crypto.webcrypto.CryptoKey> {
    const pair = await this.fetchKeyPair(keyId);
    return pair.publicKey;
  }

  async fetchPrivateKey(
    keyId: SigningKeyId,
  ): Promise<crypto.webcrypto.CryptoKey> {
    const pair = await this.fetchKeyPair(keyId);
    return pair.privateKey;
  }

  private exportedAlgorithmToImportableAlgorithm(
    algorithm: KeyAlgorithm,
  ): RsaHashedKeyGenParams | EcKeyGenParams {
    if (algorithm.name === 'RSASSA-PKCS1-v1_5') {
      return {
        name: 'RSASSA-PKCS1-v1_5',
        hash: (algorithm as RsaHashedKeyAlgorithm).hash,
        modulusLength: 2048, // Default RSA key size
        publicExponent: new Uint8Array([1, 0, 1]), // Default public exponent
      };
    }
    if (algorithm.name === 'ECDSA') {
      return {
        name: 'ECDSA',
        namedCurve: (algorithm as EcKeyAlgorithm).namedCurve,
      };
    }
    throw new Error(`Unsupported algorithm: ${algorithm.name}`);
  }
}
