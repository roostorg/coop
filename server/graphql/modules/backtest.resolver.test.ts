import { UserRole } from '../../models/types/permissioning.js';
import {
  type GraphQLBacktestParent,
  mapBacktestRowToGqlParent,
} from '../datasources/ruleKyselyPersistence.js';
import { resolvers } from './backtest.js';

function makeBacktestRow(overrides: Partial<{
  id: string;
  rule_id: string;
  creator_id: string;
  sample_desired_size: number;
  sample_actual_size: number;
  sample_start_at: Date;
  sample_end_at: Date;
  sampling_complete: boolean;
  content_items_processed: number;
  content_items_matched: number;
  status: 'RUNNING' | 'COMPLETE' | 'CANCELED';
  created_at: Date;
  updated_at: Date;
  cancelation_date: Date | null;
}> = {}) {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'bt-1',
    rule_id: 'rule-1',
    creator_id: 'user-1',
    sample_desired_size: 100,
    sample_actual_size: 80,
    sample_start_at: now,
    sample_end_at: now,
    sampling_complete: true,
    content_items_processed: 50,
    content_items_matched: 10,
    status: 'COMPLETE' as const,
    created_at: now,
    updated_at: now,
    cancelation_date: null,
    ...overrides,
  };
}

describe('mapBacktestRowToGqlParent', () => {
  it('round-trips snake_case columns to camelCase fields', () => {
    const row = makeBacktestRow();
    const parent = mapBacktestRowToGqlParent(row);
    expect(parent).toMatchObject({
      id: row.id,
      ruleId: row.rule_id,
      creatorId: row.creator_id,
      sampleDesiredSize: row.sample_desired_size,
      sampleActualSize: row.sample_actual_size,
      sampleStartAt: row.sample_start_at,
      sampleEndAt: row.sample_end_at,
      samplingComplete: row.sampling_complete,
      contentItemsProcessed: row.content_items_processed,
      contentItemsMatched: row.content_items_matched,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelationDate: row.cancelation_date,
    });
  });

  it('clamps correctedContentItemsProcessed at sampleActualSize when items overshoot', () => {
    // Queues deliver at-least-once, so processed can exceed actual size.
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sample_actual_size: 80,
        content_items_processed: 95,
        content_items_matched: 5,
      }),
    );
    expect(parent.correctedContentItemsProcessed).toBe(80);
  });

  it('clamps correctedContentItemsMatched at correctedContentItemsProcessed', () => {
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sample_actual_size: 80,
        content_items_processed: 50,
        content_items_matched: 60,
      }),
    );
    expect(parent.correctedContentItemsProcessed).toBe(50);
    expect(parent.correctedContentItemsMatched).toBe(50);
  });

  it('passes through processed/matched values when below the clamp ceilings', () => {
    const parent = mapBacktestRowToGqlParent(
      makeBacktestRow({
        sample_actual_size: 80,
        content_items_processed: 30,
        content_items_matched: 5,
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
      const getRuleByIdAndOrg = jest.fn();
      const createBacktest = jest.fn();

      const ctx = {
        getUser: () => ({
          id: 'user-1',
          orgId: 'org-1',
          role: UserRole.MODERATOR,
        }),
        services: {
          ModerationConfigService: { getRuleByIdAndOrg },
        },
        dataSources: {
          ruleAPI: { createBacktest },
        },
      };

      await expect(
        (resolvers.Mutation as { createBacktest: (...a: unknown[]) => Promise<unknown> })
          .createBacktest(
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
