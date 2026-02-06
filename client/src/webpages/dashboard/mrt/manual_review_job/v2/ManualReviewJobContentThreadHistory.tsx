import { gql } from '@apollo/client';
import { RelatedItem } from '@roostorg/types';

import {
  GQLContentAppealManualReviewJobPayload,
  GQLContentItem,
  GQLContentManualReviewJobPayload,
  GQLItemType,
  GQLThreadAppealManualReviewJobPayload,
  GQLThreadManualReviewJobPayload,
  useGQLGetThreadHistoryQuery,
} from '../../../../../graphql/generated';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../ManualReviewJobReview';
import ManualReviewJobListOfThreadsComponent from './threads/ManualReviewJobListOfThreadsComponent';

gql`
  query getThreadHistory(
    $threadIdentifier: ItemIdentifierInput!
    $endDate: DateTime
  ) {
    threadHistory(threadIdentifier: $threadIdentifier, endDate: $endDate) {
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

export default function ManualReviewJobContentThreadHistory(props: {
  payload:
    | GQLContentManualReviewJobPayload
    | GQLThreadManualReviewJobPayload
    | GQLThreadAppealManualReviewJobPayload
    | GQLContentAppealManualReviewJobPayload;
  thread: RelatedItem;
  allActions: readonly ManualReviewJobAction[];
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
    parentRef,
    reportedUserRef,
    unblurAllMedia,
    thread,
    isActionable = false,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;

  const { data } = useGQLGetThreadHistoryQuery({
    variables: {
      threadIdentifier: { id: thread.id, typeId: thread.typeId },
      endDate: payload.item.submissionTime ?? undefined,
    },
  });

  if (
    data?.threadHistory.length !== undefined &&
    data.threadHistory.length > 0
  ) {
    return (
      <ManualReviewJobListOfThreadsComponent
        payload={payload}
        thread={thread}
        threadMessages={data.threadHistory.map(
          (itemSubmission) => itemSubmission.latest as GQLContentItem,
        )}
        allActions={allActions}
        allItemTypes={allItemTypes}
        relatedActions={relatedActions}
        allPolicies={allPolicies}
        onEnqueueActions={onEnqueueActions}
        parentRef={parentRef}
        reportedUserRef={reportedUserRef}
        unblurAllMedia={unblurAllMedia}
        isActionable={isActionable}
        requirePolicySelectionToEnqueueAction={
          requirePolicySelectionToEnqueueAction
        }
        allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
      />
    );
  }
  return <div />;
}
