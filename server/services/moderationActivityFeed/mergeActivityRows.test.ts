import { parseActivityCursor } from './activityCursor.js';
import { mergeActivityRows, type ActivityRow } from './mergeActivityRows.js';

const decision = (id: string, iso: string): ActivityRow => ({
  kind: 'DECISION',
  id,
  ts: new Date(iso),
  payload: { id },
});

const action = (id: string, iso: string): ActivityRow => ({
  kind: 'MANUAL_ACTION',
  id,
  ts: new Date(iso),
  payload: { id },
});

describe('mergeActivityRows', () => {
  it('interleaves both sources newest first', () => {
    const result = mergeActivityRows(
      [
        decision('d-9', '2026-08-05T14:02:00Z'),
        decision('d-8', '2026-08-05T13:47:00Z'),
      ],
      [
        action('a-4', '2026-08-05T13:58:00Z'),
        action('a-3', '2026-08-05T13:51:00Z'),
      ],
      10,
      undefined,
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-9', 'a-4', 'a-3', 'd-8']);
  });

  it('has no next cursor when both sources are exhausted', () => {
    const result = mergeActivityRows(
      [decision('d-9', '2026-08-05T14:02:00Z')],
      [],
      10,
      undefined,
    );

    expect(result.nextCursor).toBeNull();
  });

  it('advances each store to its own last surviving row', () => {
    const result = mergeActivityRows(
      [
        decision('d-9', '2026-08-05T14:02:00Z'),
        decision('d-8', '2026-08-05T13:47:00Z'),
      ],
      [action('a-4', '2026-08-05T13:58:00Z')],
      2,
      undefined,
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-9', 'a-4']);
    expect(parseActivityCursor(result.nextCursor)).toEqual({
      decisions: { ts: new Date('2026-08-05T14:02:00Z'), id: 'd-9' },
      actions: { ts: new Date('2026-08-05T13:58:00Z'), id: 'a-4' },
    });
  });

  it('keeps a store’s incoming position when it contributes nothing', () => {
    // Resetting an idle store to null would restart it from the newest row and
    // replay everything the reader has already paged past.
    const incoming = {
      decisions: null,
      actions: { ts: new Date('2026-08-05T09:00:00Z'), id: 'a-1' },
    };

    const result = mergeActivityRows(
      [
        decision('d-3', '2026-08-05T13:00:00Z'),
        decision('d-2', '2026-08-05T12:00:00Z'),
        decision('d-1', '2026-08-05T11:00:00Z'),
      ],
      [],
      2,
      incoming,
    );

    expect(parseActivityCursor(result.nextCursor)).toEqual({
      decisions: { ts: new Date('2026-08-05T12:00:00Z'), id: 'd-2' },
      actions: { ts: new Date('2026-08-05T09:00:00Z'), id: 'a-1' },
    });
  });

  it('never compares ids across stores on a timestamp tie', () => {
    // A uuid decision id and a `manual-action-run:` action id have no shared
    // ordering. Kind breaks the tie before id is ever consulted.
    const result = mergeActivityRows(
      [
        decision(
          '00000000-0000-4000-8000-000000000001',
          '2026-08-05T13:00:00Z',
        ),
      ],
      [action('manual-action-run:zzz', '2026-08-05T13:00:00Z')],
      10,
      undefined,
    );

    expect(result.rows.map((r) => r.kind)).toEqual([
      'DECISION',
      'MANUAL_ACTION',
    ]);
  });

  it('fills a full page from one source when the other is empty', () => {
    const result = mergeActivityRows(
      [
        decision('d-3', '2026-08-05T13:00:00Z'),
        decision('d-2', '2026-08-05T12:00:00Z'),
        decision('d-1', '2026-08-05T11:00:00Z'),
      ],
      [],
      2,
      undefined,
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-3', 'd-2']);
    expect(result.nextCursor).not.toBeNull();
  });

  it('returns an empty page with no cursor', () => {
    expect(mergeActivityRows([], [], 10, undefined)).toEqual({
      rows: [],
      nextCursor: null,
    });
  });
});
