import { resolvers } from './moderationActivity.js';

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
