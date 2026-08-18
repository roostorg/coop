import {
  parseActivityCursor,
  serializeActivityCursor,
} from './activityCursor.js';

describe('activityCursor', () => {
  it('round-trips both store positions', () => {
    const cursor = {
      decisions: {
        ts: new Date('2026-08-05T12:00:00.000Z'),
        id: '3f1a5c7e-0000-4000-8000-000000000001',
      },
      actions: {
        ts: new Date('2026-08-05T11:00:00.000Z'),
        id: 'manual-action-run:abc',
      },
    };

    expect(parseActivityCursor(serializeActivityCursor(cursor))).toEqual(
      cursor,
    );
  });

  it('round-trips a cursor where one store is exhausted', () => {
    const cursor = {
      decisions: null,
      actions: {
        ts: new Date('2026-08-05T11:00:00.000Z'),
        id: 'manual-action-run:abc',
      },
    };

    expect(parseActivityCursor(serializeActivityCursor(cursor))).toEqual(
      cursor,
    );
  });

  it('treats an absent cursor as the newest page', () => {
    expect(parseActivityCursor(undefined)).toBeUndefined();
    expect(parseActivityCursor(null)).toBeUndefined();
  });

  it('rejects a malformed cursor rather than silently restarting the feed', () => {
    // Silently returning "newest page" would make a paging bug look like the
    // reader simply reached the top again.
    expect(() => parseActivityCursor('not-an-object')).toThrow(/cursor/i);
    expect(() => parseActivityCursor({})).toThrow(/cursor/i);
    expect(() =>
      parseActivityCursor({
        decisions: { ts: 'nonsense', id: 'x' },
        actions: null,
      }),
    ).toThrow(/cursor/i);
    // A bare single-position cursor is the old broken shape; reject it.
    expect(() =>
      parseActivityCursor({ ts: '2026-08-05T12:00:00.000Z', id: 'x' }),
    ).toThrow(/cursor/i);
  });
});
