import { makeTestWithFixture } from '../../test/utils.js';
import ApiKeyService from './apiKeyService.js';
import type { Kysely } from 'kysely';
import { type CombinedPg } from '../combinedDbTypes.js';

// Mock Kysely database
const mockDb = {
  insertInto: jest.fn(),
  selectFrom: jest.fn(),
  updateTable: jest.fn(),
  deleteFrom: jest.fn(),
} as unknown as Kysely<CombinedPg>;

describe('ApiKeyService', () => {
  const fakeOrg = { id: '1234', name: 'Random Org' };

  const testWithFixtures = makeTestWithFixture(() => {
    const sut = new ApiKeyService(mockDb);
    return { sut };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('#createApiKey', () => {
    testWithFixtures(
      'should generate a key, store it, return it + the generated key id',
      async ({ sut }) => {
        // Mock the database operations
        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returningAll: jest.fn().mockReturnThis(),
          executeTakeFirstOrThrow: jest.fn().mockResolvedValue({
            id: 'key-123',
            org_id: fakeOrg.id,
            key_hash: 'hashed-key',
            name: 'Test Key',
            description: 'Test Description',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            last_used_at: null,
            created_by: null,
          }),
        };
        
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        (mockDb.insertInto as jest.Mock).mockReturnValue(mockInsert);
        (mockDb.updateTable as jest.Mock).mockReturnValue(mockUpdate);

        const res = await sut.createApiKey(
          fakeOrg.id,
          'Test Key',
          'Test Description',
          null,
        );

        // Verify the key was generated and stored
        expect(res.apiKey).toBeDefined();
        expect(typeof res.apiKey).toBe('string');
        expect(res.record.id).toBe('key-123');
        expect(res.record.orgId).toBe(fakeOrg.id);
      },
    );
  });

  describe('#getActiveApiKeyForOrg', () => {
    testWithFixtures(
      'should retrieve the active key for an org',
      async ({ sut }) => {
        const mockSelect = {
          selectAll: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue({
            id: 'key-123',
            org_id: fakeOrg.id,
            key_hash: 'hashed-key',
            name: 'Test Key',
            description: 'Test Description',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            last_used_at: null,
            created_by: null,
          }),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);

        const result = await sut.getActiveApiKeyForOrg(fakeOrg.id);

        expect(result).toBeDefined();
        expect(result?.id).toBe('key-123');
        expect(result?.orgId).toBe(fakeOrg.id);
      },
    );

    testWithFixtures(
      'should return null if no active key exists',
      async ({ sut }) => {
        const mockSelect = {
          selectAll: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue(undefined),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);

        const result = await sut.getActiveApiKeyForOrg(fakeOrg.id);

        expect(result).toBeNull();
      },
    );
  });

  describe('#validateApiKey', () => {
    testWithFixtures(
      'should validate a key and return org ID',
      async ({ sut }) => {
        const mockSelect = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue({
            org_id: fakeOrg.id,
            last_used_at: new Date(),
          }),
        };

        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue([]),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);
        (mockDb.updateTable as jest.Mock).mockReturnValue(mockUpdate);

        const result = await sut.validateApiKey('test-key');

        expect(result).toBe(fakeOrg.id);
      },
    );

    testWithFixtures(
      'should return null for invalid key',
      async ({ sut }) => {
        const mockSelect = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          executeTakeFirst: jest.fn().mockResolvedValue(undefined),
        };

        (mockDb.selectFrom as jest.Mock).mockReturnValue(mockSelect);

        const result = await sut.validateApiKey('invalid-key');

        expect(result).toBeNull();
      },
    );
  });
});