import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';
import uniqBy from 'lodash/uniqBy';
import { useState } from 'react';
import { ReadonlyDeep } from 'type-fest';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import FormSectionHeader from '../components/FormSectionHeader';

import {
  GQLContentItem,
  GQLItemType,
  GQLThreadItem,
  GQLUserItem,
  useGQLGetAuthorInfoQuery,
  useGQLGetThreadHistoryQuery,
} from '../../../graphql/generated';
import { filterNullOrUndefined } from '../../../utils/collections';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
  getPrimaryContentFields,
} from '../../../utils/itemUtils';
import { truncateIdIfNeeded } from '../../../utils/string';
import type {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../mrt/manual_review_job/ManualReviewJobReview';
import IframeContentDisplayComponent from '../mrt/manual_review_job/IframeContentDisplayComponent';
import { findFirstIframeUrl, shouldDisplayUrlFieldInIframe } from '../../../utils/contentUrlUtils';
import FieldsComponent from '../mrt/manual_review_job/v2/ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../mrt/manual_review_job/v2/ManualReviewJobMagnifyImageComponent';
import { ManualReviewJobThreadComponent } from '../mrt/manual_review_job/v2/threads/ManualReviewJobThreadComponent';
import ManualReviewJobUserVerticalComponent from '../mrt/manual_review_job/v2/user/ManualReviewJobUserVerticalComponent';
import ItemInvestigationSummary from './ItemInvestigationSummary';

gql`
  query GetAuthorInfo($userIdentifiers: [ItemIdentifierInput!]!) {
    latestItemSubmissions(itemIdentifiers: $userIdentifiers) {
      ... on UserItem {
        id
        data
        submissionId
        submissionTime
        type {
          ... on UserItemType {
            id
            baseFields {
              name
              required
              type
              container {
                containerType
                keyScalarType
                valueScalarType
              }
            }
            schemaFieldRoles {
              displayName
              createdAt
              profileIcon
            }
          }
        }
      }
    }
  }
`;

function ThreadMessageItem(props: {
  message: GQLContentItem;
  author: GQLUserItem | undefined;
  onClick: (author: GQLUserItem | undefined) => void;
}) {
  const { message, author, onClick } = props;

  const timestamp = getFieldValueForRole(message, 'createdAt');
  const authorName = author
    ? getFieldValueForRole(author, 'displayName')
    : getFieldValueForRole(message, 'creatorId')?.id;

  return (
    <div
      className="flex flex-row w-full"
      key={message.id}
      onClick={() => {
        onClick(author);
      }}
    >
      <div className="flex flex-col grow">
        <div className="flex flex-row items-center mt-2">
          <div className="self-start text-xs text-slate-500">
            {truncateIdIfNeeded(authorName, 8)}
          </div>
          <div className="self-end text-xs text-slate-500">
            {`ID: ${message.id}`}
          </div>
          {timestamp ? (
            <div className="self-end text-xs text-slate-500">
              {new Date(timestamp).toLocaleString()}
            </div>
          ) : null}
        </div>
        <div className="flex flex-row items-end mt-2">
          <span className="mr-3">
            <ManualReviewJobMagnifyImageComponent
              imageUrl={
                author
                  ? getFieldValueForRole(author, 'profileIcon')?.url
                  : undefined
              }
              fallbackComponent={
                <UserAlt4 className="p-3 fill-slate-500 w-11" />
              }
              itemIdentifier={{ id: message.id, typeId: message.type.id }}
            />
          </span>
          <div className="flex flex-col grow">
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-col w-full">
                <div className="flex flex-col items-stretch w-full">
                  <FieldsComponent
                    itemTypeId={message.type.id}
                    fields={getPrimaryContentFields(
                      message.type.baseFields,
                      message.data,
                    )}
                    options={{
                      hideLabels: true,
                      maxHeightImage: 300,
                      maxHeightVideo: 300,
                      unblurAllMedia: false,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadInvestigation(props: {
  threadItem: GQLThreadItem;
  rules: Readonly<ReadonlyDeep<{ id: string; actions: { name: string }[] }>[]>;
  itemTypes: readonly GQLItemType[];
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'penalty' | 'id' | 'itemTypes' | 'name'
  >[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
  jobCreatedAt?: Date;
}) {
  const {
    threadItem,
    rules,
    itemTypes,
    allActions,
    allPolicies,
    relatedActions,
    reportedUserRef,
    onEnqueueActions,
    requirePolicySelectionToEnqueueAction,
    allowMoreThanOnePolicySelection,
    jobCreatedAt,
  } = props;

  const [selectedUserIdentifier, setSelectedUserIdentifier] = useState<
    ItemIdentifier | undefined
  >(undefined);
  const {
    data: threadHistoryData,
    error: threadHistoryError,
    loading: threadHistoryLoading,
  } = useGQLGetThreadHistoryQuery({
    variables: {
      threadIdentifier: { id: threadItem.id, typeId: threadItem.type.id },
    },
  });

  const threadItems =
    threadHistoryData?.threadHistory?.map((it) => it.latest) ?? [];

  const authorIdentifiers = uniqBy(
    filterNullOrUndefined(
      threadItems
        .filter((it): it is GQLContentItem => it.__typename === 'ContentItem')
        .map((message) => {
          return getFieldValueForRole(message, 'creatorId');
        }),
    ),
    (it) => `${it.id}-${it.typeId}`,
  );

  const { data } = useGQLGetAuthorInfoQuery({
    variables: {
      userIdentifiers: authorIdentifiers,
    },
    skip: authorIdentifiers.length === 0,
  });

  const authorInfo =
    data?.latestItemSubmissions.filter(
      (it): it is GQLUserItem => it.__typename === 'UserItem',
    ) ?? [];

  // Check if all thread items contain URLs that should be displayed in iframes
  const hasAllIframeUrls = threadItems.every((it) => {
    if (!('type' in it)) {
      return false;
    }
    const urlFields = it.type.baseFields.filter((it) => it.type === 'URL');
    const urls = urlFields.map((urlField) =>
      getFieldValueOrValues(it.data, urlField),
    );
    return urls.some(shouldDisplayUrlFieldInIframe);
  });

  const threadContentItems = [...threadItems].filter(
    (it): it is GQLContentItem => it.__typename === 'ContentItem',
  );

  const threadComponents = threadContentItems
    .sort((a, b) => {
      const [a_timestamp, b_timestamp] = [
        getFieldValueForRole(a, 'createdAt'),
        getFieldValueForRole(b, 'createdAt'),
      ];

      if (a_timestamp == null && b_timestamp == null) {
        return 0;
      } else if (a_timestamp == null) {
        return -1;
      } else if (b_timestamp == null) {
        return 1;
      }
      return a_timestamp.localeCompare(b_timestamp);
    })
    .map((message) => {
      const urlFields = message.type.baseFields.filter(
        (it) => it.type === 'URL',
      );
      const urls = urlFields.map((urlField) =>
        getFieldValueOrValues(message.data, urlField),
      );
      const firstIframeUrl = findFirstIframeUrl(urls);
      if (
        firstIframeUrl &&
        'type' in firstIframeUrl &&
        firstIframeUrl.type === 'URL'
      ) {
        return (
          <IframeContentDisplayComponent
            key={message.id}
            contentUrl={firstIframeUrl.value}
          />
        );
      }
      return (
        <ThreadMessageItem
          key={message.id}
          message={message}
          onClick={(author) => {
            setSelectedUserIdentifier(
              author ? { id: author.id, typeId: author.type.id } : undefined,
            );
          }}
          author={
            authorInfo?.length > 0
              ? authorInfo.find(
                  (it) =>
                    it.id === getFieldValueForRole(message, 'creatorId')?.id,
                )
              : undefined
          }
        />
      );
    });

  const selectedUser = authorInfo.find(
    (it) => it.id === selectedUserIdentifier?.id,
  );
  const threadComponentsOrLoading = threadHistoryLoading ? (
    <FullScreenLoading />
  ) : threadHistoryError ? (
    <div>Error: {threadHistoryError.message}</div>
  ) : (
    threadComponents
  );

  return (
    <div className="flex flex-col w-full mb-8">
      <div className="flex flex-row">
        <ItemInvestigationSummary
          item={{
            id: threadItem.id,
            data: threadItem.data,
            itemType: threadItem.type,
            submissionTime: threadItem.submissionTime
              ? new Date(threadItem.submissionTime).toISOString()
              : undefined,
          }}
          rules={rules}
          itemTypes={itemTypes}
        />
      </div>
      {!hasAllIframeUrls ? (
        <ManualReviewJobThreadComponent
          reportedMessages={[]}
          thread={{
            id: threadItem.id,
            typeId: threadItem.type.id,
          }}
          unblurAllMedia={false}
          lastThreadMessageTime={new Date(jobCreatedAt ?? Date.now())}
          allItemTypes={itemTypes}
          allActions={allActions}
          allPolicies={allPolicies}
          relatedActions={relatedActions}
          reportedUserRef={reportedUserRef}
          onEnqueueActions={onEnqueueActions}
          isActionable={false}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <FormSectionHeader title="Pages in this Workspace" />
          {threadComponentsOrLoading}
        </div>
      )}
      <div className="w-px h-full mx-4 bg-gray-200" />
      {selectedUser && (
        <div className="self-start">
          <ManualReviewJobUserVerticalComponent user={selectedUser} />
        </div>
      )}
    </div>
  );
}
