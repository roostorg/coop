import type { JsonValue } from 'type-fest';

import type { ItemInvestigationService } from '../itemInvestigationService/index.js';
import type { ManualReviewToolService } from '../manualReviewToolService/index.js';
import type { RecentDecisionsFilterInput } from '../manualReviewToolService/modules/DecisionAnalytics.js';
import { UserPermission } from '../userManagementService/index.js';
import { parseActivityCursor } from './activityCursor.js';
import { mergeActivityRows, type ActivityRow } from './mergeActivityRows.js';

export type ActivityView = 'ALL' | 'DECISIONS' | 'ACTIONS';

/**
 * `RecentDecisionsFilterInput.page` drives offset paging on `getRecentDecisions`
 * — the offset-paged sibling of the cursor-paged query this feed calls. The
 * activity feed pages by cursor instead, so it never has a page number to
 * supply; the placeholder below is inert because `getDecisionsForActivityFeed`
 * never reads `page`.
 */
export type ActivityFeedFilterInput = Omit<RecentDecisionsFilterInput, 'page'>;

/** Placeholder for the `page` field `getDecisionsForActivityFeed` never reads. */
const UNUSED_PAGE = 0;

/** Merged-view lookback. See the spec's "Time window" section. */
const MERGED_VIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Filters that only a decision can satisfy. A manual action has no queue and no
 * decision type, so running the action query under either one can only ever
 * return nothing — the UI moves `Show` to `Decisions` and says why.
 */
function isDecisionOnlyFilter(input: ActivityFeedFilterInput): boolean {
  return (
    (input.queueIds?.length ?? 0) > 0 || (input.decisions?.length ?? 0) > 0
  );
}

/**
 * Manual actions are only ever taken from Investigation or Bulk Actioning, so
 * seeing them requires the permission that gates Investigation itself.
 *
 * This is not a formality. `EXTERNAL_MODERATOR` — described in
 * `systemRoleDefaults` as read-only access for external moderation partners —
 * is the only role in `UserPermissionsForRole` without `VIEW_INVESTIGATION`,
 * holding `VIEW_MRT` alone. Without this check an outsourced vendor account
 * could expand any bulk run into a full enumeration of the item ids it touched,
 * including runs a `CHILD_SAFETY_MODERATOR` performed. Every role the issue's
 * supervisor use case cares about already holds this permission.
 */
function canViewManualActions(
  userPermissions: readonly UserPermission[],
): boolean {
  return userPermissions.includes(UserPermission.VIEW_INVESTIGATION);
}

/**
 * The Recent Decisions feed, merged from two stores.
 *
 * Review-job decisions live in Postgres and manual moderator actions live in
 * ClickHouse. Nothing outside this module knows that.
 */
export class ModerationActivityFeed {
  constructor(
    private readonly manualReviewToolService: ManualReviewToolService,
    private readonly itemInvestigationService: ItemInvestigationService,
  ) {}

  async getPage(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: ActivityFeedFilterInput;
    view: ActivityView;
    limit: number;
    /** Already decoded by the `Cursor` scalar; absent for the newest page. */
    cursor?: unknown;
  }): Promise<{ rows: ActivityRow[]; nextCursor: JsonValue | null }> {
    const { userPermissions, orgId, input, view, limit, cursor } = opts;

    const decoded = parseActivityCursor(cursor);
    const includeDecisions = view !== 'ACTIONS';
    const includeActions =
      view !== 'DECISIONS' &&
      !isDecisionOnlyFilter(input) &&
      canViewManualActions(userPermissions);

    // limit + 1 from each: worst case a whole page comes from one store.
    const fetchSize = limit + 1;

    const [decisions, actions] = await Promise.all([
      includeDecisions
        ? this.manualReviewToolService.getDecisionsForActivityFeed({
            userPermissions,
            orgId,
            // `page` drives a different, offset-paged query; this one pages by
            // cursor and never reads it. See `ActivityFeedFilterInput`.
            input: { ...input, page: UNUSED_PAGE },
            // Each store gets ITS OWN side of the cursor. Handing the actions
            // position to Postgres would bind `manual-action-run:<uuid>`
            // against a uuid column and fail with 22P02.
            cursor: decoded?.decisions ?? undefined,
            limit: fetchSize,
          })
        : Promise.resolve([]),
      includeActions
        ? this.itemInvestigationService.getRecentModeratorActions({
            orgId,
            cursor: decoded?.actions
              ? {
                  ts: decoded.actions.ts,
                  correlationId: decoded.actions.id,
                }
              : undefined,
            after: input.startTime ? new Date(input.startTime) : undefined,
            // Both ends of the range must reach this store. Passing only
            // `after` leaves its upper bound at "now", so a January filter
            // renders today's bulk runs beside January decisions.
            before: input.endTime ? new Date(input.endTime) : undefined,
            limit: fetchSize,
            actorIds: input.reviewerIds ?? undefined,
            policyIds: input.policyIds ?? undefined,
            itemId: input.userSearchString ?? undefined,
            lookbackWindowMs: MERGED_VIEW_WINDOW_MS,
          })
        : Promise.resolve([]),
    ]);

    return mergeActivityRows(
      decisions.map((decision) => ({
        kind: 'DECISION' as const,
        id: decision.id,
        ts: new Date(decision.createdAt),
        payload: decision,
      })),
      actions.map((action) => ({
        kind: 'MANUAL_ACTION' as const,
        id: action.correlationId,
        ts: action.occurredAt,
        payload: action,
      })),
      limit,
      decoded,
    );
  }

  /**
   * Every item id one manual action run touched.
   *
   * Callers MUST check `VIEW_INVESTIGATION` first — see `canViewManualActions`.
   * The resolver owns that check, matching how `org.ts` and `ncmec.ts` gate on
   * `VIEW_CHILD_SAFETY_DATA`. This is the enumeration primitive behind the
   * feed, and `correlationId` is a client-supplied argument, so it is directly
   * reachable rather than only via `getPage`.
   */
  async getManualActionItems(opts: {
    orgId: string;
    correlationId: string;
    occurredAt: Date;
    limit: number;
    offset: number;
  }) {
    return this.itemInvestigationService.getManualActionItems(opts);
  }
}
