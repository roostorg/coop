import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './moderationActivity.js';

const runRecentModerationActivity = (
  permissions: UserPermission[],
  limit?: number,
) => {
  const getPage = vi.fn(async (_opts: { limit: number }) => ({
    rows: [],
    nextCursor: null,
  }));
  const context = {
    getUser: () => ({ orgId: 'org-1', getPermissions: () => permissions }),
    services: { ModerationActivityFeed: { getPage } },
  };
  const resolve = resolvers.Query.recentModerationActivity as (
    ...args: unknown[]
  ) => Promise<unknown>;
  return { getPage, result: resolve({}, { input: { limit } }, context, {}) };
};

describe('Query.recentModerationActivity', () => {
  it('rejects a user without VIEW_MRT_DATA before reading the feed', async () => {
    const { getPage, result } = runRecentModerationActivity([
      UserPermission.VIEW_INVESTIGATION,
    ]);

    await expect(result).rejects.toThrow('VIEW_MRT_DATA');
    expect(getPage).not.toHaveBeenCalled();
  });

  it('caps the page size so limit + 1 stays within the 200-row store limit', async () => {
    const { getPage, result } = runRecentModerationActivity(
      [UserPermission.VIEW_MRT_DATA],
      500,
    );

    await result;

    expect(getPage.mock.calls[0][0].limit + 1).toBeLessThanOrEqual(200);
  });
});

describe('ReviewJobDecisionRow resolvers', () => {
  it('passes claim and job creation times through from the decision', () => {
    const assignedAt = new Date('2026-01-01T00:00:05.000Z');
    const jobCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    const row = {
      kind: 'DECISION',
      id: 'decision-1',
      ts: new Date('2026-01-01T00:01:00.000Z'),
      payload: { assignedAt, jobCreatedAt },
    };
    const call = (field: 'assignedAt' | 'jobCreatedAt') =>
      (resolvers.ReviewJobDecisionRow[field] as (r: unknown) => unknown)(row);

    expect(call('assignedAt')).toBe(assignedAt);
    expect(call('jobCreatedAt')).toBe(jobCreatedAt);
  });

  it('returns null when the decision was never claimed', () => {
    const row = {
      kind: 'DECISION',
      id: 'decision-2',
      ts: new Date(),
      payload: { assignedAt: null, jobCreatedAt: null },
    };
    const call = (field: 'assignedAt' | 'jobCreatedAt') =>
      (resolvers.ReviewJobDecisionRow[field] as (r: unknown) => unknown)(row);

    expect(call('assignedAt')).toBeNull();
    expect(call('jobCreatedAt')).toBeNull();
  });
});
