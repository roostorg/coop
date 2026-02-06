import { filterNullOrUndefined } from '@/utils/collections';
import { gql } from '@apollo/client';
import { ItemIdentifier, RelatedItem } from '@roostorg/types';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import { useMemo } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import {
  GQLItemType,
  useGQLGetLatestUserSubmittedItemsQuery,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import { jsonStringify } from '../../../../../../utils/typescript-types';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../../ManualReviewJobReview';
import ContentRelatedItemComponent from '../ContentRelatedItemComponent';
import { ManualReviewJobThreadComponent } from '../threads/ManualReviewJobThreadComponent';

gql`
  query getLatestUserSubmittedItems(
    $itemIdentifier: ItemIdentifierInput!
    $oldestReturnedSubmissionDate: DateTime
    $earliestReturnedSubmissionDate: DateTime
  ) {
    latestItemsCreatedBy(
      itemIdentifier: $itemIdentifier
      oldestReturnedSubmissionDate: $oldestReturnedSubmissionDate
      earliestReturnedSubmissionDate: $earliestReturnedSubmissionDate
    ) {
      latest {
        ... on ContentItem {
          id
          submissionId
          data
          type {
            id
            name
            baseFields {
              name
              type
              required
              container {
                containerType
                keyScalarType
                valueScalarType
              }
            }
            schemaFieldRoles {
              displayName
              parentId
              threadId
              createdAt
              creatorId
            }
          }
        }
      }
    }
  }
`;

export default function ManualReviewJobLatestSubmissionsWithThreadComponent(props: {
  userIdentifier: ItemIdentifier;
  reportedUserIdentifier?: ItemIdentifier;
  reportedMessages?: readonly ItemIdentifier[];
  unblurAllMedia: boolean;
  allItemTypes: readonly GQLItemType[];
  allActions: readonly ManualReviewJobAction[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  setRelatedUser: (user: RelatedItem) => void;
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
  endDate?: Date;
}) {
  const {
    userIdentifier,
    reportedUserIdentifier,
    reportedMessages,
    unblurAllMedia,
    allItemTypes,
    allActions,
    allPolicies,
    relatedActions,
    reportedUserRef,
    onEnqueueActions,
    isActionable = true,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
    endDate,
  } = props;
  const { data, loading, error } = useGQLGetLatestUserSubmittedItemsQuery({
    variables: {
      itemIdentifier: userIdentifier,
      earliestReturnedSubmissionDate: endDate,
    },
  });

  const dataValues = useMemo(() => {
    return data?.latestItemsCreatedBy.map((itemSubmission) => {
      if (itemSubmission.latest.__typename !== 'ContentItem') {
        return undefined;
      }
      const createdAt = getFieldValueForRole(
        itemSubmission.latest,
        'createdAt',
      );
      const threadId = getFieldValueForRole(itemSubmission.latest, 'threadId');
      const creatorId = getFieldValueForRole(
        itemSubmission.latest,
        'creatorId',
      );
      return {
        itemId: itemSubmission.latest.id,
        itemData: itemSubmission.latest.data,
        itemTypeId: itemSubmission.latest.type.id,
        itemTypeName: itemSubmission.latest.type.name,
        itemTypeFields: itemSubmission.latest.type.baseFields,
        dateCreated: createdAt,
        threadId,
        creatorId,
      };
    });
  }, [data]);

  const threadsByThreadId = useMemo(() => {
    return groupBy(dataValues, (item) => {
      if (item?.threadId == null) {
        return 'NONE';
      }
      return jsonStringify<ItemIdentifier>({
        id: item.threadId.id,
        typeId: item.threadId.typeId,
      });
    });
  }, [dataValues]);

  const threadsWithMessageCount = useMemo(() => {
    return Object.entries(threadsByThreadId).map(
      ([threadIdString, threadMessagesByUser]) => {
        const lastUserSubmission = threadMessagesByUser.sort((a, b) =>
          (a?.dateCreated ?? '').localeCompare(b?.dateCreated ?? ''),
        )[0];

        return {
          threadId: threadIdString,
          lastUserSubmission,
          count: threadMessagesByUser.length,
        };
      },
    );
  }, [threadsByThreadId]);
  const nonThreadItems = threadsByThreadId['NONE'] ?? [];

  const threadHistories = useMemo(
    () =>
      sortBy(threadsWithMessageCount, 'count')
        .slice(0, 10)
        .map((threadObj) => {
          if (!threadObj) {
            return null;
          }
          const threadId = threadObj.lastUserSubmission?.threadId;
          if (!threadId) {
            return null;
          }
          return {
            thread: threadId,
            lastUserSubmissionTime: threadObj.lastUserSubmission?.dateCreated,
          };
        }),
    [threadsWithMessageCount],
  );

  const threads = threadHistories.map((singleThread, i) => {
    if (!singleThread) {
      return null;
    }
    const { thread, lastUserSubmissionTime } = singleThread;
    return (
      <div className="flex flex-col" key={thread.id}>
        <ManualReviewJobThreadComponent
          reportedUserIdentifier={reportedUserIdentifier}
          reportedMessages={reportedMessages ?? []}
          thread={thread}
          unblurAllMedia={unblurAllMedia}
          lastThreadMessageTime={
            new Date(endDate ?? lastUserSubmissionTime ?? Date.now())
          }
          allItemTypes={allItemTypes}
          allActions={allActions}
          allPolicies={allPolicies}
          relatedActions={relatedActions}
          reportedUserRef={reportedUserRef}
          onEnqueueActions={onEnqueueActions}
          isActionable={isActionable}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
        {i < threadHistories.length - 1 ? (
          <div className="flex h-px my-4 bg-slate-200" />
        ) : null}
      </div>
    );
  });
  const nonThreadItemComponents = filterNullOrUndefined(
    nonThreadItems.map((item) => {
      if (!item) {
        return null;
      }
      return (
        <ContentRelatedItemComponent
          relatedItem={{
            id: item.itemId,
            typeId: item.itemTypeId,
          }}
          unblurAllMedia={unblurAllMedia}
          title={`${item.itemTypeName}`}
          key={item.itemId}
        />
      );
    }),
  );

  if (loading) {
    return <ComponentLoading />;
  }

  if (error) {
    return <div>Error loading user submissions: {error.message}</div>;
  }

  if (data == null || data.latestItemsCreatedBy.length === 0) {
    return (
      <div className="flex flex-col items-start">
        <div className="text-base font-semibold text-zinc-900">
          Reported User's Submission History
        </div>
        <div>No submissions found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full mt-6 text-start">
      <div className="mb-2 text-base font-semibold">
        Additional Items From This User
      </div>
      {threads}
      {nonThreadItemComponents.length > 0 ? nonThreadItemComponents : null}
    </div>
  );
}
