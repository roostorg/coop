import { Kysely } from 'kysely';
import { vi } from 'vitest';

import { makeApiKeyService } from '../services/apiKeyService/index.js';
import { type CombinedPg } from '../services/combinedDbTypes.js';
import {
  makeMockPgDialect,
  type MockPgExecute,
} from '../test/stubs/KyselyPg.js';
import { createPrimaryApiKey } from './create-primary-api-key.js';

it('creates a bootstrap key that authenticates with the existing REST permissions', async () => {
  const query = vi.fn<MockPgExecute>();
  const db = new Kysely<CombinedPg>({ dialect: makeMockPgDialect(query) });
  const service = new makeApiKeyService(db);

  query.mockImplementationOnce(async ({ parameters }) => {
    const row = {
      id: 'bootstrap-key',
      org_id: parameters[0],
      key_hash: parameters[1],
      name: parameters[2],
      description: parameters[3],
      is_active: parameters[4],
      created_by: parameters[5],
      permissions: parameters[6],
      created_at: new Date(),
      updated_at: new Date(),
      last_used_at: null,
    };
    query.mockImplementationOnce(async ({ parameters: lookupParameters }) => ({
      rows: lookupParameters[0] === row.key_hash ? [row] : [],
      command: 'SELECT',
      rowCount: lookupParameters[0] === row.key_hash ? 1 : 0,
    }));
    query.mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 1 });
    return { rows: [row], command: 'INSERT', rowCount: 1 };
  });

  try {
    const { apiKey } = await createPrimaryApiKey(service, 'bootstrap-org');

    await expect(service.validateApiKey(apiKey)).resolves.toEqual({
      orgId: 'bootstrap-org',
      permissions: [
        'items:read',
        'items:write',
        'reports:write',
        'appeals:write',
        'actions:execute',
        'config:read',
      ],
    });
  } finally {
    await db.destroy();
  }
});
