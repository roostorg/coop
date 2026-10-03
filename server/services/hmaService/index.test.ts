import { vi, type Mock } from 'vitest';

import { jsonParse } from '../../utils/encoding.js';
import type { HashBank } from './dbTypes.js';
import { HashBankUserError, HmaService, type ExchangeInfo } from './index.js';

const MOCK_BANK: HashBank = {
  id: 1,
  name: 'test bank',
  hma_name: 'COOP_ORG1_TEST_BANK',
  description: 'desc',
  enabled_ratio: 1.0,
  org_id: 'org1',
  created_at: new Date(),
  updated_at: new Date(),
};

const SECRET = 'hunter2-super-secret';

const NCMEC_SCHEMA = {
  config_schema: { fields: [] },
  credentials_schema: {
    fields: [
      {
        name: 'user',
        type: 'string',
        required: true,
        default: null,
        help: '',
        choices: null,
      },
      {
        name: 'password',
        type: 'string',
        required: true,
        default: null,
        help: '',
        choices: null,
      },
    ],
  },
};

const NO_AUTH_SCHEMA = {
  config_schema: { fields: [] },
  credentials_schema: null,
};

/**
 * Minimal Kysely stand-in. Lookups only find MOCK_BANK when the query filters
 * on MOCK_BANK's org, so org scoping is exercised rather than assumed.
 */
function makeMockKyselyPg(opts: { insertFails?: boolean } = {}) {
  const makeChain = () => {
    let orgFilter: unknown;
    const chain = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: opts.insertFails
        ? vi.fn().mockRejectedValue(new Error('insert failed'))
        : vi.fn().mockResolvedValue(MOCK_BANK),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn((col: string, _op: string, val: unknown) => {
        if (col === 'org_id') {
          orgFilter = val;
        }
        return chain;
      }),
      executeTakeFirst: vi.fn(async () =>
        orgFilter === MOCK_BANK.org_id ? MOCK_BANK : undefined,
      ),
      execute: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockReturnThis(),
    };
    return chain;
  };
  const deleteFrom = vi.fn(() => makeChain());
  return {
    db: {
      insertInto: vi.fn(() => makeChain()),
      selectFrom: vi.fn(() => makeChain()),
      updateTable: vi.fn(() => makeChain()),
      deleteFrom,
    } as unknown as ConstructorParameters<typeof HmaService>[1],
    deleteFrom,
  };
}

function makeService(
  fetchHTTP: Mock,
  opts: { insertFails?: boolean } = {},
): HmaService {
  return new HmaService(fetchHTTP as never, makeMockKyselyPg(opts).db);
}

type Res = { ok: boolean; status: number; body: unknown; headers: object };

function ok(body: unknown): Res {
  return { ok: true, status: 200, body, headers: {} };
}

function created(): Res {
  return { ok: true, status: 201, body: undefined, headers: {} };
}

function fail(status: number, body?: unknown): Res {
  return { ok: false, status, body, headers: {} };
}

/** Routes fetchHTTP calls by "METHOD path" (path relative to the HMA URL). */
function routeFetch(routes: Partial<Record<string, Res | (() => Res)>>): Mock {
  return vi.fn(async (req: { url: string; method: string }) => {
    const path = new URL(req.url).pathname.replace(/^\/+/, '/');
    const key = `${req.method.toUpperCase()} ${path}`;
    const route = routes[key];
    if (route === undefined) {
      throw new Error(`Unexpected request: ${key}`);
    }
    return typeof route === 'function' ? route() : route;
  });
}

function callsTo(fetchHTTP: Mock, method: string, pathPart: string) {
  return fetchHTTP.mock.calls
    .map(
      (c) =>
        c[0] as {
          url: string;
          method: string;
          body?: Parameters<typeof jsonParse>[0];
        },
    )
    .filter((c) => c.method === method && c.url.includes(pathPart));
}

async function errorText(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return e instanceof Error ? `${e.name} ${e.message} ${e.stack}` : String(e);
  }
  throw new Error('Expected promise to reject');
}

