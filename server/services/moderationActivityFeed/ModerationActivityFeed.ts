import type { JsonValue } from 'type-fest';

import type { ItemInvestigationService } from '../itemInvestigationService/index.js';
import type { ManualReviewToolService } from '../manualReviewToolService/index.js';
import type { RecentDecisionsFilterInput } from '../manualReviewToolService/modules/DecisionAnalytics.js';
import { UserPermission } from '../userManagementService/index.js';
import { parseActivityCursor } from './activityCursor.js';
import { mergeActivityRows, type ActivityRow } from './mergeActivityRows.js';

export type ActivityView = 'ALL' | 'DECISIONS' | 'ACTIONS';

export type ActivityFeedFilterInput = Omit<RecentDecisionsFilterInput, 'page'>;

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
 * ClickHouse.
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
    /** Absent for the newest page. */
    cursor?: JsonValue;
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

    // Decisions sort before actions at the same instant. So after a decision,
    // no action at its time has been shown yet; after an action, every
    // decision at its time has.
    const endTime = input.endTime ? new Date(input.endTime) : undefined;
    const actionsBefore =
      decoded && decoded.actionId === null
        ? earliest(endTime, decoded.ts)
        : endTime;

    const [decisions, actions] = await Promise.all([
      includeDecisions
        ? this.manualReviewToolService.getDecisionsForActivityFeed({
            userPermissions,
            orgId,
            input,
            cursor: decoded
              ? { ts: decoded.ts, id: decoded.decisionId }
              : undefined,
            limit: fetchSize,
          })
        : Promise.resolve([]),
      includeActions
        ? this.itemInvestigationService.getRecentModeratorActions({
            orgId,
            cursor:
              decoded && decoded.actionId !== null
                ? { ts: decoded.ts, correlationId: decoded.actionId }
                : undefined,
            after: input.startTime ? new Date(input.startTime) : undefined,
            before: actionsBefore,
            limit: fetchSize,
            actorIds: input.reviewerIds ?? undefined,
            policyIds: input.policyIds ?? undefined,
            itemId: input.userSearchString ?? undefined,
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
    );
  }

  /** Every item one manual action touched. Callers must check VIEW_INVESTIGATION. */
  async getManualActionItems(opts: {
    orgId: string;
    correlationId: string;
    occurredAt: Date;
    limit: number;
  }) {
    return this.itemInvestigationService.getManualActionItems({
      ...opts,
      offset: 0,
    });
  }
}

function earliest(a: Date | undefined, b: Date): Date {
  return a !== undefined && a.valueOf() < b.valueOf() ? a : b;
}
