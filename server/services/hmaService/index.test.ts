import { vi, type Mock } from 'vitest';

import { jsonParse } from '../../utils/encoding.js';
import type { HashBank } from './dbTypes.js';
import {
  HashBankUserError,
  HmaService,
  type ExchangeInfo,
  type HashBankService,
} from './index.js';

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

type MockDbOpts = {
  // Makes inserts and updates reject.
  writesFail?: boolean;
  // hma_names already used by some bank, in any org.
  takenHmaNames?: string[];
};

/**
 * Minimal Kysely stand-in holding MOCK_BANK. Lookups apply their filters, so
 * a query only finds MOCK_BANK when it's scoped to MOCK_BANK's org.
 */
function makeMockKyselyPg(opts: MockDbOpts = {}) {
  const set = vi.fn();
  const makeChain = () => {
    let filters: Record<string, unknown> = {};
    const chain = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: opts.writesFail
        ? vi.fn().mockRejectedValue(new Error('write failed'))
        : vi.fn().mockResolvedValue(MOCK_BANK),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn((col: string, _op: string, val: unknown) => {
        filters = { ...filters, [col]: val };
        return chain;
      }),
      executeTakeFirst: vi.fn(async () => {
        if ('hma_name' in filters) {
          const hmaName = String(filters.hma_name);
          return hmaName === MOCK_BANK.hma_name ||
            (opts.takenHmaNames ?? []).includes(hmaName)
            ? { id: 99 }
            : undefined;
        }
        if (filters.org_id !== MOCK_BANK.org_id) {
          return undefined;
        }
        if ('name' in filters && filters.name !== MOCK_BANK.name) {
          return undefined;
        }
        return MOCK_BANK;
      }),
      execute: vi.fn().mockResolvedValue([]),
      set: vi.fn((values: unknown) => {
        set(values);
        return chain;
      }),
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
    // Values passed to each UPDATE ... SET so far.
    updates: () => set.mock.calls.map(([values]) => values as unknown),
  };
}

function makeTracer() {
  return {
    logActiveSpanFailedIfAny: vi.fn(),
  } as unknown as ConstructorParameters<typeof HmaService>[2] & {
    logActiveSpanFailedIfAny: Mock;
  };
}