describe('HmaService', () => {
  describe('createBank', () => {
    it('creates a standalone bank via POST /c/banks when no exchange is provided', async () => {
      const fetchHTTP = routeFetch({
        'POST /c/banks': ok({ name: 'COOP_ORG1_MY_BANK' }),
      });
      const svc = makeService(fetchHTTP);

      const result = await svc.createBank('org1', 'My Bank', 'desc', 1.0);

      expect(result).toMatchObject({ name: 'test bank' });
      expect(fetchHTTP).toHaveBeenCalledTimes(1);
    });

    it('sends credential_json in POST /c/exchanges when credentials are provided', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
      });
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'ncmec',
        apiJson: { environment: 'https://hashsharing.ncmec.org/npo' },
        credentialJson: { user: 'u', password: SECRET },
      });

      const [call] = callsTo(fetchHTTP, 'post', '/c/exchanges');
      const body = jsonParse(call.body!);
      expect(body).toEqual({
        bank: 'COOP_ORG1_MY_BANK',
        api: 'ncmec',
        api_json: { environment: 'https://hashsharing.ncmec.org/npo' },
        credential_json: { user: 'u', password: SECRET },
      });
      expect(callsTo(fetchHTTP, 'post', '/credentials')).toHaveLength(0);
      expect(callsTo(fetchHTTP, 'post', '/c/exchanges/api/')).toHaveLength(0);
    });

    it('omits credential_json when the API takes no credentials', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/fb_threatexchange/schema': ok(NO_AUTH_SCHEMA),
        'POST /c/exchanges': created(),
      });
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'fb_threatexchange',
        apiJson: { privacy_group: 123 },
      });

      const [call] = callsTo(fetchHTTP, 'post', '/c/exchanges');
      expect(jsonParse(call.body!)).not.toHaveProperty('credential_json');
    });

    it('drops empty optional credential fields before sending', async () => {
      const schema = {
        config_schema: { fields: [] },
        credentials_schema: {
          fields: [
            ...NCMEC_SCHEMA.credentials_schema.fields,
            {
              name: 'base_url_override',
              type: 'string',
              required: false,
              default: null,
              help: '',
              choices: null,
            },
          ],
        },
      };
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(schema),
        'POST /c/exchanges': created(),
      });
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'ncmec',
        apiJson: {},
        credentialJson: { user: 'u', password: 'p', base_url_override: '' },
      });

      const [call] = callsTo(fetchHTTP, 'post', '/c/exchanges');
      expect(jsonParse(call.body!)).toMatchObject({
        credential_json: { user: 'u', password: 'p' },
      });
    });

    it('requires credentials when the API has a credentials_schema', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
      });
      const svc = makeService(fetchHTTP);

      const promise = svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'ncmec',
        apiJson: {},
      });

      await expect(promise).rejects.toBeInstanceOf(HashBankUserError);
      await expect(promise).rejects.toThrow('Missing: user, password');
      expect(callsTo(fetchHTTP, 'post', '/c/exchanges')).toHaveLength(0);
    });

    it('rejects missing required fields and names only the fields', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
      });
      const svc = makeService(fetchHTTP);

      const text = await errorText(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { password: SECRET },
        }),
      );

      expect(text).toContain('Missing: user');
      expect(text).not.toContain(SECRET);
    });

    it('rejects unknown credential fields', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
      });
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: 'p', token: SECRET },
        }),
      ).rejects.toThrow('Unexpected credential fields');
    });

    it('rejects credentials for an API that does not use them', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/fb_threatexchange/schema': ok(NO_AUTH_SCHEMA),
      });
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'fb_threatexchange',
          apiJson: {},
          credentialJson: { api_token: SECRET },
        }),
      ).rejects.toThrow('does not accept credentials');
    });

    it('updates enabled_ratio after exchange creation when not 1.0', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/fb_threatexchange/schema': ok(NO_AUTH_SCHEMA),
        'POST /c/exchanges': created(),
        'PUT /c/bank/COOP_ORG1_MY_BANK': ok({}),
      });
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 0.5, {
        apiName: 'fb_threatexchange',
        apiJson: { privacy_group: 123 },
      });

      expect(
        callsTo(fetchHTTP, 'put', '/c/bank/COOP_ORG1_MY_BANK'),
      ).toHaveLength(1);
    });

    it.each([400, 500, 501])(
      'never includes credential values when HMA returns %i',
      async (status) => {
        const fetchHTTP = routeFetch({
          'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
          'POST /c/exchanges': fail(status, {
            message: `echo ${SECRET}`,
            request: { password: SECRET },
          }),
        });
        const svc = makeService(fetchHTTP);

        const text = await errorText(
          svc.createBank('org1', 'My Bank', 'desc', 1.0, {
            apiName: 'ncmec',
            apiJson: {},
            credentialJson: { user: 'u', password: SECRET },
          }),
        );

        expect(text).not.toContain(SECRET);
        expect(text).toMatch(/status=\d+|rejected the credentials/);
      },
    );

    it('throws when HMA returns an error for standalone bank creation', async () => {
      const fetchHTTP = routeFetch({ 'POST /c/banks': fail(409) });
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0),
      ).rejects.toThrow('Failed to create HMA bank');
    });

    it('rolls back the exchange when the enabled_ratio update fails', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
        'PUT /c/bank/COOP_ORG1_MY_BANK': fail(500),
        'DELETE /c/exchange/COOP_ORG1_MY_BANK': ok({}),
      });
      const { db, deleteFrom } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 0.5, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: 'p' },
        }),
      ).rejects.toThrow('enabled_ratio');

      expect(
        callsTo(fetchHTTP, 'delete', '/c/exchange/COOP_ORG1_MY_BANK'),
      ).toHaveLength(1);
      expect(deleteFrom).not.toHaveBeenCalled();
    });

    it('still surfaces the original error when the rollback delete fails', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
        'DELETE /c/exchange/COOP_ORG1_MY_BANK': fail(500),
      });
      const svc = makeService(fetchHTTP, { insertFails: true });

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: SECRET },
        }),
      ).rejects.toThrow('insert failed');

      const logged = consoleError.mock.calls.flat().map(String).join(' ');
      expect(logged).toContain('status=500');
      expect(logged).not.toContain(SECRET);
      consoleError.mockRestore();
    });

    it('rolls back through DELETE /c/exchange when the local insert fails', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
        'DELETE /c/exchange/COOP_ORG1_MY_BANK': ok({}),
      });
      const svc = makeService(fetchHTTP, { insertFails: true });

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: 'p' },
        }),
      ).rejects.toThrow('insert failed');

      expect(
        callsTo(fetchHTTP, 'delete', '/c/exchange/COOP_ORG1_MY_BANK'),
      ).toHaveLength(1);
      expect(callsTo(fetchHTTP, 'delete', '/c/bank/')).toHaveLength(0);
    });
  });

  describe('setExchangeCredentials', () => {
    const statusBody = {
      supports_auth: true,
      has_credentials: true,
      source: 'exchange',
    };

    it('posts to /c/exchange/<hma_name>/credentials and returns the status', async () => {
      const fetchHTTP = routeFetch({
        'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': ok(statusBody),
      });
      const svc = makeService(fetchHTTP);

      const status = await svc.setExchangeCredentials('COOP_ORG1_TEST_BANK', {
        user: 'u',
        password: 'p',
      });

      expect(status).toEqual(statusBody);
      const [call] = callsTo(fetchHTTP, 'post', '/credentials');
      expect(jsonParse(call.body!)).toEqual({
        credential_json: { user: 'u', password: 'p' },
      });
    });

    it('clears credentials with credential_json: null', async () => {
      const fetchHTTP = routeFetch({
        'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': ok({
          supports_auth: true,
          has_credentials: false,
          source: null,
        }),
      });
      const svc = makeService(fetchHTTP);

      const status = await svc.setExchangeCredentials(
        'COOP_ORG1_TEST_BANK',
        null,
      );

      expect(status.has_credentials).toBe(false);
      const [call] = callsTo(fetchHTTP, 'post', '/credentials');
      expect(jsonParse(call.body!)).toEqual({ credential_json: null });
    });

    it.each([400, 404, 500, 501])(
      'never includes credential values when HMA returns %i',
      async (status) => {
        const fetchHTTP = routeFetch({
          'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': fail(status, {
            message: SECRET,
          }),
        });
        const svc = makeService(fetchHTTP);

        const text = await errorText(
          svc.setExchangeCredentials('COOP_ORG1_TEST_BANK', {
            user: 'u',
            password: SECRET,
          }),
        );

        expect(text).not.toContain(SECRET);
      },
    );
  });

  describe('setBankExchangeCredentials', () => {
    it("resolves the bank's hma_name within the caller's org", async () => {
      const fetchHTTP = routeFetch({
        'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': ok({
          supports_auth: true,
          has_credentials: true,
          source: 'exchange',
        }),
      });
      const svc = makeService(fetchHTTP);

      await svc.setBankExchangeCredentials('org1', 1, { user: 'u' });

      expect(callsTo(fetchHTTP, 'post', '/credentials')).toHaveLength(1);
    });

    it("refuses another org's bank without calling HMA", async () => {
      const fetchHTTP = routeFetch({});
      const svc = makeService(fetchHTTP);

      await expect(
        svc.setBankExchangeCredentials('org2', 1, { user: 'u' }),
      ).rejects.toThrow('Hash bank not found');
      expect(fetchHTTP).not.toHaveBeenCalled();
    });

    it('does not turn an all-empty submission into a clear', async () => {
      const fetchHTTP = routeFetch({});
      const svc = makeService(fetchHTTP);

      await expect(
        svc.setBankExchangeCredentials('org1', 1, { user: '', password: '' }),
      ).rejects.toBeInstanceOf(HashBankUserError);
      expect(fetchHTTP).not.toHaveBeenCalled();
    });
  });

  describe('getExchangeApis', () => {
    it('does not report the shared API-level credential state', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/apis': ok(['ncmec']),
        'GET /c/exchanges/api/ncmec': ok({
          supports_authentification: true,
          has_set_authentification: true,
        }),
      });
      const svc = makeService(fetchHTTP);

      expect(await svc.getExchangeApis()).toEqual([
        { name: 'ncmec', supports_auth: true },
      ]);
    });
  });

  describe('getExchangeForBank', () => {
    const fetchStatus = {
      last_fetch_succeeded: true,
      last_fetch_complete_ts: 1700000000,
      up_to_date: true,
      fetched_items: 42,
      running_fetch_start_ts: null,
      checkpoint_ts: 1700000000,
    };

    it('returns null when HMA returns 404 (no exchange configured)', async () => {
      const fetchHTTP = vi.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      expect(await svc.getExchangeForBank('COOP_ORG1_BANK')).toBeNull();
    });

    it('returns error info when HMA returns a non-404 error', async () => {
      const fetchHTTP = vi.fn().mockResolvedValue(fail(500));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.error).toContain('status 500');
    });

    it('returns error info when HMA is unreachable', async () => {
      const fetchHTTP = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.error).toContain('ECONNREFUSED');
    });

    it('maps credential_status to has_auth and credential_source', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_BANK': ok({
          api: 'ncmec',
          enabled: true,
          name: 'COOP_ORG1_BANK',
          credential_status: {
            supports_auth: true,
            has_credentials: true,
            source: 'exchange',
          },
        }),
        'GET /c/exchange/COOP_ORG1_BANK/status': ok(fetchStatus),
      });
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result).toEqual<ExchangeInfo>({
        api: 'ncmec',
        enabled: true,
        has_auth: true,
        credential_source: 'exchange',
        last_fetch_succeeded: true,
        last_fetch_time: new Date(1700000000 * 1000).toISOString(),
        up_to_date: true,
        fetched_items: 42,
        is_fetching: false,
      });
      expect(callsTo(fetchHTTP, 'get', '/c/exchanges/api/')).toHaveLength(0);
    });

    it.each(['api', 'environment', 'file'] as const)(
      'reports shared credentials with source %s',
      async (source) => {
        const fetchHTTP = routeFetch({
          'GET /c/exchange/COOP_ORG1_BANK': ok({
            api: 'ncmec',
            enabled: true,
            credential_status: {
              supports_auth: true,
              has_credentials: true,
              source,
            },
          }),
          'GET /c/exchange/COOP_ORG1_BANK/status': ok(fetchStatus),
        });
        const svc = makeService(fetchHTTP);

        const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

        expect(result!.has_auth).toBe(true);
        expect(result!.credential_source).toBe(source);
      },
    );

    it('reports no credentials when credential_status is missing or unknown', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_BANK': ok({
          api: 'ncmec',
          enabled: true,
          credential_status: { has_credentials: 'yes', source: 'elsewhere' },
        }),
        'GET /c/exchange/COOP_ORG1_BANK/status': ok(fetchStatus),
      });
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.has_auth).toBe(false);
      expect(result!.credential_source).toBeNull();
    });

    it('detects active fetch in progress', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_BANK': ok({ api: 'ncmec', enabled: true }),
        'GET /c/exchange/COOP_ORG1_BANK/status': ok({
          ...fetchStatus,
          running_fetch_start_ts: 1700001000,
        }),
      });
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.is_fetching).toBe(true);
    });

    it('gracefully handles status endpoint failure', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_BANK': ok({
          api: 'ncmec',
          enabled: true,
          credential_status: {
            supports_auth: true,
            has_credentials: true,
            source: 'exchange',
          },
        }),
        'GET /c/exchange/COOP_ORG1_BANK/status': () => {
          throw new Error('timeout');
        },
      });
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.has_auth).toBe(true);
      expect(result!.last_fetch_succeeded).toBeUndefined();
    });
  });

  describe('deleteBank', () => {
    it('deletes exchange-backed banks through DELETE /c/exchange', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': ok({ api: 'ncmec' }),
        'DELETE /c/exchange/COOP_ORG1_TEST_BANK': ok({}),
      });
      const svc = makeService(fetchHTTP);

      await svc.deleteBank('org1', '1');

      expect(callsTo(fetchHTTP, 'delete', '/c/exchange/')).toHaveLength(1);
      expect(callsTo(fetchHTTP, 'delete', '/c/bank/')).toHaveLength(0);
    });

    it('deletes standalone banks through DELETE /c/bank', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'DELETE /c/bank/COOP_ORG1_TEST_BANK': ok({}),
      });
      const svc = makeService(fetchHTTP);

      await svc.deleteBank('org1', '1');

      expect(callsTo(fetchHTTP, 'delete', '/c/bank/')).toHaveLength(1);
      expect(callsTo(fetchHTTP, 'delete', '/c/exchange/')).toHaveLength(0);
    });

    it('keeps the local row when HMA fails to delete', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': ok({ api: 'ncmec' }),
        'DELETE /c/exchange/COOP_ORG1_TEST_BANK': fail(500),
      });
      const { db, deleteFrom } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db);

      await expect(svc.deleteBank('org1', '1')).rejects.toThrow(
        'Failed to delete HMA bank',
      );
      expect(deleteFrom).not.toHaveBeenCalled();
    });

    it("refuses another org's bank without calling HMA", async () => {
      const fetchHTTP = routeFetch({});
      const svc = makeService(fetchHTTP);

      await expect(svc.deleteBank('org2', '1')).rejects.toThrow(
        'Bank not found',
      );
      expect(fetchHTTP).not.toHaveBeenCalled();
    });
  });

  describe('banks missing from HMA', () => {
    it('deletes any leftover exchange before dropping the local row', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/bank/COOP_ORG1_TEST_BANK': fail(404),
        'DELETE /c/exchange/COOP_ORG1_TEST_BANK': ok({}),
      });
      const { db, deleteFrom } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db);

      expect(await svc.getBankById('org1', 1)).toBeNull();
      expect(
        callsTo(fetchHTTP, 'delete', '/c/exchange/COOP_ORG1_TEST_BANK'),
      ).toHaveLength(1);
      expect(deleteFrom).toHaveBeenCalledTimes(1);
    });

    it('keeps the local row when the leftover exchange cannot be deleted', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/bank/COOP_ORG1_TEST_BANK': fail(404),
        'DELETE /c/exchange/COOP_ORG1_TEST_BANK': fail(500),
      });
      const { db, deleteFrom } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db);

      expect(await svc.getBankById('org1', 1)).toEqual(MOCK_BANK);
      expect(deleteFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateBank', () => {
    it('refuses to rename an exchange-backed bank', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': ok({ api: 'ncmec' }),
      });
      const svc = makeService(fetchHTTP);

      await expect(
        svc.updateBank('org1', '1', { name: 'renamed' }),
      ).rejects.toBeInstanceOf(HashBankUserError);
      expect(callsTo(fetchHTTP, 'post', '/c/banks')).toHaveLength(0);
    });
  });

  describe('getExchangeApiSchema', () => {
    it('returns schema from HMA when endpoint is available', async () => {
      const fetchHTTP = vi.fn().mockResolvedValue(ok(NCMEC_SCHEMA));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('ncmec');

      expect(result.credentials_schema!.fields).toHaveLength(2);
    });

    it('falls back to built-in schema when HMA endpoint fails', async () => {
      const fetchHTTP = vi.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('fb_threatexchange');

      expect(result.config_schema.fields).toHaveLength(1);
      expect(result.config_schema.fields[0].name).toBe('privacy_group');
    });

    it('falls back to built-in schema on network error', async () => {
      const fetchHTTP = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('ncmec');

      expect(result.config_schema.fields.length).toBeGreaterThan(0);
      expect(result.credentials_schema).not.toBeNull();
    });

    it('returns empty schema for unknown exchange type with no fallback', async () => {
      const fetchHTTP = vi.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('unknown_exchange');

      expect(result.config_schema.fields).toHaveLength(0);
      expect(result.credentials_schema).toBeNull();
    });
  });
});
