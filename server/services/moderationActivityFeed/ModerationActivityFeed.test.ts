import { UserPermission } from '../userManagementService/index.js';
import { ModerationActivityFeed } from './ModerationActivityFeed.js';

/**
 * Manual actions require VIEW_INVESTIGATION. Every role except
 * EXTERNAL_MODERATOR holds it, so this is the ordinary case.
 */
const CAN_VIEW_ACTIONS = [UserPermission.VIEW_INVESTIGATION];

const mrt = (decisions: unknown[]) => ({
  getDecisionsForActivityFeed: jest.fn(
    async (_opts: { limit: number }) => decisions,
  ),
});

const investigation = (actions: unknown[]) => ({
  getRecentModeratorActions: jest.fn(
    async (_opts: { limit: number }) => actions,
  ),
  getManualActionItems: jest.fn(async () => ({ items: [], totalCount: 0 })),
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
      getRecentModeratorActions: jest.fn(async () => {
        throw new Error('clickhouse unreachable');
      }),
      getManualActionItems: jest.fn(),
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
    // EXTERNAL_MODERATOR (read-only access for external moderation partners)
    // is the only role lacking this permission, and holds VIEW_MRT alone.
    // Manual actions are by construction taken from Investigation or Bulk
    // Actioning, so such an account must not see them — nor be able to expand
    // one into an enumeration of the item ids it touched.
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
});
