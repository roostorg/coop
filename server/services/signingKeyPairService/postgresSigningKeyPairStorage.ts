import crypto from 'node:crypto';
import { type JsonObject } from 'type-fest';

import {
  managerOf,
  toJsonColumn,
  type TypeormDb,
} from '../../storage/typeorm/db.js';
import { SigningKeys } from '../../storage/typeorm/entities/index.js';
import { jsonParse, jsonStringify, type JsonOf } from '../../utils/encoding.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
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
  constructor(private readonly db: TypeormDb) {}

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

    // Store in PostgreSQL as JSONB. TypeORM serializes jsonb values itself, so
    // this passes the object; a pre-stringified value would be stored as a
    // JSON string scalar.
    const manager = await managerOf(this.db);
    await manager.upsert(
      SigningKeys,
      {
        org_id: keyId.orgId,
        key_data: toJsonColumn(keyData as unknown as JsonObject),
      },
      ['org_id'],
    );
  }

  private async fetchKeyPair(
    keyId: SigningKeyId,
  ): Promise<crypto.webcrypto.CryptoKeyPair> {
    const manager = await managerOf(this.db);
    const result = await manager.findOne(SigningKeys, {
      select: { key_data: true },
      where: { org_id: keyId.orgId },
    });

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

    const keyData: JWTCryptoKeyPairWithAlgorithm =
      typeof result.key_data === 'string'
        ? jsonParse(result.key_data as JsonOf<JWTCryptoKeyPairWithAlgorithm>)
        : (result.key_data as unknown as JWTCryptoKeyPairWithAlgorithm);
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
