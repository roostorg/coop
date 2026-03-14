/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolvers } from './resolvers.js';
import type { HashBank } from '../../../services/hmaService/dbTypes.js';

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

function makeContext(overrides: Record<string, jest.Mock> = {}) {
  return {
    getUser: () => ({ orgId: 'org1' }),
    services: {
      HMAHashBankService: {
        createBank: jest.fn().mockResolvedValue(MOCK_BANK),
        setExchangeCredentials: jest.fn().mockResolvedValue(undefined),
        getExchangeForBank: jest.fn().mockResolvedValue(null),
        ...overrides,
      },
    },
  };
}

describe('hashBanks resolvers', () => {
  describe('Mutation.createHashBank', () => {
    it('creates a bank without exchange', async () => {
      const ctx = makeContext();
      const input = { name: 'test bank', description: 'desc', enabled_ratio: 1.0 };

      const result = await (resolvers.Mutation as any).createHashBank({}, { input }, ctx);

      expect(result).toHaveProperty('data');
      expect(ctx.services.HMAHashBankService.createBank).toHaveBeenCalledWith(
        'org1', 'test bank', 'desc', 1.0, undefined
      );
      expect(ctx.services.HMAHashBankService.setExchangeCredentials).not.toHaveBeenCalled();
    });

    it('creates a bank with exchange and credentials', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1.0,
        exchange: {
          api_name: 'fb_threatexchange',
          config_json: '{"privacy_group":123}',
          credentials_json: '{"api_token":"tok"}',
        },
      };

      const result = await (resolvers.Mutation as any).createHashBank({}, { input }, ctx);

      expect(result).toHaveProperty('data');
      expect(ctx.services.HMAHashBankService.createBank).toHaveBeenCalledWith(
        'org1', 'test bank', 'desc', 1.0,
        { apiName: 'fb_threatexchange', apiJson: { privacy_group: 123 } }
      );
      expect(ctx.services.HMAHashBankService.setExchangeCredentials).toHaveBeenCalledWith(
        'fb_threatexchange', { api_token: 'tok' }
      );
    });

    it('returns success with warning when credentials fail', async () => {
      const ctx = makeContext({
        createBank: jest.fn().mockResolvedValue(MOCK_BANK),
        setExchangeCredentials: jest.fn().mockRejectedValue(new Error('cred error')),
      });
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1.0,
        exchange: {
          api_name: 'ncmec',
          config_json: '{"environment":"https://test.ncmec.org"}',
          credentials_json: '{"user":"u","password":"p"}',
        },
      };

      const result = await (resolvers.Mutation as any).createHashBank({}, { input }, ctx);

      expect(result).toHaveProperty('data');
      expect(result.warning).toContain('credentials could not be set');
    });

    it('does not set credentials when credentials_json is absent', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1.0,
        exchange: {
          api_name: 'stop_ncii',
          config_json: '{}',
        },
      };

      await (resolvers.Mutation as any).createHashBank({}, { input }, ctx);

      expect(ctx.services.HMAHashBankService.setExchangeCredentials).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateExchangeCredentials', () => {
    it('calls setExchangeCredentials and returns true', async () => {
      const ctx = makeContext();

      const result = await (resolvers.Mutation as any).updateExchangeCredentials(
        {},
        { apiName: 'ncmec', credentialsJson: '{"user":"u","password":"p"}' },
        ctx
      );

      expect(result).toBe(true);
      expect(ctx.services.HMAHashBankService.setExchangeCredentials).toHaveBeenCalledWith(
        'ncmec', { user: 'u', password: 'p' }
      );
    });
  });

  describe('HashBank.exchange', () => {
    it('resolves exchange info for a bank', async () => {
      const exchangeInfo = {
        api: 'fb_threatexchange',
        enabled: true,
        has_auth: true,
        last_fetch_succeeded: true,
      };
      const ctx = makeContext({
        getExchangeForBank: jest.fn().mockResolvedValue(exchangeInfo),
      });

      const result = await (resolvers as any).HashBank.exchange(
        { hma_name: 'COOP_ORG1_TEST_BANK' }, {}, ctx
      );

      expect(result).toEqual(exchangeInfo);
      expect(ctx.services.HMAHashBankService.getExchangeForBank).toHaveBeenCalledWith(
        'COOP_ORG1_TEST_BANK'
      );
    });

    it('returns null when no exchange is configured', async () => {
      const ctx = makeContext();

      const result = await (resolvers as any).HashBank.exchange(
        { hma_name: 'COOP_ORG1_STANDALONE' }, {}, ctx
      );

      expect(result).toBeNull();
    });
  });
});
