import { vi } from 'vitest';

import { UserPermission } from '../userManagementService/index.js';
import { serializeActivityCursor } from './activityCursor.js';
import { ModerationActivityFeed } from './ModerationActivityFeed.js';

const CAN_VIEW_ACTIONS = [UserPermission.VIEW_INVESTIGATION];

const mrt = (decisions: unknown[]) => ({
  getDecisionsForActivityFeed: vi.fn(
    async (_opts: { limit: number }) => decisions,
  ),
});

const investigation = (actions: unknown[]) => ({
  getRecentModeratorActions: vi.fn(async (_opts: { limit: number }) => actions),
  getManualActionItems: vi.fn(async () => ({ items: [], totalCount: 0 })),
});

const decisionRow = (id: string, iso: string) => ({ id, createdAt: iso });
const actionRow = (correlationId: string, iso: string) => ({
  correlationId,
  occurredAt: new Date(iso),
  actionIds: [],
  policyIds: [],
  itemCount: 1,
  failedCount: 0,
  actorId: null,
  itemTypeId: null,
  actorNote: null,
});

describe('ModerationActivityFeed.getPage', () => {
  it('asks each source for one more row than the page size', async () => {
    // Worst case a whole page comes from one store, so `limit` from each is
    // the minimum; the extra row is what reveals whether more exists.
    const m = mrt([]);
    const i = investigation([]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    await feed.getPage({
      userPermissions: CAN_VIEW_ACTIONS,
      orgId: 'org-1',
      input: {},
      view: 'ALL',
      limit: 100,
    });

    expect(m.getDecisionsForActivityFeed.mock.calls[0][0].limit).toBe(101);
    expect(i.getRecentModeratorActions.mock.calls[0][0].limit).toBe(101);
  });

  it('skips the action store entirely when the view is DECISIONS', async () => {
    const m = mrt([decisionRow('d-1', '2026-08-05T14:00:00Z')]);
    const i = investigation([]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    const page = await feed.getPage({
      userPermissions: CAN_VIEW_ACTIONS,
      orgId: 'org-1',
      input: {},
      view: 'DECISIONS',
      limit: 100,
    });

    expect(i.getRecentModeratorActions).not.toHaveBeenCalled();
    expect(page.rows).toHaveLength(1);
  });

  it('skips the decisions store entirely when the view is ACTIONS', async () => {
    const m = mrt([]);
    const i = investigation([actionRow('a-1', '2026-08-05T14:00:00Z')]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    const page = await feed.getPage({
      userPermissions: CAN_VIEW_ACTIONS,
      orgId: 'org-1',
      input: {},
      view: 'ACTIONS',
      limit: 100,
    });

    expect(m.getDecisionsForActivityFeed).not.toHaveBeenCalled();
    expect(page.rows).toHaveLength(1);
  });

  it('hides actions when a decisions-only filter is active', async () => {
    // Queue and decision-type filters can only ever match decisions; running
    // the action query would waste a ClickHouse scan to return nothing.
    const m = mrt([]);
    const i = investigation([]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    await feed.getPage({
      userPermissions: CAN_VIEW_ACTIONS,
      orgId: 'org-1',
      input: { queueIds: ['q-1'] },
      view: 'ALL',
      limit: 100,
    });

    expect(i.getRecentModeratorActions).not.toHaveBeenCalled();
  });

  it('surfaces a store failure instead of returning half a log', async () => {
    // Silently rendering only decisions is worse than an error: the reader
    // cannot tell "no actions" from "actions unavailable".
    const m = mrt([]);
    const i = {
      getRecentModeratorActions: vi.fn(async () => {
        throw new Error('clickhouse unreachable');
      }),
      getManualActionItems: vi.fn(),
    };
    const feed = new ModerationActivityFeed(m as never, i as never);

    await expect(
      feed.getPage({
        userPermissions: CAN_VIEW_ACTIONS,
        orgId: 'org-1',
        input: {},
        view: 'ALL',
        limit: 100,
      }),
    ).rejects.toThrow('clickhouse unreachable');
  });

  it('interleaves both sources newest first', async () => {
    const m = mrt([
      decisionRow('d-9', '2026-08-05T14:02:00Z'),
      decisionRow('d-8', '2026-08-05T13:47:00Z'),
    ]);
    const i = investigation([actionRow('a-4', '2026-08-05T13:58:00Z')]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    const page = await feed.getPage({
      userPermissions: CAN_VIEW_ACTIONS,
      orgId: 'org-1',
      input: {},
      view: 'ALL',
      limit: 100,
    });

    expect(page.rows.map((r) => r.id)).toEqual(['d-9', 'a-4', 'd-8']);
  });

  it('hides manual actions from a caller without VIEW_INVESTIGATION', async () => {
    const m = mrt([decisionRow('d-1', '2026-08-05T14:00:00Z')]);
    const i = investigation([actionRow('a-1', '2026-08-05T13:00:00Z')]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    const page = await feed.getPage({
      userPermissions: [UserPermission.VIEW_MRT],
      orgId: 'org-1',
      input: {},
      view: 'ALL',
      limit: 100,
    });

    expect(i.getRecentModeratorActions).not.toHaveBeenCalled();
    expect(page.rows.map((r) => r.kind)).toEqual(['DECISION']);
  });

  it('does not let an explicit ACTIONS view bypass the permission', async () => {
    const m = mrt([]);
    const i = investigation([actionRow('a-1', '2026-08-05T13:00:00Z')]);
    const feed = new ModerationActivityFeed(m as never, i as never);

    const page = await feed.getPage({
      userPermissions: [UserPermission.VIEW_MRT],
      orgId: 'org-1',
      input: {},
      view: 'ACTIONS',
      limit: 100,
    });

    expect(i.getRecentModeratorActions).not.toHaveBeenCalled();
    expect(page.rows).toEqual([]);
  });

  describe('cursor', () => {
    const ts = new Date('2026-08-05T13:00:00.000Z');

    it('after a decision, resumes decisions past it and includes actions at its time', async () => {
      const m = mrt([]);
      const i = investigation([]);
      const feed = new ModerationActivityFeed(m as never, i as never);

      await feed.getPage({
        userPermissions: CAN_VIEW_ACTIONS,
        orgId: 'org-1',
        input: {},
        view: 'ALL',
        limit: 100,
        cursor: serializeActivityCursor({
          ts,
          decisionId: 'd-1',
          actionId: null,
        }),
      });

      expect(m.getDecisionsForActivityFeed.mock.calls[0][0]).toMatchObject({
        cursor: { ts, id: 'd-1' },
      });
      const actionsCall = i.getRecentModeratorActions.mock.calls[0][0] as {
        cursor?: unknown;
        before?: Date;
      };
      expect(actionsCall.cursor).toBeUndefined();
      expect(actionsCall.before).toEqual(ts);
    });

    it('after an action, resumes actions past it and takes decisions before its time', async () => {
      const m = mrt([]);
      const i = investigation([]);
      const feed = new ModerationActivityFeed(m as never, i as never);

      await feed.getPage({
        userPermissions: CAN_VIEW_ACTIONS,
        orgId: 'org-1',
        input: {},
        view: 'ALL',
        limit: 100,
        cursor: serializeActivityCursor({
          ts,
          decisionId: null,
          actionId: 'a-1',
        }),
      });

      expect(m.getDecisionsForActivityFeed.mock.calls[0][0]).toMatchObject({
        cursor: { ts, id: null },
      });
      expect(i.getRecentModeratorActions.mock.calls[0][0]).toMatchObject({
        cursor: { ts, correlationId: 'a-1' },
      });
    });

    it('keeps an end date that is earlier than the cursor', async () => {
      const m = mrt([]);
      const i = investigation([]);
      const feed = new ModerationActivityFeed(m as never, i as never);
      const endTime = new Date('2026-08-05T12:00:00.000Z');

      await feed.getPage({
        userPermissions: CAN_VIEW_ACTIONS,
        orgId: 'org-1',
        input: { endTime },
        view: 'ALL',
        limit: 100,
        cursor: serializeActivityCursor({
          ts,
          decisionId: 'd-1',
          actionId: null,
        }),
      });

      const actionsCall = i.getRecentModeratorActions.mock.calls[0][0] as {
        before?: Date;
      };
      expect(actionsCall.before).toEqual(endTime);
    });
  });

  it('pages through a mixed feed with shared timestamps, returning every row once', async () => {
    const at = (minute: number) =>
      new Date(Date.UTC(2026, 7, 5, 12, minute)).toISOString();
    const decisions = [
      decisionRow('d-1', at(0)),
      decisionRow('d-2', at(1)),
      decisionRow('d-3', at(1)),
      decisionRow('d-4', at(2)),
      decisionRow('d-5', at(3)),
    ];
    const actions = [
      actionRow('a-1', at(1)),
      actionRow('a-2', at(1)),
      actionRow('a-3', at(2)),
      actionRow('a-4', at(4)),
    ];
    const byTimeThenIdDesc = (
      x: { ts: number; id: string },
      y: { ts: number; id: string },
    ) => y.ts - x.ts || (x.id < y.id ? 1 : x.id > y.id ? -1 : 0);

    const m = {
      getDecisionsForActivityFeed: vi.fn(
        async (opts: {
          cursor?: { ts: Date; id: string | null };
          limit: number;
        }) =>
          decisions
            .map((d) => ({ d, ts: new Date(d.createdAt).valueOf(), id: d.id }))
            .filter(({ ts, id }) => {
              const c = opts.cursor;
              if (!c) return true;
              if (c.id === null) return ts < c.ts.valueOf();
              return (
                ts < c.ts.valueOf() || (ts === c.ts.valueOf() && id < c.id)
              );
            })
            .sort(byTimeThenIdDesc)
            .slice(0, opts.limit)
            .map(({ d }) => d),
      ),
    };
    const i = {
      getRecentModeratorActions: vi.fn(
        async (opts: {
          cursor?: { ts: Date; correlationId: string };
          before?: Date;
          limit: number;
        }) =>
          actions
            .map((a) => ({
              a,
              ts: a.occurredAt.valueOf(),
              id: a.correlationId,
            }))
            .filter(({ ts, id }) => {
              const { cursor, before } = opts;
              if (before && ts > before.valueOf()) return false;
              if (!cursor) return true;
              return (
                ts < cursor.ts.valueOf() ||
                (ts === cursor.ts.valueOf() && id < cursor.correlationId)
              );
            })
            .sort(byTimeThenIdDesc)
            .slice(0, opts.limit)
            .map(({ a }) => a),
      ),
      getManualActionItems: vi.fn(),
    };
    const feed = new ModerationActivityFeed(m as never, i as never);

    let seen: string[] = [];
    let cursor: Parameters<typeof feed.getPage>[0]['cursor'];
    for (let pageCount = 0; pageCount < 20; pageCount++) {
      const page = await feed.getPage({
        userPermissions: CAN_VIEW_ACTIONS,
        orgId: 'org-1',
        input: {},
        view: 'ALL',
        limit: 2,
        cursor,
      });
      seen = [...seen, ...page.rows.map((r) => r.id)];
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    expect(seen).toEqual([
      'a-4',
      'd-5',
      'd-4',
      'a-3',
      'd-3',
      'd-2',
      'a-2',
      'a-1',
      'd-1',
    ]);
  });
});
