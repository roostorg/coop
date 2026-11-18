import { vi } from 'vitest';

import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import {
  mapBacktestRowToGqlParent,
  type GraphQLBacktestParent,
} from '../datasources/ruleKyselyPersistence.js';
import { resolvers } from './backtest.js';

function makeBacktestRow(
  overrides: Partial<{
    id: string;
    ruleId: string;
    creatorId: string;
    sampleDesiredSize: number;
    sampleActualSize: number;
    sampleStartAt: Date;
    sampleEndAt: Date;
    samplingComplete: boolean;
    contentItemsProcessed: number;
    contentItemsMatched: number;
    status: 'RUNNING' | 'COMPLETE' | 'CANCELED';
    createdAt: Date;
    updatedAt: Date;
    cancelationDate: Date | null;
  }> = {},
) {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'bt-1',
    ruleId: 'rule-1',
    creatorId: 'user-1',
    sampleDesiredSize: 100,
    sampleActualSize: 80,
    sampleStartAt: now,
    sampleEndAt: now,
    samplingComplete: true,
    contentItemsProcessed: 50,
    contentItemsMatched: 10,
    status: 'COMPLETE' as const,
    createdAt: now,
    updatedAt: now,
    cancelationDate: null,
    ...overrides,
  };
}

describe('mapBacktestRowToGqlParent', () => {
  it('maps row columns to GraphQL fields', () => {
    const row = makeBacktestRow();
    const parent = mapBacktestRowToGqlParent(row);
    expect(parent).toMatchObject({
      id: row.id,
      ruleId: row.ruleId,
      creatorId: row.creatorId,
      sampleDesiredSize: row.sampleDesiredSize,
      sampleActualSize: row.sampleActualSize,
      sampleStartAt: row.sampleStartAt,
      sampleEndAt: row.sampleEndAt,
      samplingComplete: row.samplingComplete,
      contentItemsProcessed: row.contentItemsProcessed,
      contentItemsMatched: row.contentItemsMatched,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      cancelationDate: row.cancelationDate,
    });
  });

  it('clamps correctedContentItemsProcessed at sampleActualSize when items overshoot', () => {
    // Queues deliver at-least-once, so processed can exceed actual size.
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sampleActualSize: 80,
        contentItemsProcessed: 95,
        contentItemsMatched: 5,
      }),
    );
    expect(parent.correctedContentItemsProcessed).toBe(80);
  });

  it('clamps correctedContentItemsMatched at correctedContentItemsProcessed', () => {
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sampleActualSize: 80,
        contentItemsProcessed: 50,
        contentItemsMatched: 60,
      }),
    );
    expect(parent.correctedContentItemsProcessed).toBe(50);
    expect(parent.correctedContentItemsMatched).toBe(50);
  });

  it('passes through processed/matched values when below the clamp ceilings', () => {
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sampleActualSize: 80,
        contentItemsProcessed: 30,
        contentItemsMatched: 5,
      }),
    );
    expect(parent.correctedContentItemsProcessed).toBe(30);
    expect(parent.correctedContentItemsMatched).toBe(5);
  });
});

describe('Backtest field resolvers', () => {
  function parent(
    overrides: Partial<GraphQLBacktestParent> = {},
  ): GraphQLBacktestParent {
    return {
      ...mapBacktestRowToGqlParent(makeBacktestRow()),
      ...overrides,
    };
  }

  it('Backtest.contentItemsProcessed returns the corrected (clamped) value', () => {
    const source = parent({ correctedContentItemsProcessed: 42 });
    expect(resolvers.Backtest.contentItemsProcessed(source)).toBe(42);
  });

  it('Backtest.contentItemsMatched returns the corrected (clamped) value', () => {
    const source = parent({ correctedContentItemsMatched: 7 });
    expect(resolvers.Backtest.contentItemsMatched(source)).toBe(7);
  });
});

describe('backtest resolvers', () => {
  describe('Mutation.createBacktest', () => {
    it('does not call getRuleByIdAndOrg when the user lacks RUN_BACKTEST', async () => {
      const getRuleByIdAndOrg = vi.fn();
      const createBacktest = vi.fn();

      const ctx = {
        getUser: () => ({
          id: 'user-1',
          orgId: 'org-1',
          role: UserRole.MODERATOR,
          getPermissions: () => [
            UserPermission.VIEW_MRT,
            UserPermission.VIEW_MRT_DATA,
          ],
        }),
        services: {
          ModerationConfigService: { getRuleByIdAndOrg },
        },
        dataSources: {
          ruleAPI: { createBacktest },
        },
      };

      await expect(
        (
          resolvers.Mutation as {
            createBacktest: (...a: unknown[]) => Promise<unknown>;
          }
        ).createBacktest(
          {},
          {
            input: {
              ruleId: 'rule-1',
              sampleDesiredSize: 10,
              sampleStartAt: new Date().toISOString(),
              sampleEndAt: new Date().toISOString(),
            },
          },
          ctx as never,
        ),
      ).rejects.toThrow('User not authorized to create backtests.');

      expect(getRuleByIdAndOrg).not.toHaveBeenCalled();
      expect(createBacktest).not.toHaveBeenCalled();
    });
  });
});
