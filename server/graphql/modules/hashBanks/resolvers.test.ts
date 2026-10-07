import { vi, type Mock } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  HashBankUserError,
  type HashBank,
} from '../../../services/hmaService/index.js';
import { resolvers } from './resolvers.js';

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

function makeContext(overrides: Record<string, Mock> = {}) {
  return {
    getUser: () => ({ orgId: 'org1' }),
    services: {
      HMAHashBankService: {
        createBank: vi.fn().mockResolvedValue(MOCK_BANK),
        setExchangeCredentials: vi.fn(),
        setBankExchangeCredentials: vi.fn().mockResolvedValue({
          has_credentials: true,
          has_own_credentials: true,
        }),
        getExchangeForBank: vi.fn().mockResolvedValue(null),
        getExchangeApis: vi
          .fn()
          .mockResolvedValue([{ name: 'ncmec', supports_auth: true }]),
        ...overrides,
      },
    },
  };
}

async function errorText(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return e instanceof Error ? `${e.message} ${e.stack}` : String(e);
  }
  throw new Error('Expected promise to reject');
}

describe('hashBanks resolvers', () => {
  describe('Mutation.createHashBank', () => {
    it('creates a bank without exchange', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1,
      };

      const result = await (resolvers.Mutation as any).createHashBank(
        {},
        { input },
        ctx,
      );

      expect(result).toHaveProperty('data');
      expect(ctx.services.HMAHashBankService.createBank).toHaveBeenCalledWith(
        'org1',
        'test bank',
        'desc',
        1,
        undefined,
      );
    });

    it('passes the credentials to createBank instead of setting them separately', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1,
        exchange: {
          api_name: 'fb_threatexchange',
          config_json: '{"privacy_group":123}',
          credentials_json: '{"api_token":"tok"}',
        },
      };

      const result = await (resolvers.Mutation as any).createHashBank(
        {},
        { input },
        ctx,
      );

      expect(result).toHaveProperty('data');
      expect(result.warning).toBeUndefined();
      expect(ctx.services.HMAHashBankService.createBank).toHaveBeenCalledWith(
        'org1',
        'test bank',
        'desc',
        1,
        {
          apiName: 'fb_threatexchange',
          apiJson: { privacy_group: 123 },
          credentialJson: { api_token: 'tok' },
        },
      );
      expect(
        ctx.services.HMAHashBankService.setExchangeCredentials,
      ).not.toHaveBeenCalled();
    });

    it('omits credentials when credentials_json is absent', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        enabled_ratio: 1,
        exchange: { api_name: 'stop_ncii', config_json: '{}' },
      };

      await (resolvers.Mutation as any).createHashBank({}, { input }, ctx);

      expect(
        ctx.services.HMAHashBankService.createBank.mock.calls[0][4],
      ).toEqual({
        apiName: 'stop_ncii',
        apiJson: {},
        credentialJson: undefined,
      });
    });

    it('rejects malformed credentials_json without echoing it', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        enabled_ratio: 1,
        exchange: {
          api_name: 'ncmec',
          config_json: '{}',
          credentials_json: `{"user":"u","password":${SECRET}}`,
        },
      };

      const text = await errorText(
        (resolvers.Mutation as any).createHashBank({}, { input }, ctx),
      );

      expect(text).toContain('must be a valid JSON object');
      expect(text).not.toContain(SECRET);
      expect(ctx.services.HMAHashBankService.createBank).not.toHaveBeenCalled();
    });

    it('rejects non-scalar credential values', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        enabled_ratio: 1,
        exchange: {
          api_name: 'ncmec',
          config_json: '{}',
          credentials_json: '{"user":{"nested":true}}',
        },
      };

      await expect(
        (resolvers.Mutation as any).createHashBank({}, { input }, ctx),
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    });

    it('surfaces HashBankUserError as BAD_USER_INPUT', async () => {
      const ctx = makeContext({
        createBank: vi
          .fn()
          .mockRejectedValue(new HashBankUserError('Missing: user')),
      });
      const input = {
        name: 'test bank',
        enabled_ratio: 1,
        exchange: { api_name: 'ncmec', config_json: '{}' },
      };

      await expect(
        (resolvers.Mutation as any).createHashBank({}, { input }, ctx),
      ).rejects.toMatchObject({
        message: 'Missing: user',
        extensions: { code: 'BAD_USER_INPUT' },
      });
    });
  });

  describe('Mutation.updateHashBankExchangeCredentials', () => {
    it("scopes the update to the caller's org and bank", async () => {
      const ctx = makeContext();

      const result = await (
        resolvers.Mutation as any
      ).updateHashBankExchangeCredentials(
        {},
        { bankId: '1', credentialsJson: '{"user":"u","password":"p"}' },
        ctx,
      );

      expect(result).toEqual({
        has_credentials: true,
        has_own_credentials: true,
      });
      expect(
        ctx.services.HMAHashBankService.setBankExchangeCredentials,
      ).toHaveBeenCalledWith('org1', 1, { user: 'u', password: 'p' });
    });

    it("returns not-found for another org's bank", async () => {
      const ctx = makeContext({
        setBankExchangeCredentials: vi
          .fn()
          .mockRejectedValue(new HashBankUserError('Hash bank not found.')),
      });

      await expect(
        (resolvers.Mutation as any).updateHashBankExchangeCredentials(
          {},
          { bankId: '99', credentialsJson: '{"user":"u"}' },
          ctx,
        ),
      ).rejects.toMatchObject({
        message: 'Hash bank not found.',
        extensions: { code: 'BAD_USER_INPUT' },
      });
    });

    it('rejects malformed credentialsJson without echoing it', async () => {
      const ctx = makeContext();

      const text = await errorText(
        (resolvers.Mutation as any).updateHashBankExchangeCredentials(
          {},
          { bankId: '1', credentialsJson: `{"password":${SECRET}}` },
          ctx,
        ),
      );

      expect(text).not.toContain(SECRET);
      expect(
        ctx.services.HMAHashBankService.setBankExchangeCredentials,
      ).not.toHaveBeenCalled();
    });

    it('requires an authenticated user with an org', async () => {
      const ctx = { ...makeContext(), getUser: () => null };

      await expect(
        (resolvers.Mutation as any).updateHashBankExchangeCredentials(
          {},
          { bankId: '1', credentialsJson: '{"user":"u"}' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });
  });

  describe('Mutation.updateExchangeCredentials (deprecated)', () => {
    it('always refuses and never writes API-level credentials', async () => {
      const ctx = makeContext();

      await expect(
        (resolvers.Mutation as any).updateExchangeCredentials(
          {},
          { apiName: 'ncmec', credentialsJson: '{"user":"u"}' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
      expect(
        ctx.services.HMAHashBankService.setExchangeCredentials,
      ).not.toHaveBeenCalled();
      expect(
        ctx.services.HMAHashBankService.setBankExchangeCredentials,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Query.exchangeApis', () => {
    it('reports the deprecated has_auth as false', async () => {
      const ctx = makeContext();

      const result = await (resolvers.Query as any).exchangeApis({}, {}, ctx);

      expect(result).toEqual([
        { name: 'ncmec', supports_auth: true, has_auth: false },
      ]);
    });
  });

  describe('HashBank.exchange', () => {
    it('resolves exchange info for a bank', async () => {
      const exchangeInfo = {
        api: 'fb_threatexchange',
        enabled: true,
        has_auth: true,
        has_own_credentials: true,
        last_fetch_succeeded: true,
      };
      const ctx = makeContext({
        getExchangeForBank: vi.fn().mockResolvedValue(exchangeInfo),
      });

      const result = await (resolvers as any).HashBank.exchange(
        { hma_name: 'COOP_ORG1_TEST_BANK' },
        {},
        ctx,
      );

      expect(result).toEqual(exchangeInfo);
      expect(
        ctx.services.HMAHashBankService.getExchangeForBank,
      ).toHaveBeenCalledWith('COOP_ORG1_TEST_BANK');
    });

    it('returns null when no exchange is configured', async () => {
      const ctx = makeContext();

      const result = await (resolvers as any).HashBank.exchange(
        { hma_name: 'COOP_ORG1_STANDALONE' },
        {},
        ctx,
      );

      expect(result).toBeNull();
    });
  });
});
