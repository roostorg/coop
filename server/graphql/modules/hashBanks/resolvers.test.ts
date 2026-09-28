import { vi, type Mock } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HashBank } from '../../../services/hmaService/index.js';
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

function makeContext(overrides: Record<string, Mock> = {}) {
  return {
    getUser: () => ({ orgId: 'org1' }),
    services: {
      HMAHashBankService: {
        createBank: vi.fn().mockResolvedValue(MOCK_BANK),
        setExchangeCredentials: vi.fn().mockResolvedValue(undefined),
        getExchangeForBank: vi.fn().mockResolvedValue(null),
        ...overrides,
      },
    },
  };
}

describe('hashBanks resolvers', () => {
  describe('Mutation.createHashBank', () => {
    it('creates a bank without exchange', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1.0,
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
        1.0,
        undefined,
      );
      expect(
        ctx.services.HMAHashBankService.setExchangeCredentials,
      ).not.toHaveBeenCalled();
    });

    it('creates a bank with exchange configuration', async () => {
      const ctx = makeContext();
      const input = {
        name: 'test bank',
        description: 'desc',
        enabled_ratio: 1.0,
        exchange: {
          api_name: 'fb_threatexchange',
          config_json: '{"privacy_group":123}',
        },
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
        1.0,
        { apiName: 'fb_threatexchange', apiJson: { privacy_group: 123 } },
      );
      expect(
        ctx.services.HMAHashBankService.setExchangeCredentials,
      ).not.toHaveBeenCalled();
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

      expect(
        ctx.services.HMAHashBankService.setExchangeCredentials,
      ).not.toHaveBeenCalled();
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
