import { RelatedItem } from '@roostorg/types';
import groupBy from 'lodash/groupBy';

import {
  GQLContentAppealManualReviewJobPayload,
  GQLContentItem,
  GQLContentManualReviewJobPayload,
  GQLItemType,
  GQLThreadAppealManualReviewJobPayload,
  GQLThreadManualReviewJobPayload,
  GQLUserAppealManualReviewJobPayload,
  GQLUserManualReviewJobPayload,
} from '../../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../../utils/collections';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../../ManualReviewJobReview';
import { ManualReviewJobThreadComponent } from './ManualReviewJobThreadComponent';

export default function ManualReviewJobListOfThreadsComponent(props: {
  payload:
    | GQLContentManualReviewJobPayload
    | GQLUserManualReviewJobPayload
    | GQLThreadManualReviewJobPayload
    | GQLContentAppealManualReviewJobPayload
    | GQLThreadAppealManualReviewJobPayload
    | GQLUserAppealManualReviewJobPayload;
  threadMessages: readonly GQLContentItem[];
  thread: RelatedItem;
  allActions: readonly Pick<
    ManualReviewJobAction,
    'name' | 'itemTypes' | 'id' | 'penalty' | '__typename'
  >[];
  allPolicies: readonly { id: string; name: string }[];
  allItemTypes: readonly GQLItemType[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  parentRef: React.RefObject<HTMLDivElement>;
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  unblurAllMedia: boolean;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
}) {
  const {
    payload,
    relatedActions,
    allActions,
    allPolicies,
    allItemTypes,
    onEnqueueActions,
    unblurAllMedia,
    threadMessages,
    thread,
    reportedUserRef,
    isActionable = true,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;

  const { item } = payload;

  // If an item was reported twice, the jobs were likely merged and
  // there may be two separate threads represented in threadItems
  const threadsByThreadId = groupBy(threadMessages, (item) => {
    const threadItemIdentifier = getFieldValueForRole(
      {
        type: item.type,
        data: item.data,
      },
      'threadId',
    );
    return threadItemIdentifier ? threadItemIdentifier.id : 'None';
  });

  const threadComponents = Object.entries(threadsByThreadId).map(
    ([threadId, threadMessages], idx) => {
      const sortedMessages = threadMessages.sort(
        (a, b) =>
          (getFieldValueForRole(a, 'createdAt') ?? '')?.localeCompare(
            getFieldValueForRole(b, 'createdAt') ?? '',
          ),
      );

      return (
        <div key={idx} className="flex flex-col flex-shrink-0 w-full my-2">
          <ManualReviewJobThreadComponent
            key={threadId}
            reportedMessages={
              payload.__typename === 'UserManualReviewJobPayload'
                ? filterNullOrUndefined(payload.reportedItems ?? [])
                : payload.__typename === 'ContentManualReviewJobPayload'
                ? [{ id: item.id, typeId: item.type.id }]
                : []
            }
            reportedUserIdentifier={
              item.__typename === 'UserItem'
                ? { id: item.id, typeId: item.type.id }
                : undefined
            }
            // TODO: This should also get the type ID from the corresponding
            // thread as well
            thread={{ id: threadId, typeId: thread.typeId, name: thread.name }}
            unblurAllMedia={unblurAllMedia}
            lastThreadMessageTime={
              new Date(
                getFieldValueForRole(
                  sortedMessages[sortedMessages.length - 1],
                  'createdAt',
                ) ?? Date.now(),
              )
            }
            allItemTypes={allItemTypes}
            allActions={allActions}
            allPolicies={allPolicies}
            relatedActions={relatedActions}
            onEnqueueActions={onEnqueueActions}
            reporterIdentifier={
              'reportedForReasons' in payload
                ? payload.reportedForReasons?.slice(-2, -1)[0]?.reporterId ??
                  undefined
                : 'appealerIdentifier' in payload
                ? payload.appealerIdentifier ?? undefined
                : undefined
            }
            reportedUserRef={reportedUserRef}
            isActionable={isActionable}
            requirePolicySelectionToEnqueueAction={
              requirePolicySelectionToEnqueueAction
            }
            allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
          />
        </div>
      );
    },
  );

  return (
    <div className="flex flex-col items-start w-full grow">
      {threadComponents.length === 1 ? (
        threadComponents[0]
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex font-bold text-start">
            All Reported Threads for this User
          </div>
          <div className="flex flex-col w-full overflow-auto border border-gray-200 border-solid rounded max-h-[800px] gap-2 p-2">
            {threadComponents}
          </div>
        </div>
      )}
    </div>
  );
}
