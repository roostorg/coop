import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import ChevronLeft from '@/icons/lni/Direction/chevron-left.svg?react';
import ChevronRight from '@/icons/lni/Direction/chevron-right.svg?react';
import CrossCircle from '@/icons/lni/Interface and Sign/cross-circle.svg?react';
import GridAlt from '@/icons/lnif/Design/grid-alt.svg?react';
import { HOST_URL } from '@/lib/config';
import { filterNullOrUndefined } from '@/utils/collections';
import { RedoOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Checkbox, Input, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import ComponentLoading from '../../../components/common/ComponentLoading';
import CoopBadge, { type BadgeColorVariant } from '../components/CoopBadge';
import FormHeader from '../components/FormHeader';
import Table from '../components/table/Table';
import UserWithAvatar from '../components/UserWithAvatar';

import {
  GQLGetRecentModerationActivityQuery,
  GQLManualReviewDecision,
  GQLRecentDecisionsFilterInput,
  GQLRecentModerationActivityInput,
  GQLUserPermission,
  useGQLGetDecidedJobFromJobIdQuery,
  useGQLGetDecidedJobLazyQuery,
  useGQLGetRecentModerationActivityLazyQuery,
  useGQLGetSkipsForRecentDecisionsLazyQuery,
  useGQLOrgLookupDataQuery,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';
import { assertUnreachable } from '../../../utils/misc';
import {
  parseDatetimeToReadableStringInCurrentTimeZone,
  parseDatetimeToReadableStringInUTC,
} from '../../../utils/time';
import { jsonParse } from '../../../utils/typescript-types';
import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import { JOB_FRAGMENT } from './manual_review_job/jobFragment';
import ManualReviewJobReview from './manual_review_job/ManualReviewJobReview';
import ManualActionItemsPanel from './ManualActionItemsPanel';
import ManualReviewRecentDecisionsFilter, {
  RecentDecisionsFilterInput,
} from './ManualReviewRecentDecisionsFilter';
import ManualReviewRecentDecisionSummary from './ManualReviewRecentDecisionSummary';
import {
  buildActivityCsv,
  escapeCsvField,
  type CsvRow,
} from './moderationActivityCsv';

gql`
  ${ITEM_TYPE_FRAGMENT}
  fragment ManualReviewDecisionComponentFields on ManualReviewDecisionComponentBase {
    type
    ... on UserOrRelatedActionDecisionComponent {
      itemTypeId
      itemIds
      actionIds
      policyIds
    }
    ... on RejectAppealDecisionComponent {
     appealId
    }
    ... on AcceptAppealDecisionComponent {
      appealId
    }
    ... on TransformJobAndRecreateInQueueDecisionComponent {
      newQueueId
      originalQueueId
    }
    ... on SubmitNCMECReportDecisionComponent {
      type
      reportedMedia {
        id
        typeId
        url
        fileAnnotations
        industryClassification
      }
    }
  }

  query OrgLookupData {
    me {
      id
      permissions
    }
    myOrg {
      id
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      policies {
        id
        name
      }
      users {
        id
        firstName
        lastName
      }
      mrtQueues {
        id
        name
      }
    }
  }

  # This page no longer queries getRecentDecisions directly (it uses
  # recentModerationActivity below), but the operation stays defined here:
  # ItemActionHistory.tsx still calls useGQLGetRecentDecisionsQuery, and
  # graphql-codegen only generates a hook for an operation whose document
  # text exists somewhere in the client. Removing this would silently break
  # that unrelated page's codegen output.
  query GetRecentDecisions($input: RecentDecisionsInput!) {
    getRecentDecisions(input: $input) {
      id
      jobId
      queueId
      reviewerId
      itemId
      itemTypeId
      decisions {
        ... on ManualReviewDecisionComponentBase {
          ...ManualReviewDecisionComponentFields
        }
      }
      relatedActions {
        ... on ManualReviewDecisionComponentBase {
          ...ManualReviewDecisionComponentFields
        }
      }
      createdAt
      decisionReason
    }
  }

  # Skips CSV export. This is untouched by the merged-feed cursor paging
  # above: skips are offset-paged via RecentDecisionsInput { filter, page },
  # not the activity feed's cursor.
  query getSkipsForRecentDecisions($input: RecentDecisionsInput!) {
    getSkipsForRecentDecisions(input: $input) {
      jobId
      userId
      queueId
      ts
    }
  }

  query GetRecentModerationActivity($input: RecentModerationActivityInput!) {
    recentModerationActivity(input: $input) {
      nextCursor
      rows {
        __typename
        id
        ts
        reviewerId
        ... on ReviewJobDecisionRow {
          jobId
          queueId
          itemId
          itemTypeId
          decisions {
            ... on ManualReviewDecisionComponentBase {
              ...ManualReviewDecisionComponentFields
            }
          }
          decisionReason
        }
        ... on ManualActionRow {
          correlationId
          itemTypeId
          actionIds
          policyIds
          actorNote
          itemCount
          failedCount
        }
      }
    }
  }

  query GetDecidedJob($id: ID!) {
    getDecidedJob(id: $id) {
      ${JOB_FRAGMENT}
      ...JobFields
    }
  }
`;

type ActivityRow =
  GQLGetRecentModerationActivityQuery['recentModerationActivity']['rows'][number];
type ReviewJobRow = Extract<
  ActivityRow,
  { __typename: 'ReviewJobDecisionRow' }
>;
type ManualActionRowData = Extract<
  ActivityRow,
  { __typename: 'ManualActionRow' }
>;
type RecentDecision = ReviewJobRow['decisions'][number];

/** One row of the merged feed, normalized for the table regardless of which
 * concrete row type (`ReviewJobDecisionRow` or `ManualActionRow`) it came from. */
type NormalizedActivityRow = {
  rowId: string;
  origin: 'Review Job' | 'Manual Action';
  ts: ActivityRow['ts'];
  decisionColorNamePairs: { name: string; colorVariant: BadgeColorVariant }[];
  policies: string[];
  reviewer: string;
  queue: string;
  reason: string | null | undefined;
  decision: ReviewJobRow | undefined;
  action: ManualActionRowData | undefined;
};

/**
 * The side panel shows exactly one thing at a time — a decision or a manual
 * action, never both. Modeling the selection as a single discriminated union
 * (rather than two independent `useState`s) makes that invariant structural:
 * setting one always replaces the other, so there's no separate "clear the
 * other one" call to remember at each call site.
 */
type ActivitySelection =
  | { kind: 'decision'; decision: GQLManualReviewDecision }
  | { kind: 'action'; action: ManualActionRowData };

/**
 * The decision-detail side panel and the `getDecidedJob` lookup both predate
 * the merged feed and still expect a `ManualReviewDecision`-shaped object.
 * `ReviewJobDecisionRow.id` is the same underlying decision id `getRecentDecisions`
 * used to return (see `mapDecisionRow` server-side), so this mapping is safe.
 * `relatedActions` has no equivalent on the row — the merged feed never
 * fetched it — so it's always empty here.
 */
function toManualReviewDecision(row: ReviewJobRow): GQLManualReviewDecision {
  return {
    __typename: 'ManualReviewDecision',
    id: row.id,
    jobId: row.jobId ?? '',
    itemId: row.itemId,
    itemTypeId: row.itemTypeId,
    queueId: row.queueId ?? '',
    reviewerId: row.reviewerId,
    // `ManualReviewDecisionComponentFields` (reused verbatim from the old
    // GetRecentDecisions query) selects fewer fields per component than the
    // full schema type declares — e.g. it doesn't fetch `actionIds` on an
    // accept/reject appeal component. `ManualReviewRecentDecisionSummary`
    // only ever reads the fields the fragment does select, so this narrowing
    // is safe; TS can't see that without a cast.
    decisions: row.decisions as unknown as GQLManualReviewDecision['decisions'],
    relatedActions: [],
    createdAt: row.ts,
    decisionReason: row.decisionReason,
  };
}

// Column visibility configuration
type ColumnId =
  | 'origin'
  | 'decisionTime'
  | 'decisions'
  | 'policies'
  | 'reviewer'
  | 'queue'
  | 'decisionReason';

const COLUMN_VISIBILITY_STORAGE_KEY = 'mrt-recent-decisions-column-visibility';

const defaultColumnVisibility: Record<ColumnId, boolean> = {
  origin: true,
  decisionTime: true,
  decisions: true,
  decisionReason: true,
  policies: true,
  reviewer: true,
  queue: true,
};

const columnLabels: Record<ColumnId, string> = {
  origin: 'Origin',
  decisionTime: 'Decision Time',
  decisions: 'Decisions',
  decisionReason: 'Decision Reason',
  policies: 'Policies',
  reviewer: 'Reviewer',
  queue: 'Queue',
};

const DECISION_REASON_PREVIEW_LENGTH = 50;

// Runaway guard for both CSV exports: stop paging after this many requests
// even if the server keeps returning more (e.g. `nextCursor` never goes
// null, or the offset loop never runs dry).
const CSV_MAX_PAGES = 100;

// Feed view: which rows `recentModerationActivity` returns. Persisted so a
// moderator's preference survives a reload.
type FeedView = 'ALL' | 'DECISIONS' | 'ACTIONS';

const FEED_VIEW_STORAGE_KEY = 'mrt-recent-decisions-feed-view';

/**
 * Mirrors `MERGED_VIEW_WINDOW_MS` in `ModerationActivityFeed` — the server
 * bounds how far back a page scans ClickHouse for manual actions. Stated in
 * the UI because a feed that has run out of window looks exactly like one that
 * has run out of data. Keep the two in step.
 */
const MANUAL_ACTION_WINDOW_DAYS = 30;

const feedViewLabels: Record<FeedView, string> = {
  ALL: 'All',
  DECISIONS: 'Decisions',
  ACTIONS: 'Actions',
};

/**
 * Filters only a decision can satisfy. A manual action has no queue and no
 * decision type, so leaving `Show` on `All` while these are active would leave
 * the control claiming something the table isn't doing.
 */
const isDecisionOnlyFilter = (input: RecentDecisionsFilterInput) =>
  (input.queueIds?.length ?? 0) > 0 || (input.decisions?.length ?? 0) > 0;

export default function ManualReviewRecentDecisions() {
  const [searchParams] = useSearchParams();
  const [decisionId] = [searchParams.get('decisionId') ?? undefined];
  const [jobId] = [searchParams.get('jobId') ?? undefined];
  const [correlationId] = [searchParams.get('correlationId') ?? undefined];
  const [selection, setSelection] = useState<ActivitySelection | undefined>(
    undefined,
  );
  // Convenience views onto `selection` — kept as plain `const`s (not
  // separate state) so the "only one selected at a time" invariant lives in
  // the `ActivitySelection` type rather than needing to be maintained by
  // hand at every call site that used to clear a second variable.
  const selectedDecision =
    selection?.kind === 'decision' ? selection.decision : undefined;
  const selectedAction =
    selection?.kind === 'action' ? selection.action : undefined;
  const [userSearchString, setUserSearchString] = useState<string | undefined>(
    searchParams.get('reviewerId') ?? undefined,
  );
  const [unsavedFilterValue, setUnsavedFilterValue] = useState<
    RecentDecisionsFilterInput | undefined
  >(undefined);

  // The `Show` control's value as the user last chose it. Kept separate from
  // `effectiveView` (below) so a decisions-only filter can force the view
  // without discarding what the user picked — clearing the filter restores it.
  const [chosenView, setChosenView] = useState<FeedView>(() => {
    try {
      const stored = localStorage.getItem(FEED_VIEW_STORAGE_KEY);
      return stored === 'DECISIONS' || stored === 'ACTIONS' || stored === 'ALL'
        ? stored
        : 'ALL';
    } catch (e) {
      // localStorage unavailable (e.g. private browsing); default is fine.
      return 'ALL';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FEED_VIEW_STORAGE_KEY, chosenView);
    } catch (e) {
      // localStorage unavailable (e.g. private browsing); the in-memory
      // choice still works for the rest of the session.
    }
  }, [chosenView]);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<
    Record<ColumnId, boolean>
  >(() => {
    try {
      const stored = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (stored) {
        return { ...defaultColumnVisibility, ...JSON.parse(stored) };
      }
    } catch (e) {
      // Failed to load from localStorage, use defaults
    }
    return defaultColumnVisibility;
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        COLUMN_VISIBILITY_STORAGE_KEY,
        JSON.stringify(columnVisibility),
      );
    } catch (e) {
      // Failed to save to localStorage
    }
  }, [columnVisibility]);

  const toggleColumnVisibility = useCallback((columnId: ColumnId) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] };
      // Keep at least one column visible to avoid a blank, unusable table.
      if (!Object.values(next).some(Boolean)) {
        return prev;
      }
      return next;
    });
  }, []);

  const [columnsMenuVisible, setColumnsMenuVisible] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Close columns menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setColumnsMenuVisible(false);
      }
    };

    if (columnsMenuVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [columnsMenuVisible]);

  const { data: orgLookupData } = useGQLOrgLookupDataQuery({
    fetchPolicy: 'cache-and-network',
  });

  // Manual actions are only ever taken from Investigation or Bulk Actioning,
  // so the server gates them on VIEW_INVESTIGATION. EXTERNAL_MODERATOR — the
  // read-only role for external moderation partners — is the only role without
  // it. Mirror the gate here so such a reviewer gets the decisions-only page
  // they had before this feature, rather than a Show control whose other two
  // options silently return nothing.
  // Permissive until permissions actually load, so the common case never
  // changes the query variables mid-flight and refetches. The server enforces
  // this gate regardless; this is only about not offering dead controls.
  const loadedPermissions = orgLookupData?.me?.permissions;
  const canViewManualActions =
    loadedPermissions == null ||
    userHasPermissions(loadedPermissions, [
      GQLUserPermission.ViewInvestigation,
    ]);

  // A queue or decision-type filter can only ever match a review-job
  // decision — a manual action has neither — so applying either forces the
  // view to Decisions rather than silently rendering only decisions while
  // the control still reads "All".
  const decisionsOnly = isDecisionOnlyFilter(unsavedFilterValue ?? {});
  const effectiveView: FeedView =
    decisionsOnly || !canViewManualActions ? 'DECISIONS' : chosenView;

  const { data: decidedJobFromJobIdData } = useGQLGetDecidedJobFromJobIdQuery({
    variables: { id: jobId! },
    skip: !jobId,
    onCompleted: (data) => {
      if (data.getDecidedJobFromJobId) {
        setSelection({
          kind: 'decision',
          decision: data.getDecidedJobFromJobId
            .decision as GQLManualReviewDecision,
        });
      }
    },
  });

  const [
    getModerationActivity,
    { loading: activityLoading, error: activityError, data: activityData },
  ] = useGQLGetRecentModerationActivityLazyQuery();

  // Separate lazy-query instances from `getModerationActivity` above so a CSV
  // export's paging loop doesn't clobber the table's own query state (loading
  // flag, cached data) while it runs.
  const [getActivityForDownload] = useGQLGetRecentModerationActivityLazyQuery();
  const [getSkipsForRecentDecisions] =
    useGQLGetSkipsForRecentDecisionsLazyQuery();

  // Confusingly, getDecidedJob is used to get the job associated with a decision
  // whereas getDecidedJobFromJobId is used to get the decision associated with a job
  const [
    getDecidedJob,
    {
      loading: decidedJobLoading,
      error: decidedJobError,
      data: decidedJobData,
    },
  ] = useGQLGetDecidedJobLazyQuery();

  const navigate = useNavigate();

  // Cursor paging: the server returns the page already ordered, and
  // `nextCursor` (null at the end of the feed) is all we need to advance.
  // `cursorStack` remembers each page's starting cursor so "Previous" can
  // step back through pages already seen without re-deriving an offset.
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // CSV export loading flags — separate from `activityLoading` (the table's
  // own query) since a download's paging loop runs on its own lazy-query
  // instance and shouldn't make the table look like it's refetching.
  const [downloadingActivity, setDownloadingActivity] = useState(false);
  const [downloadingSkips, setDownloadingSkips] = useState(false);

  // Shared by both the cursor-paged activity feed and the offset-paged skips
  // CSV below — the two queries take different paging shapes but the same
  // filter fields, so this is the one place that maps the filter UI's value
  // to the GraphQL decision-filter shape.
  const buildFilterInput = useCallback(
    (input: RecentDecisionsFilterInput) => {
      const decisionOrActions = input.decisions?.map((it) => jsonParse(it));
      return {
        userSearchString,
        policyIds: input.policyIds,
        reviewerIds: input.reviewerIds,
        queueIds: input.queueIds,
        startTime: input.dateRange?.startDate,
        endTime: input.dateRange?.endDate,
        decisions: decisionOrActions?.map((it) => {
          switch (it.type) {
            case 'CUSTOM_ACTION':
              return {
                userOrRelatedActionDecision: {
                  actionIds: [it.actionId],
                },
              };
            case 'IGNORE':
              return {
                ignoreDecision: {
                  _: true,
                },
              };
            case 'AUTOMATIC_CLOSE':
              return {
                automaticClose: {
                  _: true,
                },
              };
            case 'REJECT_APPEAL':
              return {
                rejectAppealDecision: {
                  _: true,
                },
              };
            case 'ACCEPT_APPEAL':
              return {
                acceptAppealDecision: {
                  _: true,
                },
              };
            case 'SUBMIT_NCMEC_REPORT':
              return {
                submitNcmecReportDecision: {
                  _: true,
                },
              };
            case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
              return {
                transformJobAndRecreateInQueueDecision: {
                  _: true,
                },
              };
            default:
              assertUnreachable(it);
          }
        }),
      };
    },
    [userSearchString],
  );

  const buildActivityInput = useCallback(
    (
      input: RecentDecisionsFilterInput,
      cursorArg: string | undefined,
      view: FeedView,
    ): GQLRecentModerationActivityInput => ({
      cursor: cursorArg,
      view,
      ...buildFilterInput(input),
    }),
    [buildFilterInput],
  );

  // Skips CSV input: same filter fields as the activity feed, offset-paged
  // instead of cursor-paged (see `getSkipsForRecentDecisions` above — its
  // schema is untouched and still takes `{ filter, page }`).
  const buildSkipsInput = useCallback(
    (
      input: RecentDecisionsFilterInput,
      page: number,
    ): { filter: GQLRecentDecisionsFilterInput; page: number } => ({
      filter: buildFilterInput(input),
      page,
    }),
    [buildFilterInput],
  );

  // Handle clicking the page left icon
  const handlePrevious = () => {
    const previous = cursorStack[cursorStack.length - 1];
    // Same re-entry guard as `handleNext` — a double-click would pop twice
    // while only one fetch lands.
    if (previous === undefined || activityLoading) {
      return;
    }
    const previousCursor = previous === '' ? undefined : previous;
    setCursorStack((stack) => stack.slice(0, -1));
    setCursor(previousCursor);
    setSelection(undefined);
    getModerationActivity({
      fetchPolicy: 'network-only',
      variables: {
        input: buildActivityInput(
          unsavedFilterValue ?? {},
          previousCursor,
          effectiveView,
        ),
      },
    });
  };

  // Handle clicking the page right icon
  const handleNext = () => {
    const next = activityData?.recentModerationActivity.nextCursor ?? undefined;
    // `activityLoading` is the re-entry guard. Without it a double-click read
    // the same `nextCursor` twice and pushed twice onto `cursorStack`, so the
    // page counter ran ahead of the content permanently — content on page 2
    // labelled "Page 3", and Previous never resynced.
    if (!next || activityLoading) {
      return;
    }
    setCursorStack((stack) => [...stack, cursor ?? '']);
    setCursor(next);
    setSelection(undefined);
    getModerationActivity({
      fetchPolicy: 'network-only',
      variables: {
        input: buildActivityInput(
          unsavedFilterValue ?? {},
          next,
          effectiveView,
        ),
      },
    });
  };

  useEffect(() => {
    const activeRow = activityData?.recentModerationActivity.rows.find(
      (it): it is ReviewJobRow =>
        it.__typename === 'ReviewJobDecisionRow' && it.id === decisionId,
    );
    const decision =
      (activeRow && toManualReviewDecision(activeRow)) ??
      (decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision?.id ===
      decisionId
        ? decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision
        : undefined);
    if (decision) {
      setSelection({
        kind: 'decision',
        decision: decision as GQLManualReviewDecision,
      });
    }
  }, [
    activityData?.recentModerationActivity.rows,
    decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision,
    decisionId,
    jobId,
  ]);

  // Deep-link restore for a manual action, mirroring the decision restore
  // above — but with one gap: a decision can be restored even when it isn't
  // on the currently loaded feed page, because `getDecidedJobFromJobId`
  // looks it up directly. There is no equivalent lookup-by-correlationId
  // query for manual actions, so this can only restore a selection whose row
  // is present in `activityData` (i.e. still on the loaded page) — a link
  // shared while looking at that page still works; a link to an older run
  // that has since paged out of view does not. Adding that lookup would mean
  // a new backend query, which is out of scope here.
  useEffect(() => {
    if (!correlationId) {
      return;
    }
    const activeActionRow = activityData?.recentModerationActivity.rows.find(
      (it): it is ManualActionRowData =>
        it.__typename === 'ManualActionRow' &&
        it.correlationId === correlationId,
    );
    if (activeActionRow) {
      setSelection({ kind: 'action', action: activeActionRow });
    }
  }, [activityData?.recentModerationActivity.rows, correlationId]);

  useEffect(() => {
    if (selection?.kind === 'decision') {
      getDecidedJob({
        variables: { id: selection.decision.id },
      });
      navigate(
        `/dashboard/manual_review/recent/?decisionId=${selection.decision.id}&jobId=${selection.decision.jobId}`,
        {
          replace: true,
        },
      );
    } else if (selection?.kind === 'action') {
      navigate(
        `/dashboard/manual_review/recent/?correlationId=${selection.action.correlationId}`,
        {
          replace: true,
        },
      );
    }
  }, [getDecidedJob, selection, navigate, decidedJobData?.getDecidedJob]);

  const columns = useMemo(
    () =>
      filterNullOrUndefined([
        columnVisibility.origin
          ? {
              Header: 'Origin',
              accessor: 'origin',
              canSort: false,
            }
          : undefined,
        columnVisibility.decisionTime
          ? {
              Header: 'Decision Time',
              accessor: 'ts',
              // The server returns each page already ordered by (ts, kind, id)
              // descending across both stores. A client-side sort could only
              // reorder the hundred rows currently loaded, which reads as a
              // global sort and is not one.
              canSort: false,
            }
          : undefined,
        columnVisibility.decisions
          ? {
              Header: 'Decisions',
              accessor: 'decisions',
              canSort: false,
            }
          : undefined,
        columnVisibility.decisionReason
          ? {
              Header: 'Decision Reason',
              accessor: 'decisionReason',
              canSort: false,
            }
          : undefined,
        columnVisibility.policies
          ? {
              Header: 'Policies',
              accessor: 'policies',
              canSort: false,
            }
          : undefined,
        columnVisibility.reviewer
          ? {
              Header: 'Reviewer',
              accessor: 'reviewer',
              canSort: false,
            }
          : undefined,
        columnVisibility.queue
          ? {
              Header: 'Queue',
              accessor: 'queue',
              // Same reason as Decision Time — and this column renders JSX, so
              // a comparator would be sorting React elements, not queue names.
              canSort: false,
            }
          : undefined,
      ]),
    [columnVisibility],
  );

  const getReviewerName = useCallback(
    (reviewerId: string | null | undefined) => {
      if (!reviewerId) {
        return 'Automatic';
      }
      const reviewer = orgLookupData?.myOrg?.users.find(
        (user) => user.id === reviewerId,
      );
      return reviewer
        ? `${reviewer.firstName} ${reviewer.lastName}`
        : 'Unknown';
    },
    [orgLookupData?.myOrg?.users],
  );

  const getQueueName = useCallback(
    (queueId: string) =>
      orgLookupData?.myOrg?.mrtQueues.find((queue) => queue.id === queueId)
        ?.name ?? 'Unknown',
    [orgLookupData?.myOrg],
  );

  const getActionName = useCallback(
    (actionId: string) =>
      orgLookupData?.myOrg?.actions.find((action) => action.id === actionId)
        ?.name ?? 'Unknown',
    [orgLookupData?.myOrg],
  );

  const getPolicyName = useCallback(
    (policyId: string) =>
      orgLookupData?.myOrg?.policies.find((policy) => policy.id === policyId)
        ?.name ?? 'Unknown',
    [orgLookupData?.myOrg],
  );

  const getDecisionColorNamePairs = useCallback(
    (
      decision: RecentDecision,
      _isSelected: boolean,
    ): { name: string; colorVariant: BadgeColorVariant }[] => {
      switch (decision.__typename) {
        case 'IgnoreDecisionComponent':
          return [
            {
              name: 'Ignore',
              colorVariant: 'soft-gray',
            },
          ];
        case 'AcceptAppealDecisionComponent':
          return [
            {
              name: 'Accept Appeal',
              colorVariant: 'soft-green',
            },
          ];
        case 'RejectAppealDecisionComponent':
          return [
            {
              name: 'Reject Appeal',
              colorVariant: 'soft-red',
            },
          ];
        case 'SubmitNCMECReportDecisionComponent':
          return [
            {
              name: 'Report to NCMEC',
              colorVariant: 'soft-yellow',
            },
          ];
        case 'TransformJobAndRecreateInQueueDecisionComponent':
          return [
            {
              name: 'Move to Different Queue',
              colorVariant: 'soft-blue',
            },
          ];
        case 'AutomaticCloseDecisionComponent':
          return [
            {
              name: 'Closed Automatically',
              colorVariant: 'soft-gray',
            },
          ];
        case 'UserOrRelatedActionDecisionComponent':
          if (decision.type === 'RELATED_ACTION') {
          }
          return decision.actionIds.map((actionId) => ({
            name: getActionName(actionId),
            // Reduced opacity because alert-red is really bright for this UI
            colorVariant: 'soft-red',
          }));
      }
    },
    [getActionName],
  );

  const getPoliciesFromDecision = useCallback(
    (decision: RecentDecision) => {
      switch (decision.__typename) {
        case 'IgnoreDecisionComponent':
        case 'AutomaticCloseDecisionComponent':
        case 'TransformJobAndRecreateInQueueDecisionComponent':
        case 'AcceptAppealDecisionComponent':
        case 'RejectAppealDecisionComponent':
          return [];
        case 'SubmitNCMECReportDecisionComponent':
        case 'UserOrRelatedActionDecisionComponent':
          return decision.__typename === 'SubmitNCMECReportDecisionComponent'
            ? ['Child Safety'] // TODO @mdworsky replace with the org's child safety policy ID
            : decision.policyIds.map((id) => getPolicyName(id));
        default:
          assertUnreachable(decision);
      }
    },
    [getPolicyName],
  );

  // A manual action has no decision components of its own — it's just a set
  // of actions applied directly. Badge them the same way a decision's custom
  // actions are badged (`UserOrRelatedActionDecisionComponent`, above) so the
  // merged Decisions column reads consistently regardless of a row's origin.
  const getActionColorNamePairs = useCallback(
    (
      actionIds: readonly string[],
    ): { name: string; colorVariant: BadgeColorVariant }[] =>
      actionIds.map((actionId) => ({
        name: getActionName(actionId),
        colorVariant: 'soft-red',
      })),
    [getActionName],
  );

  // Normalizes one merged-feed row into the flat, string-only shape the CSV
  // export writes out. Kept separate from `NormalizedActivityRow` (used by
  // the table) since the CSV needs raw item/failed counts rather than the
  // table's pre-rendered JSX.
  const toCsvRow = useCallback(
    (row: ActivityRow): CsvRow => {
      if (row.__typename === 'ManualActionRow') {
        return {
          origin: 'Manual Action',
          outcome: getActionColorNamePairs(row.actionIds).map(
            ({ name }) => name,
          ),
          policies: row.policyIds.map((id) => getPolicyName(id)),
          reviewer: getReviewerName(row.reviewerId),
          queue: '',
          time: parseDatetimeToReadableStringInUTC(new Date(row.ts)),
          reason: row.actorNote ?? null,
          itemCount: row.itemCount,
          failedCount: row.failedCount,
          link: '',
        };
      }
      return {
        origin: 'Review Job',
        outcome: row.decisions.flatMap((it) =>
          getDecisionColorNamePairs(it, false).map(({ name }) => name),
        ),
        policies: row.decisions.flatMap((it) => getPoliciesFromDecision(it)),
        reviewer: getReviewerName(row.reviewerId),
        queue: row.queueId ? getQueueName(row.queueId) : '',
        time: parseDatetimeToReadableStringInUTC(new Date(row.ts)),
        reason: row.decisionReason ?? null,
        itemCount: null,
        failedCount: null,
        link: `${HOST_URL}/dashboard/manual_review/recent?jobId=${row.jobId ?? ''}`,
      };
    },
    [
      getActionColorNamePairs,
      getDecisionColorNamePairs,
      getPoliciesFromDecision,
      getPolicyName,
      getQueueName,
      getReviewerName,
    ],
  );

  const tableRows: NormalizedActivityRow[] | undefined = useMemo(() => {
    if (!activityData || !orgLookupData?.myOrg) {
      return undefined;
    }
    return activityData.recentModerationActivity.rows.map(
      (row): NormalizedActivityRow => {
        if (row.__typename === 'ManualActionRow') {
          return {
            rowId: row.id,
            origin: 'Manual Action',
            ts: row.ts,
            decisionColorNamePairs: getActionColorNamePairs(row.actionIds),
            policies: row.policyIds.map((id) => getPolicyName(id)),
            reviewer: getReviewerName(row.reviewerId),
            queue: '',
            reason: row.actorNote,
            decision: undefined,
            action: row,
          };
        }
        return {
          rowId: row.id,
          origin: 'Review Job',
          ts: row.ts,
          decisionColorNamePairs: row.decisions.flatMap((it) =>
            getDecisionColorNamePairs(it, false),
          ),
          policies: row.decisions.flatMap((it) => getPoliciesFromDecision(it)),
          reviewer: getReviewerName(row.reviewerId),
          queue: row.queueId ? getQueueName(row.queueId) : '',
          reason: row.decisionReason,
          decision: row,
          action: undefined,
        };
      },
    );
  }, [
    activityData,
    orgLookupData?.myOrg,
    getActionColorNamePairs,
    getDecisionColorNamePairs,
    getPoliciesFromDecision,
    getPolicyName,
    getQueueName,
    getReviewerName,
  ]);

  // No client-side sort: the server returns the page already ordered.
  const tableData = useMemo(() => {
    if (!tableRows) {
      return undefined;
    }
    return tableRows.map((row) => ({
      origin: (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          <CoopBadge
            colorVariant={
              row.origin === 'Review Job' ? 'soft-blue' : 'soft-gray'
            }
            label={row.origin}
            shapeVariant="pill"
          />
          {row.action && row.action.itemCount > 1 ? (
            <button
              type="button"
              className="w-fit cursor-pointer text-xs text-slate-400 underline decoration-dotted hover:text-slate-600"
              onClick={(event) => {
                // Selecting the action opens the side panel, the same slot a
                // selected decision uses — not something that should also
                // fire the row's own `onClick` (which would select the same
                // thing a second time via the enclosing `<tr onClick>`).
                event.stopPropagation();
                if (row.action) {
                  setSelection({ kind: 'action', action: row.action });
                }
              }}
            >
              {row.action.itemCount} items
            </button>
          ) : null}
          {row.action && row.action.failedCount > 0 ? (
            <span className="text-xs font-medium text-coop-alert-red">
              {row.action.failedCount} of {row.action.itemCount} failed
            </span>
          ) : null}
        </div>
      ),
      decisions: (
        <div className="flex flex-wrap gap-1">
          {row.decisionColorNamePairs.map(({ name, colorVariant }, index) => (
            <CoopBadge
              key={index}
              colorVariant={colorVariant}
              label={name}
              shapeVariant="pill"
            />
          ))}
        </div>
      ),
      policies: (
        <div className="max-w-[220px] whitespace-normal break-words">
          {row.policies.join(', ')}
        </div>
      ),
      reviewer: <UserWithAvatar name={row.reviewer} />,
      queue: <div>{row.queue}</div>,
      decisionTime: (
        <div>
          {parseDatetimeToReadableStringInCurrentTimeZone(new Date(row.ts))}
        </div>
      ),
      decisionReason: row.reason ? (
        <Tooltip title={row.reason}>
          <div className="max-w-xs truncate">
            {row.reason.length > DECISION_REASON_PREVIEW_LENGTH
              ? `${row.reason.slice(0, DECISION_REASON_PREVIEW_LENGTH)}…`
              : row.reason}
          </div>
        </Tooltip>
      ) : (
        <div className="text-slate-400">—</div>
      ),
      values: row,
    }));
  }, [tableRows]);

  // Only a feed failure is fatal — without it there is no page. A
  // `getDecidedJob` failure concerns one selected row, and the panel below
  // renders an inline message for it. Throwing here ran during render and so
  // took the whole page to the error boundary, making that inline handler
  // unreachable: one decision whose item type had been deleted turned the
  // entire log into "Something Went Wrong".
  if (activityError) {
    throw activityError;
  }

  const refreshButton = (
    <Button
      icon={<RedoOutlined className="self-center" />}
      className="!inline-flex"
      onClick={async () =>
        getModerationActivity({
          fetchPolicy: 'network-only',
          variables: {
            input: buildActivityInput(
              unsavedFilterValue ?? {},
              cursor,
              effectiveView,
            ),
          },
        })
      }
      loading={activityLoading}
    >
      Refresh Table
    </Button>
  );

  // Activity export: pages the same cursor-paged query the table uses, via
  // its own lazy-query instance (`getActivityForDownload`), looping until
  // `nextCursor` is null. Capped at `CSV_MAX_PAGES` as a runaway guard.
  const downloadButton = (
    <Button
      className="rounded"
      loading={downloadingActivity}
      onClick={async () => {
        setDownloadingActivity(true);
        try {
          const collected: CsvRow[] = [];
          let downloadCursor: string | undefined;

          for (let page = 0; page < CSV_MAX_PAGES; page++) {
            const result = await getActivityForDownload({
              variables: {
                input: buildActivityInput(
                  unsavedFilterValue ?? {},
                  downloadCursor,
                  effectiveView,
                ),
              },
            });
            const feed = result.data?.recentModerationActivity;
            if (!feed) {
              break;
            }
            collected.push(...feed.rows.map(toCsvRow));
            if (!feed.nextCursor) {
              break;
            }
            downloadCursor = feed.nextCursor;
          }

          const includeActions = effectiveView !== 'DECISIONS';
          const blob = new Blob([buildActivityCsv(collected, includeActions)], {
            type: 'text/csv',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = includeActions
            ? 'moderation-activity.csv'
            : 'decisions.csv';
          a.click();
          URL.revokeObjectURL(url);
        } finally {
          setDownloadingActivity(false);
        }
      }}
    >
      Download
    </Button>
  );

  // Skips export: `getSkipsForRecentDecisions` is untouched in the schema
  // and still takes `{ filter, page }` — an offset, not the activity feed's
  // cursor. It shares filters with the activity feed, not a paging
  // position, so this loop is entirely separate from the one above.
  const downloadSkips = (
    <Button
      className="rounded"
      loading={downloadingSkips}
      onClick={async () => {
        setDownloadingSkips(true);
        try {
          const collected: {
            reviewer: string;
            queue: string;
            time: string;
            link: string;
          }[] = [];
          // `SkipOperations.getSkippedJobsForRecentDecisions` (server-side)
          // ignores `page` entirely today and always returns the full
          // matching set in one call, so a page-index loop alone would never
          // terminate on "empty" and would append the same rows repeatedly.
          // Track which skips have already been collected and stop once a
          // page adds nothing new — correct against today's unpaginated
          // resolver, and still correct if it's paginated for real later.
          const seenSkipKeys = new Set<string>();

          for (let page = 0; page < CSV_MAX_PAGES; page++) {
            const result = await getSkipsForRecentDecisions({
              variables: {
                input: buildSkipsInput(unsavedFilterValue ?? {}, page),
              },
            });
            const skips = result.data?.getSkipsForRecentDecisions;
            if (!skips || skips.length === 0) {
              break;
            }
            const newSkips = skips.filter((skip) => {
              const key = `${skip.jobId}:${skip.userId}:${skip.ts}`;
              if (seenSkipKeys.has(key)) {
                return false;
              }
              seenSkipKeys.add(key);
              return true;
            });
            if (newSkips.length === 0) {
              break;
            }
            collected.push(
              ...newSkips.map((skip) => ({
                reviewer: getReviewerName(skip.userId),
                queue: getQueueName(skip.queueId),
                time: parseDatetimeToReadableStringInUTC(new Date(skip.ts)),
                link: `${HOST_URL}/dashboard/manual_review/recent?jobId=${skip.jobId}`,
              })),
            );
          }

          const headers = ['Reviewer', 'Queue', 'Decision Time', 'Link'];
          const csvContent = [
            headers,
            ...collected.map((row) => [
              row.reviewer,
              row.queue,
              row.time,
              row.link,
            ]),
          ]
            .map((row) => row.map(escapeCsvField).join(','))
            .join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'skips.csv';
          a.click();
          URL.revokeObjectURL(url);
        } finally {
          setDownloadingSkips(false);
        }
      }}
    >
      Download Skips
    </Button>
  );

  useEffect(() => {
    getModerationActivity({
      variables: {
        input: buildActivityInput(
          unsavedFilterValue ?? {},
          cursor,
          effectiveView,
        ),
      },
    });
    // NB: We only want to run this once, so we intentionally do not include
    // any dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchForUser = () => {
    if (userSearchString) {
      setSelection(undefined);
      setCursor(undefined);
      setCursorStack([]);
      getModerationActivity({
        variables: {
          input: buildActivityInput(
            unsavedFilterValue ?? {},
            undefined,
            effectiveView,
          ),
        },
      });
      navigate(
        `/dashboard/manual_review/recent/?reviewerId=${userSearchString}`,
        {
          replace: true,
        },
      );
    }
  };

  const userSearchInput = (
    <div className="flex items-start gap-2 pb-1">
      <Input
        className="rounded-lg w-[300px]"
        placeholder="Input a user's ID or username"
        value={userSearchString}
        onChange={(event) => setUserSearchString(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            searchForUser();
          }
        }}
        suffix={
          userSearchString ? (
            <CrossCircle
              onClick={() => setUserSearchString('')}
              className="cursor-pointer"
            />
          ) : null
        }
        autoFocus
      />
      <Button disabled={userSearchString === undefined} onClick={searchForUser}>
        Search
      </Button>
    </div>
  );

  const visibleColumnsCount =
    Object.values(columnVisibility).filter(Boolean).length;

  const columnsButton = (
    <div ref={columnsMenuRef} className="relative inline-block text-start">
      <Button
        className={`font-semibold text-base rounded ${
          visibleColumnsCount === Object.keys(columnLabels).length
            ? 'bg-white text-gray-600 hover:bg-white hover:text-gray-600'
            : 'bg-gray-600 text-white border-none hover:bg-gray-500'
        }`}
        icon={
          <GridAlt className="inline-block w-4 h-4 mr-2" fill="currentColor" />
        }
        onClick={() => setColumnsMenuVisible(!columnsMenuVisible)}
      >
        Columns
      </Button>
      {columnsMenuVisible && (
        <div className="absolute left-0 z-20 flex flex-col mt-1 bg-white border border-solid border-gray-300 rounded shadow-md min-w-[240px]">
          <div className="px-4 py-4 text-base font-semibold">Show Columns</div>
          <div className="!p-0 !m-0 divider" />
          <div className="flex flex-col px-4 py-2">
            {(Object.keys(columnLabels) as ColumnId[]).map((columnId) => (
              <div key={columnId} className="py-2">
                <Checkbox
                  checked={columnVisibility[columnId]}
                  disabled={
                    columnVisibility[columnId] && visibleColumnsCount === 1
                  }
                  onChange={() => toggleColumnVisibility(columnId)}
                >
                  {columnLabels[columnId]}
                </Checkbox>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const userSearchAndRefresh = (
    <div className="flex gap-8">
      {userSearchInput}
      {refreshButton}
      {downloadButton}
      {downloadSkips}
    </div>
  );

  const tableControls = (
    <div className="flex flex-col gap-2">
      {userSearchAndRefresh}
      {columnsButton}
    </div>
  );

  // A cursor from one view is meaningless in another (it points into a
  // different underlying dataset), so switching the feed view resets paging
  // the same way applying a filter does.
  const handleViewChange = (nextView: FeedView) => {
    setChosenView(nextView);
    setSelection(undefined);
    setCursor(undefined);
    setCursorStack([]);
    getModerationActivity({
      variables: {
        input: buildActivityInput(
          unsavedFilterValue ?? {},
          undefined,
          nextView,
        ),
      },
    });
  };

  // Without VIEW_INVESTIGATION every option but Decisions returns nothing, so
  // offer no control at all rather than two dead choices.
  const showControl = !canViewManualActions ? null : (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label
          htmlFor="mrt-recent-decisions-feed-view"
          className="font-semibold text-slate-500 whitespace-nowrap"
        >
          Show
        </label>
        <Select
          value={effectiveView}
          disabled={decisionsOnly}
          onValueChange={(value) => handleViewChange(value as FeedView)}
        >
          <SelectTrigger
            id="mrt-recent-decisions-feed-view"
            size="small"
            className="w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(feedViewLabels) as FeedView[]).map((view) => (
              <SelectItem key={view} value={view}>
                {feedViewLabels[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {decisionsOnly ? (
        <div className="text-xs text-slate-400">
          Manual actions have no queue, so this filter shows decisions only.
        </div>
      ) : null}
      {effectiveView !== 'DECISIONS' ? (
        <>
          {/*
            Without this, a feed that has simply run out of window is
            indistinguishable from one that has run out of data: paging back
            past the window returns no more manual actions and no "has more"
            signal, which reads as "nobody bulk-actioned anything that month".
            Queue decisions have no such bound.
          */}
          <div className="text-xs text-slate-400">
            Manual actions cover the last {MANUAL_ACTION_WINDOW_DAYS} days. Set
            a start date to look further back.
          </div>
          <div className="text-xs text-slate-400">
            Manual actions are not filtered by child-safety permissions.
          </div>
        </>
      ) : null}
    </div>
  );

  const filter = (
    <ManualReviewRecentDecisionsFilter
      input={unsavedFilterValue ?? {}}
      onSave={(input) => {
        setSelection(undefined);
        setUnsavedFilterValue(input);
        setCursor(undefined);
        setCursorStack([]);
        // `chosenView` state hasn't updated yet (we didn't change it here),
        // so re-derive the view for *this* filter directly from `input`
        // rather than reading the (stale, pre-update) `effectiveView`.
        const viewForFilter: FeedView = isDecisionOnlyFilter(input)
          ? 'DECISIONS'
          : chosenView;
        getModerationActivity({
          variables: {
            input: buildActivityInput(input, undefined, viewForFilter),
          },
        });
        navigate(`/dashboard/manual_review/recent/`, {
          replace: true,
        });
      }}
    />
  );

  const currentJobNCMECDecision = selectedDecision?.decisions.find(
    (it) => it.__typename === 'SubmitNCMECReportDecisionComponent',
  );

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Manual Review Decisions</title>
      </Helmet>
      <FormHeader
        title="Recent Decisions"
        subtitle="This is a list of all the most recent moderator decisions and manual actions, in reverse chronological order with the most recent activity first, and the least recent activity last. You can search for activity about a given user by entering that user's ID or username."
      />
      {selection ? userSearchAndRefresh : null}
      {activityLoading || !tableData ? (
        <ComponentLoading />
      ) : (
        <div className="flex w-full">
          <div className={selection ? undefined : 'w-full min-w-0'}>
            <Table
              columns={columns}
              // @ts-ignore
              data={tableData}
              alwaysShowScrollbar
              containerClassName={selection ? undefined : 'w-full'}
              onSelectRow={(rowData) => {
                const values = rowData.original.values as NormalizedActivityRow;
                if (values.decision) {
                  setSelection({
                    kind: 'decision',
                    decision: toManualReviewDecision(values.decision),
                  });
                } else if (values.action) {
                  setSelection({ kind: 'action', action: values.action });
                }
              }}
              topLeftComponent={selection ? null : tableControls}
              topRightComponent={
                <div className="flex items-start gap-4 pb-8">
                  {showControl}
                  {filter}
                </div>
              }
              isCollapsed={selection != null}
              collapsedColumnTitle="Decisions"
              renderCollapsedCell={(row) => {
                const values = row.original.values as NormalizedActivityRow;

                return (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap gap-1">
                      {values.decisionColorNamePairs.map(
                        ({ name, colorVariant }, index) => (
                          <CoopBadge
                            key={index}
                            colorVariant={colorVariant}
                            label={name}
                            shapeVariant="pill"
                          />
                        ),
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {values.reviewer}
                    </div>
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {parseDatetimeToReadableStringInCurrentTimeZone(
                        new Date(values.ts),
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {decidedJobLoading || selection ? null : (
              // Buttons rather than bare `<svg onClick>`: these need a
              // disabled state at the ends of the feed (a click that does
              // nothing is indistinguishable from one that failed), and they
              // were previously unreachable by keyboard and unnamed for
              // assistive tech.
              <div className="flex justify-between w-full mb-10">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={cursorStack.length === 0 || activityLoading}
                  onClick={() => handlePrevious()}
                  className="bg-transparent border-none cursor-pointer disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronLeft className="font-bold w-7 fill-slate-500" />
                </button>
                <span>Page {cursorStack.length + 1}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={
                    !activityData?.recentModerationActivity.nextCursor ||
                    activityLoading
                  }
                  onClick={() => handleNext()}
                  className="bg-transparent border-none cursor-pointer disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronRight className="font-bold w-7 fill-slate-500" />
                </button>
              </div>
            )}
          </div>
          {decidedJobLoading ? (
            <div className="flex w-full h-screen">
              <ComponentLoading />
            </div>
          ) : selectedDecision ? (
            <div className="flex flex-col items-start w-full h-full p-3 mb-4 ml-3 border border-r-0 border-solid rounded border-slate-200">
              <ManualReviewRecentDecisionSummary
                selectedDecision={selectedDecision}
                showCloseButton={true}
                closeButtonOnClick={() => {
                  setSelection(undefined);
                  navigate(`/dashboard/manual_review/recent/`, {
                    replace: true,
                  });
                }}
              />
              {decidedJobError ? (
                <div className="text-red-500">
                  Error loading job. Please refresh and try again.
                </div>
              ) : decidedJobData ? (
                <div className="w-full h-screen overflow-y-scroll">
                  <ManualReviewJobReview
                    closedJobData={{
                      closedJob: decidedJobData.getDecidedJob,
                      ncmecDecisions:
                        currentJobNCMECDecision &&
                        currentJobNCMECDecision.__typename ===
                          'SubmitNCMECReportDecisionComponent'
                          ? currentJobNCMECDecision.reportedMedia
                          : undefined,
                      rightComponent: decidedJobData.getDecidedJob?.payload && (
                        <Link
                          className="cursor-pointer shrink-0"
                          to={`/dashboard/manual_review/investigation?id=${decidedJobData.getDecidedJob.payload.item.id}&typeId=${decidedJobData.getDecidedJob.payload.item.type.id}`}
                          target="_blank"
                        >
                          Action on this Item
                        </Link>
                      ),
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : selectedAction ? (
            <div className="flex flex-col items-start w-full h-full p-3 mb-4 ml-3 border border-r-0 border-solid rounded border-slate-200">
              <ManualActionItemsPanel
                correlationId={selectedAction.correlationId}
                occurredAt={selectedAction.ts}
                actionNames={getActionColorNamePairs(
                  selectedAction.actionIds,
                ).map(({ name }) => name)}
                reviewerName={getReviewerName(selectedAction.reviewerId)}
                onClose={() => {
                  setSelection(undefined);
                  navigate(`/dashboard/manual_review/recent/`, {
                    replace: true,
                  });
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
