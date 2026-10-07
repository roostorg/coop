import {
  parseActivityCursor,
  serializeActivityCursor,
} from './activityCursor.js';

describe('activityCursor', () => {
  it('round-trips a cursor that ends on a decision', () => {
    const cursor = {
      ts: new Date('2026-08-05T12:00:00.000Z'),
      decisionId: '3f1a5c7e-0000-4000-8000-000000000001',
      actionId: null,
    };

    expect(parseActivityCursor(serializeActivityCursor(cursor))).toEqual(
      cursor,
    );
  });

  it('round-trips a cursor that ends on a manual action', () => {
    const cursor = {
      ts: new Date('2026-08-05T11:00:00.000Z'),
      decisionId: null,
      actionId: 'manual-action-run:abc',
    };

    expect(parseActivityCursor(serializeActivityCursor(cursor))).toEqual(
      cursor,
    );
  });

  it('treats an absent cursor as the newest page', () => {
    expect(parseActivityCursor(undefined)).toBeUndefined();
    expect(parseActivityCursor(null)).toBeUndefined();
  });

  it('rejects a malformed cursor', () => {
    const ts = '2026-08-05T12:00:00.000Z';
    expect(() => parseActivityCursor('not-an-object')).toThrow(/cursor/i);
    expect(() => parseActivityCursor({})).toThrow(/cursor/i);
    expect(() =>
      parseActivityCursor({ ts: 'nonsense', decisionId: 'x', actionId: null }),
    ).toThrow(/cursor/i);
    expect(() =>
      parseActivityCursor({ ts, decisionId: null, actionId: null }),
    ).toThrow(/cursor/i);
    expect(() =>
      parseActivityCursor({ ts, decisionId: 'x', actionId: 'y' }),
    ).toThrow(/cursor/i);
  });
});
