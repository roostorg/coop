import { parseDatetimeToReadableStringInCurrentTimeZone } from '@/utils/time';
import { gql } from '@apollo/client';
import { Link } from 'react-router-dom';

import CloseButton from '@/components/common/CloseButton';

import { useGQLManualActionItemsQuery } from '../../../graphql/generated';

gql`
  query ManualActionItems($input: ManualActionItemsInput!) {
    manualActionItems(input: $input) {
      totalCount
      items {
        itemId
        itemTypeId
        failed
      }
    }
  }
`;

// Server default/cap (see `ManualActionItemsInput` in
// `server/graphql/modules/moderationActivity.ts`). There is deliberately no
// `offset` field: `totalCount` rides on the same window function as the
// returned rows, so paging past the end would report `0` — indistinguishable
// from a run with no items. We fetch a single page and, when the run has more
// items than that, say so rather than implying more can be loaded.
// Bulk Actioning caps a run at 1000 ids, so this covers everything the UI can
// produce and truncation becomes the exception rather than routine. At 100 a
// 250-item run hid 22 of its 36 failures, and which items you saw was
// arbitrary (`ORDER BY item_id`) — failures are the reason this panel exists.
//
// That 1000 limit is client-side only and `bulkExecuteActions` caps nothing,
// so a programmatic caller can still exceed it; the truncation notice below
// stays for that case.
const PAGE_SIZE = 1000;

/**
 * The items one bulk (manual-action) run touched, fetched on selection
 * rather than alongside the feed — a run can touch a thousand items, and
 * every feed row would carry that weight if we fetched eagerly.
 *
 * Renders in the page's detail side panel — the same slot a selected
 * decision uses (`ManualReviewRecentDecisionSummary` +
 * `ManualReviewJobReview`) — not inside the feed table, so a wide run's
 * item list has room to breathe instead of wrapping inside a table cell.
 */
export default function ManualActionItemsPanel({
  correlationId,
  occurredAt,
  actionNames,
  reviewerName,
  onClose,
}: {
  correlationId: string;
  occurredAt: Date | string;
  /** Names of the action(s) this run applied, for the panel heading. */
  actionNames: readonly string[];
  /** The moderator (or "Automatic") who ran this action, for the heading. */
  reviewerName: string;
  onClose?: () => void;
}) {
  const { data, loading, error } = useGQLManualActionItemsQuery({
    variables: {
      input: { correlationId, occurredAt, limit: PAGE_SIZE },
    },
  });

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div className="flex w-full items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold">
            {actionNames.length > 0 ? actionNames.join(', ') : 'Manual Action'}
          </div>
          <div className="text-sm font-medium text-slate-500">
            {reviewerName} &middot;{' '}
            {parseDatetimeToReadableStringInCurrentTimeZone(occurredAt)}
          </div>
        </div>
        {onClose ? <CloseButton onClose={onClose} customWidth="w-5" /> : null}
      </div>
      <div className="w-full rounded border border-solid border-slate-200 bg-slate-50 p-3">
        {loading ? (
          <div className="text-sm text-slate-400">Loading items…</div>
        ) : error ? (
          <div className="text-sm font-medium text-coop-alert-red">
            Could not load the items for this action.
          </div>
        ) : !data?.manualActionItems ||
          data.manualActionItems.items.length === 0 ? (
          <div className="text-sm text-slate-400">No items recorded.</div>
        ) : (
          <>
            <div className="pb-2 text-sm text-slate-400">
              {data.manualActionItems.totalCount} item
              {data.manualActionItems.totalCount === 1 ? '' : 's'}
              {data.manualActionItems.totalCount >
              data.manualActionItems.items.length ? (
                // Items come back ordered by id, so a truncated list is an
                // arbitrary slice — failures can fall outside it. Say that
                // rather than letting the reader assume they see every one.
                <span className="text-coop-alert-red">
                  {` — showing first ${data.manualActionItems.items.length}; some failures may not be listed`}
                </span>
              ) : (
                ''
              )}
            </div>
            <ul className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto">
              {data.manualActionItems.items.map((item) => (
                <li
                  key={item.itemId}
                  className="flex items-center gap-2 text-sm"
                >
                  {item.itemTypeId ? (
                    <Link
                      to={`/dashboard/manual_review/investigation?id=${item.itemId}&typeId=${item.itemTypeId}`}
                      target="_blank"
                      className="text-indigo-600 underline"
                    >
                      {item.itemId}
                    </Link>
                  ) : (
                    <span>{item.itemId}</span>
                  )}
                  {item.failed ? (
                    <span className="font-medium text-coop-alert-red">
                      Failed
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
