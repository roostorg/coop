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
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-9', 'a-4', 'a-3', 'd-8']);
  });

  it('has no next cursor when both sources are exhausted', () => {
    const result = mergeActivityRows(
      [decision('d-9', '2026-08-05T14:02:00Z')],
      [],
      10,
    );

    expect(result.nextCursor).toBeNull();
  });

  it('points the next cursor at the last row when it is a manual action', () => {
    const result = mergeActivityRows(
      [
        decision('d-9', '2026-08-05T14:02:00Z'),
        decision('d-8', '2026-08-05T13:47:00Z'),
      ],
      [action('a-4', '2026-08-05T13:58:00Z')],
      2,
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-9', 'a-4']);
    expect(parseActivityCursor(result.nextCursor)).toEqual({
      ts: new Date('2026-08-05T13:58:00Z'),
      decisionId: null,
      actionId: 'a-4',
    });
  });

  it('points the next cursor at the last row when it is a decision', () => {
    const result = mergeActivityRows(
      [
        decision('d-3', '2026-08-05T13:00:00Z'),
        decision('d-2', '2026-08-05T12:00:00Z'),
        decision('d-1', '2026-08-05T11:00:00Z'),
      ],
      [],
      2,
    );

    expect(parseActivityCursor(result.nextCursor)).toEqual({
      ts: new Date('2026-08-05T12:00:00Z'),
      decisionId: 'd-2',
      actionId: null,
    });
  });

  it('has more when the two sources together exceed the limit', () => {
    const result = mergeActivityRows(
      [
        decision('d-2', '2026-08-05T12:00:00Z'),
        decision('d-1', '2026-08-05T11:00:00Z'),
      ],
      [action('a-1', '2026-08-05T11:30:00Z')],
      2,
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-2', 'a-1']);
    expect(result.nextCursor).not.toBeNull();
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
    );

    expect(result.rows.map((r) => r.id)).toEqual(['d-3', 'd-2']);
    expect(result.nextCursor).not.toBeNull();
  });

  it('returns an empty page with no cursor', () => {
    expect(mergeActivityRows([], [], 10)).toEqual({
      rows: [],
      nextCursor: null,
    });
  });
});