function makeService(
  fetchHTTP: Mock,
  opts: MockDbOpts & { tracer?: ReturnType<typeof makeTracer> } = {},
): HmaService {
  return new HmaService(
    fetchHTTP as never,
    makeMockKyselyPg(opts).db,
    opts.tracer ?? makeTracer(),
  );
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

/**
 * Routes fetchHTTP calls by "METHOD path" (path relative to the HMA URL).
 * Unless a test says otherwise, HMA has no bank named COOP_ORG1_MY_BANK or
 * COOP_ORG1_RENAMED, so those names are free.
 */
function routeFetch(routes: Partial<Record<string, Res | (() => Res)>>): Mock {
  const allRoutes: Partial<Record<string, Res | (() => Res)>> = {
    'GET /c/bank/COOP_ORG1_MY_BANK': fail(404),
    'GET /c/bank/COOP_ORG1_RENAMED': fail(404),
    ...routes,
  };
  return vi.fn(async (req: { url: string; method: string }) => {
    const path = new URL(req.url).pathname.replace(/^\/+/, '/');
    const key = `${req.method.toUpperCase()} ${path}`;
    const route = allRoutes[key];
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
      const [call] = callsTo(fetchHTTP, 'post', '/c/banks');
      expect(jsonParse(call.body!)).toMatchObject({
        name: 'COOP_ORG1_MY_BANK',
      });
    });

    it('rejects a display name the org already uses without calling HMA', async () => {
      const fetchHTTP = routeFetch({});
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', MOCK_BANK.name, 'desc', 1.0),
      ).rejects.toMatchObject({ name: 'MatchingBankNameExistsError' });
      expect(fetchHTTP).not.toHaveBeenCalled();
    });

    it('adds a suffix when the normalized HMA name is taken in Coop', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/bank/COOP_ORG1_MY_BANK_2': fail(404),
        'POST /c/banks': ok({}),
      });
      const svc = makeService(fetchHTTP, {
        takenHmaNames: ['COOP_ORG1_MY_BANK'],
      });

      await svc.createBank('org1', 'my-bank', 'desc', 1.0);

      const [call] = callsTo(fetchHTTP, 'post', '/c/banks');
      expect(jsonParse(call.body!)).toMatchObject({
        name: 'COOP_ORG1_MY_BANK_2',
      });
    });

    it('adds a suffix when HMA already has a bank with the normalized name', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/bank/COOP_ORG1_MY_BANK': ok({}),
        'GET /c/bank/COOP_ORG1_MY_BANK_2': fail(404),
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
      });
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'ncmec',
        apiJson: {},
        credentialJson: { user: 'u', password: 'p' },
      });

      const [call] = callsTo(fetchHTTP, 'post', '/c/exchanges');
      expect(jsonParse(call.body!)).toMatchObject({
        bank: 'COOP_ORG1_MY_BANK_2',
      });
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
        expect(text).toMatch(/status=\d+|rejected the configuration/);
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
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

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
      const tracer = makeTracer();
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
        'DELETE /c/exchange/COOP_ORG1_MY_BANK': fail(500),
      });
      const svc = makeService(fetchHTTP, { writesFail: true, tracer });

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: SECRET },
        }),
      ).rejects.toThrow('write failed');

      expect(tracer.logActiveSpanFailedIfAny).toHaveBeenCalledTimes(1);
      const [logged] = tracer.logActiveSpanFailedIfAny.mock.calls[0];
      expect(String(logged)).toContain('status=500');
      expect(String(logged)).not.toContain(SECRET);
    });

    it.each([
      [
        'a network error',
        async () => {
          throw new Error('socket hang up');
        },
      ],
      ['a 5xx', async () => fail(502)],
    ])(
      'rolls back the exchange when its creation fails with %s',
      async (_label, createResponse) => {
        const fetchHTTP = vi.fn(
          async (req: { url: string; method: string }) => {
            if (req.url.endsWith('/schema')) return ok(NCMEC_SCHEMA);
            if (req.method === 'get') return fail(404);
            if (req.method === 'post') return createResponse();
            return ok({});
          },
        );
        const svc = makeService(fetchHTTP);

        await expect(
          svc.createBank('org1', 'My Bank', 'desc', 1.0, {
            apiName: 'ncmec',
            apiJson: {},
            credentialJson: { user: 'u', password: 'p' },
          }),
        ).rejects.toThrow();

        expect(
          callsTo(fetchHTTP, 'delete', '/c/exchange/COOP_ORG1_MY_BANK'),
        ).toHaveLength(1);
      },
    );

    it.each([400, 409])(
      'does not delete by name when HMA rejects the creation with %i',
      async (status) => {
        const fetchHTTP = routeFetch({
          'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
          'POST /c/exchanges': fail(status),
        });
        const svc = makeService(fetchHTTP);

        await expect(
          svc.createBank('org1', 'My Bank', 'desc', 1.0, {
            apiName: 'ncmec',
            apiJson: {},
            credentialJson: { user: 'u', password: 'p' },
          }),
        ).rejects.toThrow();

        expect(callsTo(fetchHTTP, 'delete', '/')).toHaveLength(0);
      },
    );

    it('rolls back through DELETE /c/exchange when the local insert fails', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
        'POST /c/exchanges': created(),
        'DELETE /c/exchange/COOP_ORG1_MY_BANK': ok({}),
      });
      const svc = makeService(fetchHTTP, { writesFail: true });

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'ncmec',
          apiJson: {},
          credentialJson: { user: 'u', password: 'p' },
        }),
      ).rejects.toThrow('write failed');

      expect(
        callsTo(fetchHTTP, 'delete', '/c/exchange/COOP_ORG1_MY_BANK'),
      ).toHaveLength(1);
      expect(callsTo(fetchHTTP, 'delete', '/c/bank/')).toHaveLength(0);
    });
  });

  describe('setBankExchangeCredentials', () => {
    const exchangeRoutes = {
      'GET /c/exchange/COOP_ORG1_TEST_BANK': ok({ api: 'ncmec' }),
      'GET /c/exchanges/api/ncmec/schema': ok(NCMEC_SCHEMA),
    };

    it('posts to /c/exchange/<hma_name>/credentials and returns the status', async () => {
      const fetchHTTP = routeFetch({
        ...exchangeRoutes,
        'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': ok({
          supports_auth: true,
          has_credentials: true,
          source: 'exchange',
        }),
      });
      const svc = makeService(fetchHTTP);

      const status = await svc.setBankExchangeCredentials('org1', 1, {
        user: 'u',
        password: 'p',
      });

      expect(status).toEqual({
        has_credentials: true,
        has_own_credentials: true,
      });
      const [call] = callsTo(fetchHTTP, 'post', '/credentials');
      expect(jsonParse(call.body!)).toEqual({
        credential_json: { user: 'u', password: 'p' },
      });
    });

    it("refuses another org's bank without calling HMA", async () => {
      const fetchHTTP = routeFetch({});
      const svc = makeService(fetchHTTP);

      await expect(
        svc.setBankExchangeCredentials('org2', 1, { user: 'u' }),
      ).rejects.toThrow('Hash bank not found');
      expect(fetchHTTP).not.toHaveBeenCalled();
    });

    it('refuses banks that are not connected to an exchange', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
      });
      const svc = makeService(fetchHTTP);

      await expect(
        svc.setBankExchangeCredentials('org1', 1, { user: 'u' }),
      ).rejects.toThrow('not connected to an exchange');
      expect(callsTo(fetchHTTP, 'post', '/credentials')).toHaveLength(0);
    });

    it.each([
      ['missing required fields', { user: 'u' }, 'Missing: password'],
      [
        'unknown fields',
        { user: 'u', password: 'p', token: SECRET },
        'Unexpected credential fields',
      ],
      ['an all-empty submission', { user: '', password: '' }, 'Missing'],
    ])(
      'validates against the API schema and rejects %s',
      async (_label, credentials, message) => {
        const fetchHTTP = routeFetch(exchangeRoutes);
        const svc = makeService(fetchHTTP);

        const text = await errorText(
          svc.setBankExchangeCredentials('org1', 1, credentials),
        );

        expect(text).toContain(message);
        expect(text).not.toContain(SECRET);
        expect(callsTo(fetchHTTP, 'post', '/credentials')).toHaveLength(0);
      },
    );

    it.each([400, 404, 500, 501])(
      'never includes credential values when HMA returns %i',
      async (status) => {
        const fetchHTTP = routeFetch({
          ...exchangeRoutes,
          'POST /c/exchange/COOP_ORG1_TEST_BANK/credentials': fail(status, {
            message: SECRET,
          }),
        });
        const svc = makeService(fetchHTTP);

        const text = await errorText(
          svc.setBankExchangeCredentials('org1', 1, {
            user: 'u',
            password: SECRET,
          }),
        );

        expect(text).not.toContain(SECRET);
      },
    );
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

    it('maps credential_status to has_auth and has_own_credentials', async () => {
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
        has_own_credentials: true,
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
        expect(result!.has_own_credentials).toBe(false);
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
      expect(result!.has_own_credentials).toBe(false);
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
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

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
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

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
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      expect(await svc.getBankById('org1', 1)).toEqual(MOCK_BANK);
      expect(deleteFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateBank', () => {
    it('renames a plain bank in place in HMA so it keeps its content', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'PUT /c/bank/COOP_ORG1_TEST_BANK': ok({}),
      });
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await svc.updateBank('org1', '1', { name: 'renamed' });

      const [call] = callsTo(fetchHTTP, 'put', '/c/bank/COOP_ORG1_TEST_BANK');
      expect(jsonParse(call.body!)).toEqual({ name: 'COOP_ORG1_RENAMED' });
      expect(callsTo(fetchHTTP, 'post', '/')).toHaveLength(0);
      expect(callsTo(fetchHTTP, 'delete', '/')).toHaveLength(0);
      expect(updates()).toEqual([
        { name: 'renamed', hma_name: 'COOP_ORG1_RENAMED' },
      ]);
    });

    it('renames only the display name of an exchange-backed bank', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': ok({ api: 'ncmec' }),
      });
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await svc.updateBank('org1', '1', { name: 'renamed' });

      expect(callsTo(fetchHTTP, 'put', '/')).toHaveLength(0);
      expect(updates()).toEqual([{ name: 'renamed' }]);
    });

    it('adds a suffix when the new normalized HMA name is taken', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'GET /c/bank/COOP_ORG1_RENAMED_2': fail(404),
        'PUT /c/bank/COOP_ORG1_TEST_BANK': ok({}),
      });
      const { db, updates } = makeMockKyselyPg({
        takenHmaNames: ['COOP_ORG1_RENAMED'],
      });
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await svc.updateBank('org1', '1', { name: 'Renamed!' });

      const [call] = callsTo(fetchHTTP, 'put', '/c/bank/COOP_ORG1_TEST_BANK');
      expect(jsonParse(call.body!)).toEqual({ name: 'COOP_ORG1_RENAMED_2' });
      expect(updates()).toEqual([
        { name: 'Renamed!', hma_name: 'COOP_ORG1_RENAMED_2' },
      ]);
    });

    it('keeps its HMA name when a rename normalizes to the same one', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
      });
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await svc.updateBank('org1', '1', { name: 'Test Bank' });

      expect(callsTo(fetchHTTP, 'put', '/')).toHaveLength(0);
      expect(updates()).toEqual([{ name: 'Test Bank' }]);
    });

    it('maps HMA’s 403 for a taken bank name to the name-exists error', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'PUT /c/bank/COOP_ORG1_TEST_BANK': fail(403),
      });
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await expect(
        svc.updateBank('org1', '1', { name: 'renamed' }),
      ).rejects.toMatchObject({ name: 'MatchingBankNameExistsError' });
      expect(updates()).toHaveLength(0);
    });

    it('renames the HMA bank back if the local update fails', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'PUT /c/bank/COOP_ORG1_TEST_BANK': ok({}),
        'PUT /c/bank/COOP_ORG1_RENAMED': ok({}),
      });
      const svc = makeService(fetchHTTP, { writesFail: true });

      await expect(
        svc.updateBank('org1', '1', { name: 'renamed' }),
      ).rejects.toThrow('write failed');

      const [revert] = callsTo(fetchHTTP, 'put', '/c/bank/COOP_ORG1_RENAMED');
      expect(jsonParse(revert.body!)).toEqual({ name: 'COOP_ORG1_TEST_BANK' });
    });

    it('rejects renaming to a name the org already uses', async () => {
      const fetchHTTP = routeFetch({});
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());
      const otherBank = { ...MOCK_BANK, id: 2, name: 'other' };
      vi.spyOn(
        (svc as unknown as { hashBankService: HashBankService })
          .hashBankService,
        'findById',
      ).mockResolvedValue(otherBank);

      await expect(
        svc.updateBank('org1', '2', { name: MOCK_BANK.name }),
      ).rejects.toMatchObject({ name: 'MatchingBankNameExistsError' });
      expect(updates()).toHaveLength(0);
    });

    it('sends the rename and enabled_ratio to HMA in one update', async () => {
      const fetchHTTP = routeFetch({
        'GET /c/exchange/COOP_ORG1_TEST_BANK': fail(404),
        'PUT /c/bank/COOP_ORG1_TEST_BANK': ok({}),
      });
      const { db, updates } = makeMockKyselyPg();
      const svc = new HmaService(fetchHTTP as never, db, makeTracer());

      await svc.updateBank('org1', '1', {
        name: 'renamed',
        enabled_ratio: 0.5,
      });

      const calls = callsTo(fetchHTTP, 'put', '/c/bank/COOP_ORG1_TEST_BANK');
      expect(calls).toHaveLength(1);
      expect(jsonParse(calls[0].body!)).toEqual({
        name: 'COOP_ORG1_RENAMED',
        enabled_ratio: 0.5,
      });
      expect(updates()).toEqual([
        {
          name: 'renamed',
          hma_name: 'COOP_ORG1_RENAMED',
          enabled_ratio: 0.5,
        },
      ]);
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
