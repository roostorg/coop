import { HmaService, type ExchangeInfo } from './index.js';
import type { HashBank } from './dbTypes.js';
import { jsonParse } from '../../utils/encoding.js';

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

function makeMockKyselyPg() {
  const mockChain = {
    values: jest.fn().mockReturnThis(),
    returningAll: jest.fn().mockReturnThis(),
    executeTakeFirstOrThrow: jest.fn().mockResolvedValue(MOCK_BANK),
    selectAll: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    executeTakeFirst: jest.fn().mockResolvedValue(MOCK_BANK),
    execute: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockReturnThis(),
  };
  return {
    insertInto: jest.fn().mockReturnValue(mockChain),
    selectFrom: jest.fn().mockReturnValue(mockChain),
    updateTable: jest.fn().mockReturnValue(mockChain),
    deleteFrom: jest.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  } as unknown as ConstructorParameters<typeof HmaService>[1];
}

function makeService(fetchHTTP: jest.Mock) {
  return new HmaService(fetchHTTP as never, makeMockKyselyPg());
}

function ok(body: unknown) {
  return { ok: true, status: 200, body, headers: {} };
}

function created() {
  return { ok: true, status: 201, body: undefined, headers: {} };
}

function fail(status: number, body?: unknown) {
  return { ok: false, status, body, headers: {} };
}

