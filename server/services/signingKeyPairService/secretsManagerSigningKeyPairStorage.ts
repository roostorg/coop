import crypto from 'node:crypto';
import {
  CreateSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

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

export class SecretsManagerSigningKeyPairStorage
  implements SigningKeyPairStorage
{
  private readonly client = new SecretsManagerClient({ 
    region: process.env.AWS_REGION ?? 'us-east-2' 
  });

  private getSecretIdForKeyId(keyId: SigningKeyId) {
    // TODO: make this name vary by environment, so that staging + prod orgs
    // can't clobber one another. Also, will need to update the CDK code that
    // gives pods permission to read these secrets to use an env-derived prefix.
    return `Prod/OrgSecrets/${keyId.orgId}/signingKeys/default`;
  }

  async storeKeyPair(
    keyId: SigningKeyId,
    keyPair: CryptoKeyPair,
  ): Promise<void> {
    const [privateKey, publicKey] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.privateKey),
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
    ]);
    await this.client.send(
      new CreateSecretCommand({
        Name: this.getSecretIdForKeyId(keyId),
        Description: `Public + private key pair used to sign webhook requests for org with ID ${keyId.orgId}`,
        SecretString: jsonStringify<JWTCryptoKeyPairWithAlgorithm>({
          publicKeyWithAlgorithm: {
            key: publicKey,
            algorithm: keyPair.publicKey.algorithm,
          },
          privateKeyWithAlgorithm: {
            key: privateKey,
            algorithm: keyPair.privateKey.algorithm,
          },
        }),
      }),
    );
  }

  private async fetchKeyPair(keyId: SigningKeyId): Promise<CryptoKeyPair> {
    const response = await this.client.send(
      new GetSecretValueCommand({
        SecretId: this.getSecretIdForKeyId(keyId),
      }),
    );
    if (!response.SecretString) {
      throw new CoopError({
        status: 404,
        name: 'SigningKeyPairNotFound',
        type: [ErrorType.SigningKeyPairNotFound],
        title: `Could not find signing key pair`,
        detail: `Key ID: ${jsonStringify(keyId)}.`,
        shouldErrorSpan: true,
      });
    }

    const secret = jsonParse(
      response.SecretString as JsonOf<JWTCryptoKeyPairWithAlgorithm>,
    );
    const { privateKeyWithAlgorithm, publicKeyWithAlgorithm } = secret;

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

  private exportedAlgorithmToImportableAlgorithm(it: KeyAlgorithm) {
    switch (it.name) {
      case 'RSASSA-PKCS1-v1_5':
      case 'RSA-PSS':
      case 'RSA-OAEP':
        return {
          name: it.name,
          hash: (it as RsaHashedKeyAlgorithm).hash.name,
        };

      // TODO: Add the other algorithms defined by WebCrypto API when we need them
      default:
        throw new Error(`Unsupported algorithm: ${it.name}`);
    }
  }
}
