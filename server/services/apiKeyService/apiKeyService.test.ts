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

  it('deactivates old keys and stores a hashed new key', async () => {
    query
      .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 0 })
      .mockImplementationOnce(async ({ parameters }) => ({
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
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0].sql).toContain('update "public"."api_keys"');
    expect(query.mock.calls[0][0].parameters).toEqual([false, orgId]);
    expect(query.mock.calls[1][0].sql).toContain(
      'insert into "public"."api_keys"',
    );
    expect(query.mock.calls[1][0].parameters).toEqual([
      orgId,
      hash,
      'Test Key',
      'Test Description',
      true,
      null,
    ]);
  });

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
    expect(query.mock.calls[0][0].parameters).toEqual([orgId, true]);
  });

  it('returns null when there is no active key', async () => {
    query.mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0 });

    expect(await sut.getActiveApiKeyForOrg(orgId)).toBeNull();
  });

  it('validates a key by its hash and updates last-used time', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ org_id: orgId, last_used_at: null }],
        command: 'SELECT',
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 1 });

    expect(await sut.validateApiKey('test-key')).toBe(orgId);

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
