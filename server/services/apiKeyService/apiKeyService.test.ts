import crypto from 'node:crypto';
import { vi } from 'vitest';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('ApiKeyService', () => {
  const testWithOrgs = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgA = await createOrg(deps);
    const orgB = await createOrg(deps);
    return { orgA, orgB };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  testWithOrgs(
    'deactivates old keys and stores a hashed new key',
    async ({ deps, orgA, orgB }) => {
      expect(await deps.ApiKeyService.validateApiKey(orgA.apiKey)).toBe(
        orgA.org.id,
      );

      const result = await deps.ApiKeyService.createApiKey(
        orgA.org.id,
        'Test Key',
        'Test Description',
        null,
      );
      const hash = crypto
        .createHash('sha256')
        .update(result.apiKey)
        .digest('hex');

      expect(result.apiKey).toMatch(/^[a-f0-9]{64}$/);
      expect(result.record).toMatchObject({
        orgId: orgA.org.id,
        keyHash: hash,
        name: 'Test Key',
        description: 'Test Description',
        isActive: true,
        createdBy: null,
      });
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgA.org.id),
      ).toEqual(result.record);
      expect(await deps.ApiKeyService.validateApiKey(orgA.apiKey)).toBeNull();
      expect(await deps.ApiKeyService.validateApiKey(result.apiKey)).toBe(
        orgA.org.id,
      );
      expect(await deps.ApiKeyService.validateApiKey(orgB.apiKey)).toBe(
        orgB.org.id,
      );
    },
  );

  testWithOrgs(
    'returns the active key for the requested organization',
    async ({ deps, orgA, orgB }) => {
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgA.org.id),
      ).toMatchObject({
        orgId: orgA.org.id,
        keyHash: crypto.createHash('sha256').update(orgA.apiKey).digest('hex'),
        isActive: true,
      });
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgB.org.id),
      ).toMatchObject({
        orgId: orgB.org.id,
        keyHash: crypto.createHash('sha256').update(orgB.apiKey).digest('hex'),
        isActive: true,
      });
    },
  );

  testWithOrgs(
    'returns null when there is no active key',
    async ({ deps, orgA, orgB }) => {
      await deps.ApiKeyService.deactivateAllKeysForOrg(orgA.org.id);

      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgA.org.id),
      ).toBeNull();
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgB.org.id),
      ).toMatchObject({
        orgId: orgB.org.id,
        isActive: true,
      });
    },
  );

  testWithOrgs(
    'validates a key by its hash and updates last-used time',
    async ({ deps, orgA, orgB }) => {
      const validationTime = new Date('2026-01-02T03:04:05.000Z');
      vi.setSystemTime(validationTime);

      expect(await deps.ApiKeyService.validateApiKey(orgA.apiKey)).toBe(
        orgA.org.id,
      );
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgA.org.id),
      ).toMatchObject({
        lastUsedAt: validationTime,
      });
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgB.org.id),
      ).toMatchObject({
        lastUsedAt: null,
      });
    },
  );

  testWithOrgs(
    'does not update last-used time for an invalid key',
    async ({ deps, orgA, orgB }) => {
      expect(await deps.ApiKeyService.validateApiKey('invalid-key')).toBeNull();
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgA.org.id),
      ).toMatchObject({
        lastUsedAt: null,
      });
      expect(
        await deps.ApiKeyService.getActiveApiKeyForOrg(orgB.org.id),
      ).toMatchObject({
        lastUsedAt: null,
      });
    },
  );
});
