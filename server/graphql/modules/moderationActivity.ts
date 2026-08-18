import { type ItemInvestigationService } from '../../services/itemInvestigationService/index.js';
import { type ManualReviewToolService } from '../../services/manualReviewToolService/index.js';
import { type ActivityFeedFilterInput } from '../../services/moderationActivityFeed/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  type GQLManualActionRowResolvers,
  type GQLModerationActivityRowResolvers,
  type GQLQueryResolvers,
  type GQLRecentManualReviewDecisionType,
  type GQLReviewJobDecisionRowResolvers,
} from '../generated.js';
import { forbiddenError, unauthenticatedError } from '../utils/errors.js';

/** Matches the decisions feed's page size so the two merge evenly. */
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const DEFAULT_ITEM_PAGE_SIZE = 100;
/**
 * Covers any run Bulk Actioning can produce — its 1000-item limit is enforced
 * client-side only (`BulkActioningDashboard`), and `bulkExecuteActions` caps
 * nothing server-side, so a programmatic caller can still exceed this. The
 * panel keeps its truncation notice for that case rather than pretending the
 * list is always complete.
 */
const MAX_ITEM_PAGE_SIZE = 1000;

const typeDefs = /* GraphQL */ `
  input RecentModerationActivityInput {
    "Opaque cursor from a previous page. Absent for the newest page."
    cursor: Cursor
    "Rows per page. Defaults to 100, capped at 200."
    limit: Int
    view: ActivityView
    startTime: DateTime
    endTime: DateTime
    reviewerIds: [ID!]
    policyIds: [ID!]
    queueIds: [ID!]
    decisions: [RecentManualReviewDecisionType!]
    userSearchString: String
  }

  enum ActivityView {
    ALL
    DECISIONS
    ACTIONS
  }

  "Fields every row in the merged activity feed carries, regardless of kind."
  interface ModerationActivityRow {
    id: ID!
    ts: DateTime!
    reviewerId: ID
  }

  type ReviewJobDecisionRow implements ModerationActivityRow {
    id: ID!
    ts: DateTime!
    reviewerId: ID
    jobId: String
    queueId: ID
    itemId: ID
    itemTypeId: ID
    decisions: [ManualReviewDecisionComponent!]!
    decisionReason: String
  }

  """
  One operation a moderator ran outside a review job, from Bulk Actioning or
  Investigation. These produce no manual review decision, so they are otherwise
  invisible outside the actioned item's own history. A bulk run writes one
  execution per item per action; this collapses those into a single row.
  """
  type ManualActionRow implements ModerationActivityRow {
    id: ID!
    ts: DateTime!
    reviewerId: ID
    correlationId: ID!
    itemTypeId: ID
    actionIds: [ID!]!
    policyIds: [ID!]!
    actorNote: String
    itemCount: Int!
    failedCount: Int!
  }

  type ModerationActivityPage {
    rows: [ModerationActivityRow!]!
    "Null means the end of the feed."
    nextCursor: Cursor
  }

  input ManualActionItemsInput {
    correlationId: ID!
    "max(ts) of the operation, from its feed row. Bounds the partition scan."
    occurredAt: DateTime!
    "Defaults to 100, capped at 500."
    limit: Int
  }

  type ManualActionItem {
    itemId: ID!
    itemTypeId: ID
    failed: Boolean!
  }

  type ManualActionItemsPage {
    items: [ManualActionItem!]!
    totalCount: Int!
  }

  type Query {
    recentModerationActivity(
      input: RecentModerationActivityInput!
    ): ModerationActivityPage!

    manualActionItems(input: ManualActionItemsInput!): ManualActionItemsPage!
  }
`;

/** The exact shape `ModerationActivityFeed.getPage` puts in a DECISION row's `payload`. */
type DecisionRowPayload = Awaited<
  ReturnType<ManualReviewToolService['getDecisionsForActivityFeed']>
>[number];

/** The exact shape `ModerationActivityFeed.getPage` puts in a MANUAL_ACTION row's `payload`. */
type ManualActionRowPayload = Awaited<
  ReturnType<ItemInvestigationService['getRecentModeratorActions']>
>[number];

type DecisionFilterEntry = NonNullable<
  ActivityFeedFilterInput['decisions']
>[number];

/**
 * Maps the GraphQL oneof-style decision filter to the service's tagged-union
 * shape. Mirrors the equivalent mapping in `manualReviewTool.ts`'s
 * `getRecentDecisions` resolver — kept separate rather than shared, since
 * touching that resolver is out of scope here.
 */
