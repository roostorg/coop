import crypto from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';

import { inject } from '../../iocContainer/utils.js';
import { makeBadRequestError } from '../../utils/errors.js';
import { type CombinedPg } from '../combinedDbTypes.js';
import { type ApiKeyServicePg } from './dbTypes.js';
import { API_KEY_PERMISSIONS } from './permissions.js';

type ApiKeyRow = Selectable<ApiKeyServicePg['public.api_keys']>;

export interface ApiKeyMetadata {
  name: string;
  description: string;
}

export interface ApiKeyWithMetadata {
  key: string;
  metadata: ApiKeyMetadata;
}

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  keyHash: string;
  name: string;
  description: string | null;
  permissions: readonly string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  createdBy: string | null;
}

class ApiKeyService {
  constructor(private readonly db: Kysely<CombinedPg>) {}

  /**
   * Generates a secure random API key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashes an API key for secure storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Creates a new API key for an organization
   */
  async createApiKey(
    orgId: string,
    name: string,
    description: string | null,
    createdBy: string | null,
    permissions: readonly string[] = [],
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    if (
      permissions.some(
        (permission) =>
          !API_KEY_PERMISSIONS.some((allowed) => allowed === permission),
      )
    ) {
      throw makeBadRequestError('Unknown API key permission', {
        shouldErrorSpan: true,
      });
    }
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    const result = await this.db
      .insertInto('public.api_keys')
      .values({
        org_id: orgId,
        key_hash: keyHash,
        name,
        description,
        is_active: true,
        created_by: createdBy,
        permissions: [...new Set(permissions)],
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      apiKey,
      record: this.mapDbRecordToApiKeyRecord(result),
    };
  }

  /**
   * Replaces one active key's secret without affecting other keys.
   * Without a key ID, rotates the most recently created active key.
   */
  async rotateApiKey(
    orgId: string,
    name: string,
    description: string | null,
    createdBy: string | null,
    keyId?: string,
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    const apiKey = this.generateApiKey();
    const selectedKey = this.db
      .selectFrom('public.api_keys')
      .select('id')
      .where('org_id', '=', orgId)
      .where('is_active', '=', true)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(1);
    const result = await this.db
      .updateTable('public.api_keys')
      .set({
        key_hash: this.hashApiKey(apiKey),
        name,
        description,
        last_used_at: null,
      })
      .where('org_id', '=', orgId)
      .where('is_active', '=', true)
      .where('id', '=', keyId ?? selectedKey)
      .returningAll()
      .executeTakeFirst();

    if (!result && keyId === undefined) {
      return this.createApiKey(orgId, name, description, createdBy);
    }
    if (!result) {
      throw new Error('Active API key not found');
    }
    return { apiKey, record: this.mapDbRecordToApiKeyRecord(result) };
  }

  /**
   * Gets the active API key for an organization
   */
  async getActiveApiKeyForOrg(orgId: string): Promise<ApiKeyRecord | null> {
    const result = await this.db
      .selectFrom('public.api_keys')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('is_active', '=', true)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();

    return result ? this.mapDbRecordToApiKeyRecord(result) : null;
  }

  /**
   * Gets all API keys for an organization
   */
  async getApiKeysForOrg(orgId: string): Promise<ApiKeyRecord[]> {
    const results = await this.db
      .selectFrom('public.api_keys')
      .selectAll()
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute();

    return results.map(this.mapDbRecordToApiKeyRecord);
  }

  /**
   * Validates an API key and returns its organization and explicit grants.
   */
  async validateApiKey(
    apiKey: string,
  ): Promise<{ orgId: string; permissions: readonly string[] } | null> {
    const keyHash = this.hashApiKey(apiKey);

    const result = await this.db
      .selectFrom('public.api_keys')
      .select(['org_id', 'permissions'])
      .where('key_hash', '=', keyHash)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    // Update last used timestamp
    await this.db
      .updateTable('public.api_keys')
      .set({ last_used_at: new Date() })
      .where('key_hash', '=', keyHash)
      .execute();

    return { orgId: result.org_id, permissions: result.permissions };
  }

  /**
   * Deactivates a specific API key
   */
  async deactivateApiKey(keyId: string, orgId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('public.api_keys')
      .set({ is_active: false })
      .where('id', '=', keyId)
      .where('org_id', '=', orgId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    return result.numUpdatedRows > 0n;
  }

  /**
   * Deletes a specific API key
   */
  async deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('public.api_keys')
      .where('id', '=', keyId)
      .where('org_id', '=', orgId)
      .execute();

    return result.length > 0;
  }
  /**
   * Gets the org ID from an activated API key
   */
  async getOrgIdFromActivatedKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);
    const result = await this.db
      .selectFrom('public.api_keys')
      .select('org_id')
      .where('key_hash', '=', keyHash)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (!result) {
      return null;
    }
    return result.org_id;
  }

  /**
   * Maps database record to ApiKeyRecord
   */
  private mapDbRecordToApiKeyRecord(record: ApiKeyRow): ApiKeyRecord {
    return {
      id: record.id,
      orgId: record.org_id,
      keyHash: record.key_hash,
      name: record.name,
      description: record.description,
      permissions: record.permissions,
      isActive: record.is_active,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      lastUsedAt: record.last_used_at,
      createdBy: record.created_by,
    };
  }
}

export default inject(['KyselyPg'], ApiKeyService);
export type { ApiKeyService };