describe('HmaService', () => {
  describe('createBank', () => {
    it('creates a standalone bank via POST /c/banks when no exchange is provided', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(ok({ name: 'COOP_ORG1_MY_BANK', matching_enabled_ratio: 1.0 }));
      const svc = makeService(fetchHTTP);

      const result = await svc.createBank('org1', 'My Bank', 'desc', 1.0);

      expect(result).toMatchObject({ name: 'test bank' });
      expect(fetchHTTP).toHaveBeenCalledTimes(1);
      const call = fetchHTTP.mock.calls[0][0];
      expect(call.url).toContain('/c/banks');
      expect(call.method).toBe('post');
    });

    it('creates a bank via POST /c/exchanges when exchange config is provided', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(created());
      const svc = makeService(fetchHTTP);

      const result = await svc.createBank('org1', 'My Bank', 'desc', 1.0, {
        apiName: 'fb_threatexchange',
        apiJson: { privacy_group: 123 },
      });

      expect(result).toMatchObject({ name: 'test bank' });
      const exchangeCall = fetchHTTP.mock.calls[0][0];
      expect(exchangeCall.url).toContain('/c/exchanges');
      expect(exchangeCall.method).toBe('post');
      const body = jsonParse(exchangeCall.body);
      expect(body.bank).toBe('COOP_ORG1_MY_BANK');
      expect(body.api).toBe('fb_threatexchange');
      expect(body.api_json).toEqual({ privacy_group: 123 });
    });

    it('updates enabled_ratio after exchange creation when not 1.0', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(created());
      const svc = makeService(fetchHTTP);

      await svc.createBank('org1', 'My Bank', 'desc', 0.5, {
        apiName: 'fb_threatexchange',
        apiJson: { privacy_group: 123 },
      });

      expect(fetchHTTP).toHaveBeenCalledTimes(2);
      const ratioCall = fetchHTTP.mock.calls[1][0];
      expect(ratioCall.url).toContain('/c/bank/COOP_ORG1_MY_BANK');
      expect(ratioCall.method).toBe('put');
    });

    it('throws when HMA returns an error for exchange creation', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(500));
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0, {
          apiName: 'fb_threatexchange',
          apiJson: { privacy_group: 123 },
        })
      ).rejects.toThrow('Failed to create exchange in HMA');
    });

    it('throws when HMA returns an error for standalone bank creation', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(409));
      const svc = makeService(fetchHTTP);

      await expect(
        svc.createBank('org1', 'My Bank', 'desc', 1.0)
      ).rejects.toThrow('Failed to create HMA bank');
    });
  });

  describe('setExchangeCredentials', () => {
    it('sends credentials to the correct endpoint', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(created());
      const svc = makeService(fetchHTTP);

      await svc.setExchangeCredentials('ncmec', { user: 'u', password: 'p' });

      expect(fetchHTTP).toHaveBeenCalledTimes(1);
      const call = fetchHTTP.mock.calls[0][0];
      expect(call.url).toContain('/c/exchanges/api/ncmec');
      expect(call.method).toBe('post');
      const body = jsonParse(call.body);
      expect(body.credential_json).toEqual({ user: 'u', password: 'p' });
    });

    it('throws when HMA returns an error', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(400));
      const svc = makeService(fetchHTTP);

      await expect(
        svc.setExchangeCredentials('ncmec', { user: 'u', password: 'p' })
      ).rejects.toThrow("Failed to set exchange credentials for 'ncmec'");
    });
  });

  describe('getExchangeForBank', () => {
    it('returns null when HMA returns 404 (no exchange configured)', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result).toBeNull();
    });

    it('returns error info when HMA returns a non-404 error', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(500));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result).not.toBeNull();
      expect(result!.error).toContain('status 500');
    });

    it('returns error info when HMA is unreachable', async () => {
      const fetchHTTP = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result).not.toBeNull();
      expect(result!.error).toContain('ECONNREFUSED');
    });

    it('returns full exchange info with fetch status on success', async () => {
      const fetchHTTP = jest.fn()
        .mockResolvedValueOnce(ok({
          api: 'fb_threatexchange',
          enabled: true,
          name: 'COOP_ORG1_BANK',
        }))
        .mockResolvedValueOnce(ok({
          supports_authentification: true,
          has_set_authentification: true,
        }))
        .mockResolvedValueOnce(ok({
          last_fetch_succeeded: true,
          last_fetch_complete_ts: 1700000000,
          up_to_date: true,
          fetched_items: 42,
          running_fetch_start_ts: null,
          checkpoint_ts: 1700000000,
        }));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result).toEqual<ExchangeInfo>({
        api: 'fb_threatexchange',
        enabled: true,
        has_auth: true,
        last_fetch_succeeded: true,
        last_fetch_time: new Date(1700000000 * 1000).toISOString(),
        up_to_date: true,
        fetched_items: 42,
        is_fetching: false,
      });
    });

    it('returns fetch failed status', async () => {
      const fetchHTTP = jest.fn()
        .mockResolvedValueOnce(ok({
          api: 'ncmec',
          enabled: true,
          name: 'COOP_ORG1_BANK',
        }))
        .mockResolvedValueOnce(ok({
          supports_authentification: true,
          has_set_authentification: false,
        }))
        .mockResolvedValueOnce(ok({
          last_fetch_succeeded: false,
          last_fetch_complete_ts: 1700000000,
          up_to_date: false,
          fetched_items: 0,
          running_fetch_start_ts: null,
          checkpoint_ts: null,
        }));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.last_fetch_succeeded).toBe(false);
      expect(result!.has_auth).toBe(false);
      expect(result!.fetched_items).toBe(0);
    });

    it('detects active fetch in progress', async () => {
      const fetchHTTP = jest.fn()
        .mockResolvedValueOnce(ok({
          api: 'fb_threatexchange',
          enabled: true,
          name: 'COOP_ORG1_BANK',
        }))
        .mockResolvedValueOnce(ok({
          supports_authentification: true,
          has_set_authentification: true,
        }))
        .mockResolvedValueOnce(ok({
          last_fetch_succeeded: true,
          last_fetch_complete_ts: 1700000000,
          up_to_date: false,
          fetched_items: 10,
          running_fetch_start_ts: 1700001000,
          checkpoint_ts: 1700000000,
        }));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.is_fetching).toBe(true);
    });

    it('gracefully handles status endpoint failure', async () => {
      const fetchHTTP = jest.fn()
        .mockResolvedValueOnce(ok({
          api: 'fb_threatexchange',
          enabled: true,
          name: 'COOP_ORG1_BANK',
        }))
        .mockResolvedValueOnce(ok({
          supports_authentification: true,
          has_set_authentification: true,
        }))
        .mockRejectedValueOnce(new Error('timeout'));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeForBank('COOP_ORG1_BANK');

      expect(result!.api).toBe('fb_threatexchange');
      expect(result!.has_auth).toBe(true);
      expect(result!.last_fetch_succeeded).toBeUndefined();
    });
  });

  describe('getExchangeApiSchema', () => {
    it('returns schema from HMA when endpoint is available', async () => {
      const hmaSchema = {
        config_schema: {
          fields: [{ name: 'privacy_group', type: 'number', required: true, default: null, help: 'PG ID', choices: null }],
        },
        credentials_schema: {
          fields: [{ name: 'api_token', type: 'string', required: true, default: null, help: 'Token', choices: null }],
        },
      };
      const fetchHTTP = jest.fn().mockResolvedValue(ok(hmaSchema));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('fb_threatexchange');

      expect(result.config_schema.fields).toHaveLength(1);
      expect(result.config_schema.fields[0].name).toBe('privacy_group');
    });

    it('falls back to built-in schema when HMA endpoint fails', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('fb_threatexchange');

      expect(result.config_schema.fields).toHaveLength(1);
      expect(result.config_schema.fields[0].name).toBe('privacy_group');
    });

    it('falls back to built-in schema on network error', async () => {
      const fetchHTTP = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('ncmec');

      expect(result.config_schema.fields.length).toBeGreaterThan(0);
      expect(result.credentials_schema).not.toBeNull();
    });

    it('returns empty schema for unknown exchange type with no fallback', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue(fail(404));
      const svc = makeService(fetchHTTP);

      const result = await svc.getExchangeApiSchema('unknown_exchange');

      expect(result.config_schema.fields).toHaveLength(0);
      expect(result.credentials_schema).toBeNull();
    });
  });
});
