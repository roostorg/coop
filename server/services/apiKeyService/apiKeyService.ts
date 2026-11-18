import crypto from 'node:crypto';

import { inject } from '../../iocContainer/utils.js';
import {
  type PrismaModels,
  type PrismaPgClient,
} from '../../storage/prisma/index.js';

type ApiKeyRow = PrismaModels.api_keysModel;

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
  constructor(private readonly db: PrismaPgClient) {}

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

    const result = await this.db.api_keys.create({
      data: {
        org_id: orgId,
        key_hash: keyHash,
        name,
        description,
        is_active: true,
        created_by: createdBy,
      },
    });

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
    const result = await this.db.api_keys.findFirst({
      where: { org_id: orgId, is_active: true },
    });

    return result ? this.mapDbRecordToApiKeyRecord(result) : null;
  }

  /**
   * Gets all API keys for an organization
   */
  async getApiKeysForOrg(orgId: string): Promise<ApiKeyRecord[]> {
    const results = await this.db.api_keys.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: 'desc' },
    });

    return results.map(this.mapDbRecordToApiKeyRecord);
  }

  /**
   * Validates an API key and returns the associated org ID
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);

    const result = await this.db.api_keys.findFirst({
      select: { org_id: true, last_used_at: true },
      where: { key_hash: keyHash, is_active: true },
    });

    if (!result) {
      return null;
    }

    // Update last used timestamp
    await this.db.api_keys.updateMany({
      data: { last_used_at: new Date() },
      where: { key_hash: keyHash },
    });

    return result.org_id;
  }

  /**
   * Deactivates a specific API key
   */
  async deactivateApiKey(keyId: string, orgId: string): Promise<boolean> {
    await this.db.api_keys.updateMany({
      data: { is_active: false },
      where: { id: keyId, org_id: orgId },
    });

    // Kysely's `execute()` returned one result object per statement, so this
    // was always true; kept as-is.
    return true;
  }

  /**
   * Deactivates all API keys for an organization
   */
  async deactivateAllKeysForOrg(orgId: string): Promise<void> {
    await this.db.api_keys.updateMany({
      data: { is_active: false },
      where: { org_id: orgId },
    });
  }

  /**
   * Deletes a specific API key
   */
  async deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
    await this.db.api_keys.deleteMany({
      where: { id: keyId, org_id: orgId },
    });

    // Kysely's `execute()` returned one result object per statement, so this
    // was always true; kept as-is.
    return true;
  }
  /**
   * Gets the org ID from an activated API key
   */
  async getOrgIdFromActivatedKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);
    const result = await this.db.api_keys.findFirst({
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

export default inject(['PrismaPg'], ApiKeyService);
export type { ApiKeyService };