function toDecisionFilterEntry(
  it: GQLRecentManualReviewDecisionType,
): DecisionFilterEntry | undefined {
  if (it.userOrRelatedActionDecision) {
    return {
      type: 'CUSTOM_ACTION',
      actionIds: it.userOrRelatedActionDecision.actionIds,
    };
  }
  if (it.ignoreDecision) {
    return { type: 'IGNORE', actionIds: undefined };
  }
  if (it.automaticCloseDecision) {
    return { type: 'AUTOMATIC_CLOSE', actionIds: undefined };
  }
  if (it.submitNcmecReportDecision) {
    return { type: 'SUBMIT_NCMEC_REPORT', actionIds: undefined };
  }
  if (it.transformJobAndRecreateInQueueDecision) {
    return {
      type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE',
      actionIds: undefined,
    };
  }
  if (it.acceptAppealDecision) {
    return { type: 'ACCEPT_APPEAL', actionIds: undefined };
  }
  if (it.rejectAppealDecision) {
    return { type: 'REJECT_APPEAL', actionIds: undefined };
  }
  return undefined;
}

function toActivityFeedDecisionFilter(
  decisions:
    ReadonlyArray<GQLRecentManualReviewDecisionType> | null | undefined,
): ActivityFeedFilterInput['decisions'] {
  if (!decisions) {
    return undefined;
  }
  return filterNullOrUndefined(decisions.map(toDecisionFilterEntry));
}

const Query: GQLQueryResolvers = {
  async recentModerationActivity(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ModerationActivityFeed.getPage({
      userPermissions: user.getPermissions(),
      orgId: user.orgId,
      input: {
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime ? new Date(input.endTime) : undefined,
        reviewerIds: input.reviewerIds ?? undefined,
        policyIds: input.policyIds ?? undefined,
        queueIds: input.queueIds ?? undefined,
        decisions: toActivityFeedDecisionFilter(input.decisions),
        userSearchString: input.userSearchString ?? undefined,
      },
      view: input.view ?? 'ALL',
      limit: Math.min(
        Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE,
      ),
      // Already decoded by the `Cursor` scalar; `parseActivityCursor` handles
      // shape validation from here.
      cursor: input.cursor ?? undefined,
    });
  },

  async manualActionItems(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    // Manual actions are only ever taken from Investigation or Bulk Actioning,
    // so viewing them requires the permission that gates Investigation itself.
    // EXTERNAL_MODERATOR — read-only access for external moderation partners —
    // is the only role without it, and this resolver returns the full item-id
    // list of a run, which is the one thing such an account must not enumerate.
    if (!user.getPermissions().includes(UserPermission.VIEW_INVESTIGATION)) {
      throw forbiddenError(
        'VIEW_INVESTIGATION permission required to view manual action items.',
      );
    }

    return context.services.ModerationActivityFeed.getManualActionItems({
      orgId: user.orgId,
      correlationId: input.correlationId,
      occurredAt: new Date(input.occurredAt),
      limit: Math.min(
        Math.max(1, input.limit ?? DEFAULT_ITEM_PAGE_SIZE),
        MAX_ITEM_PAGE_SIZE,
      ),
      // `offset` stays internal, not part of the public schema:
      // `totalCount` rides on a `count() OVER ()` window over the returned
      // rows, so paging past the end would make it report 0 — indistinguishable
      // from "this operation had no items".
      offset: 0,
    });
  },
};

const ModerationActivityRow: GQLModerationActivityRowResolvers = {
  __resolveType: (row) =>
    row.kind === 'MANUAL_ACTION' ? 'ManualActionRow' : 'ReviewJobDecisionRow',
};

const ReviewJobDecisionRow: GQLReviewJobDecisionRowResolvers = {
  id: (row) => row.id,
  ts: (row) => row.ts,
  reviewerId: (row) => (row.payload as DecisionRowPayload).reviewerId,
  jobId: (row) => (row.payload as DecisionRowPayload).jobId,
  queueId: (row) => (row.payload as DecisionRowPayload).queueId,
  itemId: (row) => (row.payload as DecisionRowPayload).itemId,
  itemTypeId: (row) => (row.payload as DecisionRowPayload).itemTypeId,
  decisions: (row) => (row.payload as DecisionRowPayload).decisions,
  decisionReason: (row) => (row.payload as DecisionRowPayload).decisionReason,
};

const ManualActionRow: GQLManualActionRowResolvers = {
  id: (row) => row.id,
  ts: (row) => row.ts,
  reviewerId: (row) => (row.payload as ManualActionRowPayload).actorId,
  correlationId: (row) => (row.payload as ManualActionRowPayload).correlationId,
  itemTypeId: (row) => (row.payload as ManualActionRowPayload).itemTypeId,
  actionIds: (row) => (row.payload as ManualActionRowPayload).actionIds,
  policyIds: (row) => (row.payload as ManualActionRowPayload).policyIds,
  actorNote: (row) => (row.payload as ManualActionRowPayload).actorNote,
  itemCount: (row) => (row.payload as ManualActionRowPayload).itemCount,
  failedCount: (row) => (row.payload as ManualActionRowPayload).failedCount,
};

const resolvers = {
  Query,
  ModerationActivityRow,
  ReviewJobDecisionRow,
  ManualActionRow,
};

export { typeDefs, resolvers };
