import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';

import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';

const { apiKeys } = schema;

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
  constructor(private readonly db: CoopDb) {}

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

    const [record] = await this.db
      .insert(apiKeys)
      .values({
        orgId,
        keyHash,
        name,
        description,
        isActive: true,
        createdBy,
      })
      .returning();

    return { apiKey, record };
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
    const result = (
      await this.db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.isActive, true)))
        .limit(1)
    ).at(0);

    return result ?? null;
  }

  /**
   * Gets all API keys for an organization
   */
  async getApiKeysForOrg(orgId: string): Promise<ApiKeyRecord[]> {
    return this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.orgId, orgId))
      .orderBy(desc(apiKeys.createdAt));
  }

  /**
   * Validates an API key and returns the associated org ID
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);

    const result = (
      await this.db
        .select({ orgId: apiKeys.orgId })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
        .limit(1)
    ).at(0);

    if (!result) {
      return null;
    }

    // Update last used timestamp
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.keyHash, keyHash));

    return result.orgId;
  }

  /**
   * Deactivates a specific API key
   */
  async deactivateApiKey(keyId: string, orgId: string): Promise<boolean> {
    await this.db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)));

    // NB: true even when no row matched (PoC keeps the existing contract).
    return true;
  }

  /**
   * Deactivates all API keys for an organization
   */
  async deactivateAllKeysForOrg(orgId: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.orgId, orgId));
  }

  /**
   * Deletes a specific API key
   */
  async deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
    await this.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)));

    // NB: true even when no row matched (PoC keeps the existing contract).
    return true;
  }
  /**
   * Gets the org ID from an activated API key
   */
  async getOrgIdFromActivatedKey(apiKey: string): Promise<string | null> {
    const keyHash = this.hashApiKey(apiKey);
    const result = (
      await this.db
        .select({ orgId: apiKeys.orgId })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
        .limit(1)
    ).at(0);
    if (!result) {
      return null;
    }
    return result.orgId;
  }
}

export default inject(['DrizzlePg'], ApiKeyService);
export type { ApiKeyService };
