import crypto from 'node:crypto';
import { Kysely } from 'kysely';
import { vi } from 'vitest';

import {
  makeMockPgDialect,
  type MockPgExecute,
} from '../../test/stubs/KyselyPg.js';
import { type CombinedPg } from '../combinedDbTypes.js';
import ApiKeyService from './apiKeyService.js';

describe('ApiKeyService', () => {
  const orgId = 'org-1234';
  const row = {
    id: 'key-123',
    org_id: orgId,
    key_hash: 'stored-hash',
    name: 'Test Key',
    description: 'Test Description',
    permissions: ['items:read'],
    is_active: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    last_used_at: null,
    created_by: null,
  };

  let query: MockPgExecute;
  let db: Kysely<CombinedPg>;
  let sut: InstanceType<typeof ApiKeyService>;

  beforeEach(() => {
    query = vi.fn<MockPgExecute>();
    db = new Kysely<CombinedPg>({ dialect: makeMockPgDialect(query) });
    sut = new ApiKeyService(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('stores a hashed new key without deactivating other keys', async () => {
    query.mockImplementationOnce(async ({ parameters }) => ({
      rows: [{ ...row, key_hash: parameters[1] }],
      command: 'INSERT',
      rowCount: 1,
    }));

    const result = await sut.createApiKey(
      orgId,
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
      id: row.id,
      orgId,
      keyHash: hash,
      name: row.name,
      description: row.description,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].sql).toContain(
      'insert into "public"."api_keys"',
    );
    expect(query.mock.calls[0][0].parameters).toEqual([
      orgId,
      hash,
      'Test Key',
      'Test Description',
      true,
      null,
      [],
    ]);
  });

  it.each([
    { rowCount: 1, expected: true },
    { rowCount: 0, expected: false },
  ])(
    'returns $expected when deactivation affects $rowCount rows',
    async ({ rowCount, expected }) => {
      query.mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount });

      expect(await sut.deactivateApiKey(row.id, orgId)).toBe(expected);

      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0]).toEqual({
        sql: 'update "public"."api_keys" set "is_active" = $1 where "id" = $2 and "org_id" = $3 and "is_active" = $4',
        parameters: [false, row.id, orgId, true],
      });
    },
  );

  it('returns the active key for the requested organization', async () => {
    query.mockResolvedValueOnce({
      rows: [row],
      command: 'SELECT',
      rowCount: 1,
    });

    const result = await sut.getActiveApiKeyForOrg(orgId);

    expect(result).toMatchObject({ id: row.id, orgId, keyHash: row.key_hash });
    expect(query.mock.calls[0][0].sql).toContain(
      'select * from "public"."api_keys"',
    );
    expect(query.mock.calls[0][0].sql).toContain(
      'where "org_id" = $1 and "is_active" = $2 order by "created_at" desc, "id" desc limit $3',
    );
    expect(query.mock.calls[0][0].parameters).toEqual([orgId, true, 1]);
  });

  it('returns null when there is no active key', async () => {
    query.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0 });

    expect(await sut.getActiveApiKeyForOrg(orgId)).toBeNull();
  });

  it('validates a key by its hash and updates last-used time', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ org_id: orgId, permissions: ['items:read'] }],
        command: 'SELECT',
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 1 });

    expect(await sut.validateApiKey('test-key')).toEqual({
      orgId,
      permissions: ['items:read'],
    });

    const hash = crypto.createHash('sha256').update('test-key').digest('hex');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0].parameters).toEqual([hash, true]);
    expect(query.mock.calls[1][0].sql).toContain('update "public"."api_keys"');
    expect(query.mock.calls[1][0].parameters).toEqual([expect.any(Date), hash]);
  });

  it('does not update last-used time for an invalid key', async () => {
    query.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0 });

    expect(await sut.validateApiKey('invalid-key')).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
