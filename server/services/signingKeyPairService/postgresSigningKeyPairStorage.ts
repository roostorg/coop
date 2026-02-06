import crypto from 'node:crypto';
import type { Kysely } from 'kysely';

import { jsonStringify } from '../../utils/encoding.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import { type CombinedPg } from '../combinedDbTypes.js';
import {
  type SigningKeyId,
  type SigningKeyPairStorage,
} from './signingKeyPairService.js';

type JWTWithAlgorithm = {
  key: JsonWebKey;
  algorithm: KeyAlgorithm;
};

type JWTCryptoKeyPairWithAlgorithm = {
  publicKeyWithAlgorithm: JWTWithAlgorithm;
  privateKeyWithAlgorithm: JWTWithAlgorithm;
};

/**
 * PostgreSQL storage for signing key pairs
 */
export class PostgresSigningKeyPairStorage implements SigningKeyPairStorage {
  constructor(private readonly db: Kysely<CombinedPg>) {}

  async storeKeyPair(
    keyId: SigningKeyId,
    keyPair: CryptoKeyPair,
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

    // Store in PostgreSQL as JSONB
    await this.db
      .insertInto('public.signing_keys')
      .values({
        org_id: keyId.orgId,
        key_data: jsonStringify(keyData),
      })
      .onConflict((oc) => oc
        .column('org_id')
        .doUpdateSet({
          key_data: jsonStringify(keyData),
        })
      )
      .execute();
  }

  private async fetchKeyPair(keyId: SigningKeyId): Promise<CryptoKeyPair> {
    const result = await this.db
      .selectFrom('public.signing_keys')
      .select(['key_data'])
      .where('org_id', '=', keyId.orgId)
      .executeTakeFirst();

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

    // eslint-disable-next-line no-restricted-syntax
    const keyData: JWTCryptoKeyPairWithAlgorithm = JSON.parse(result.key_data);
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

  async fetchPublicKey(keyId: SigningKeyId): Promise<CryptoKey> {
    const pair = await this.fetchKeyPair(keyId);
    return pair.publicKey;
  }

  async fetchPrivateKey(keyId: SigningKeyId): Promise<CryptoKey> {
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
