import crypto from 'node:crypto';
import type { Kysely } from 'kysely';
import { inject } from '../../iocContainer/index.js';
import { type CombinedPg } from '../combinedDbTypes.js';

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
    createdBy: string | null
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    // Deactivate any existing active keys for this org
    await this.deactivateAllKeysForOrg(orgId);

    const result = await this.db
      .insertInto('public.api_keys')
      .values({
        org_id: orgId,
        key_hash: keyHash,
        name,
        description,
        is_active: true,
        created_by: createdBy,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      apiKey,
      record: this.mapDbRecordToApiKeyRecord(result),
    };
  }

  /**
   * Rotates (creates new and deactivates old) API key for an organization
   */
  async rotateApiKey(
    orgId: string,
    name: string,
    description: string | null,
    createdBy: string | null
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    return this.createApiKey(orgId, name, description, createdBy);
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
   * Validates an API key and returns the associated org ID
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);
    
    const result = await this.db
      .selectFrom('public.api_keys')
      .select(['org_id', 'last_used_at'])
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

    return result.org_id;
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
      .execute();

    return result.length > 0;
  }

  /**
   * Deactivates all API keys for an organization
   */
  async deactivateAllKeysForOrg(orgId: string): Promise<void> {
    await this.db
      .updateTable('public.api_keys')
      .set({ is_active: false })
      .where('org_id', '=', orgId)
      .execute();
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
    const result = await this.db.selectFrom('public.api_keys').select('org_id').where('key_hash', '=', keyHash).where('is_active', '=', true).executeTakeFirst();
    if (!result) {
      return null;
    }
    return result.org_id;
  }

  /**
   * Maps database record to ApiKeyRecord
   */
  private mapDbRecordToApiKeyRecord(record: any): ApiKeyRecord {
    return {
      id: record.id,
      orgId: record.org_id,
      keyHash: record.key_hash,
      name: record.name,
      description: record.description,
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