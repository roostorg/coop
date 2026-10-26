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

const PAGE_SIZE = 1000;

export default function ManualActionItemsPanel({
  correlationId,
  occurredAt,
  actionNames,
  reviewerName,
  failedCount,
  onClose,
}: {
  correlationId: string;
  occurredAt: Date | string;
  actionNames: readonly string[];
  reviewerName: string;
  failedCount: number;
  onClose?: () => void;
}) {
  const { data, loading, error } = useGQLManualActionItemsQuery({
    variables: {
      input: { correlationId, occurredAt, limit: PAGE_SIZE },
    },
  });

  const failuresListed =
    data?.manualActionItems?.items.filter((item) => item.failed).length ?? 0;

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
              {failedCount > 0 ? (
                <>
                  {', '}
                  <span className="text-coop-alert-red">
                    {failedCount} failed
                  </span>
                </>
              ) : null}
            </div>
            {data.manualActionItems.totalCount >
            data.manualActionItems.items.length ? (
              <div className="pb-2 text-xs text-slate-400">
                Showing the first {data.manualActionItems.items.length}. Failed
                items are listed first.
              </div>
            ) : null}
            {failuresListed < failedCount ? (
              <div className="pb-2 text-sm font-medium text-coop-alert-red">
                Only {failuresListed} of {failedCount} failures are listed.
              </div>
            ) : null}
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
