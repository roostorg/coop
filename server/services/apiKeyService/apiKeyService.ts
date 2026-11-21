import crypto from 'node:crypto';

import { inject } from '../../iocContainer/utils.js';
import { managerOf, type TypeormDb } from '../../storage/typeorm/db.js';
import { ApiKeys } from '../../storage/typeorm/entities/index.js';

type ApiKeyRow = Omit<ApiKeys, 'org' | 'created_by_rel'>;

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
  constructor(private readonly db: TypeormDb) {}

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
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    // Deactivate any existing active keys for this org
    await this.deactivateAllKeysForOrg(orgId);

    const manager = await managerOf(this.db);
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(ApiKeys)
      .values({
        org_id: orgId,
        key_hash: keyHash,
        name,
        description,
        is_active: true,
        created_by: createdBy,
      })
      .returning('*')
      .updateEntity(false)
      .execute();
    const result = (inserted.raw as ApiKeyRow[])[0];

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
    createdBy: string | null,
  ): Promise<{ apiKey: string; record: ApiKeyRecord }> {
    return this.createApiKey(orgId, name, description, createdBy);
  }

  /**
   * Gets the active API key for an organization
   */
  async getActiveApiKeyForOrg(orgId: string): Promise<ApiKeyRecord | null> {
    const manager = await managerOf(this.db);
    const result = await manager.findOneBy(ApiKeys, {
      org_id: orgId,
      is_active: true,
    });

    return result ? this.mapDbRecordToApiKeyRecord(result) : null;
  }

  /**
   * Gets all API keys for an organization
   */
  async getApiKeysForOrg(orgId: string): Promise<ApiKeyRecord[]> {
    const manager = await managerOf(this.db);
    const results = await manager.find(ApiKeys, {
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
    });

    return results.map(this.mapDbRecordToApiKeyRecord);
  }

  /**
   * Validates an API key and returns the associated org ID
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);

    const manager = await managerOf(this.db);
    const result = await manager.findOne(ApiKeys, {
      select: { org_id: true, last_used_at: true },
      where: { key_hash: keyHash, is_active: true },
    });

    if (!result) {
      return null;
    }

    // Update last used timestamp
    await manager.update(
      ApiKeys,
      { key_hash: keyHash },
      { last_used_at: new Date() },
    );

    return result.org_id;
  }

  /**
   * Deactivates a specific API key
   */
  async deactivateApiKey(keyId: string, orgId: string): Promise<boolean> {
    const manager = await managerOf(this.db);
    const result = await manager.update(
      ApiKeys,
      { id: keyId, org_id: orgId },
      { is_active: false },
    );

    return (result.affected ?? 0) > 0;
  }

  /**
   * Deactivates all API keys for an organization
   */
  async deactivateAllKeysForOrg(orgId: string): Promise<void> {
    const manager = await managerOf(this.db);
    await manager.update(ApiKeys, { org_id: orgId }, { is_active: false });
  }

  /**
   * Deletes a specific API key
   */
  async deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
    const manager = await managerOf(this.db);
    const result = await manager.delete(ApiKeys, { id: keyId, org_id: orgId });

    return (result.affected ?? 0) > 0;
  }
  /**
   * Gets the org ID from an activated API key
   */
  async getOrgIdFromActivatedKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);
    const manager = await managerOf(this.db);
    const result = await manager.findOne(ApiKeys, {
      select: { org_id: true },
      where: { key_hash: keyHash, is_active: true },
    });
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
      isActive: record.is_active,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      lastUsedAt: record.last_used_at,
      createdBy: record.created_by,
    };
  }
}

export default inject(['TypeormPg'], ApiKeyService);
export type { ApiKeyService };
