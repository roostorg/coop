import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { gql } from '@apollo/client';
import { ItemIdentifier, RelatedItem } from '@roostorg/types';
import { Button } from 'antd';
import uniq from 'lodash/uniq';
import { useEffect, useRef, useState } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import CoopModal from '../../../../components/CoopModal';

import {
  GQLBaseField,
  GQLContentItem,
  GQLItemType,
  GQLUserItemType,
  useGQLGetMoreInfoForPartialItemsQuery,
  useGQLGetThreadHistoryQuery,
  useGQLItemTypesQuery,
  useGQLOrgDataQuery,
} from '../../../../../../graphql/generated';
import {
  arrayFromArrayOrSingleItem,
  filterNullOrUndefined,
} from '../../../../../../utils/collections';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import { ITEM_FRAGMENT } from '../../../../item_types/ItemTypesDashboard';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../../ManualReviewJobReview';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobRelatedActionsButtonPanel from '../ManualReviewJobRelatedActionsButtonPanel';
import ManualReviewJobRelatedUserComponent from '../user/ManualReviewJobRelatedUserComponent';
import ManualReviewJobThreadItemComponent from './ManualReviewJobThreadItemComponent';
import {
  areAllUsersMessagesSelected,
  deselectAllUsersMessages,
  selectAllUsersMessages,
} from './mrtThreadUtils';

gql`
  ${ITEM_FRAGMENT}
  query getMoreInfoForPartialItems($ids: [ItemIdentifierInput!]!) {
    partialItems(input: $ids) {
      ... on PartialItemsSuccessResponse {
        items {
          ...ItemFields
        }
      }
      ... on PartialItemsMissingEndpointError {
        title
        status
        type
      }
      ... on PartialItemsEndpointResponseError {
        title
        status
        type
      }
      ... on PartialItemsInvalidResponseError {
        title
        status
        type
      }
    }
  }
`;

export function ManualReviewJobThreadComponent(props: {
  reportedUserIdentifier?: ItemIdentifier;
  reportedMessages: readonly ItemIdentifier[];
  thread: RelatedItem;
  unblurAllMedia: boolean;
  lastThreadMessageTime: Date;
  allItemTypes: readonly GQLItemType[];
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'penalty' | 'id' | 'itemTypes' | 'name'
  >[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  reporterIdentifier?: ItemIdentifier;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
}) {
  const {
    reportedUserIdentifier,
    unblurAllMedia,
    thread,
    lastThreadMessageTime,
    allItemTypes,
    allActions,
    allPolicies,
    onEnqueueActions,
    relatedActions,
    reporterIdentifier,
    isActionable = false,
    reportedMessages,
    reportedUserRef,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;

  const { loading, error, data } = useGQLGetThreadHistoryQuery({
    variables: {
      threadIdentifier: { id: thread.id, typeId: thread.typeId },
      endDate: lastThreadMessageTime,
    },
  });
  const { data: allItemTypesData } = useGQLItemTypesQuery();
  const { data: orgData } = useGQLOrgDataQuery();

  const [selectedMessages, setSelectedMessages] = useState<GQLContentItem[]>(
    [],
  );
  const [modalData, setModalData] = useState<{
    relatedUser: RelatedItem | undefined;
    modalVisible: boolean;
  }>({ relatedUser: undefined, modalVisible: false });
  const { relatedUser, modalVisible } = modalData;
  const inspectUserModal = (
    <CoopModal
      title="Inspected User"
      visible={modalVisible}
      onClose={() =>
        setModalData({ relatedUser: undefined, modalVisible: false })
      }
      hideCloseButton={false}
    >
      {relatedUser ? (
        <ManualReviewJobRelatedUserComponent
          user={relatedUser}
          reportedUserIdentifier={reportedUserIdentifier}
          allActions={allActions}
          allPolicies={allPolicies}
          allItemTypes={allItemTypes}
          relatedActions={relatedActions}
          onEnqueueAction={(action) => onEnqueueActions([action])}
          unblurAllMedia={unblurAllMedia}
          setSelectedUser={(user) =>
            setModalData({ relatedUser: user, modalVisible: true })
          }
          isReporter={reporterIdentifier?.id === relatedUser.id}
          isActionable={isActionable}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
      ) : null}
    </CoopModal>
  );

  const targetChildRef = useRef<HTMLDivElement>(null);
  const scrollViewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll the target child element into view when the component mounts

    const child = targetChildRef.current;
    const scrollView = scrollViewRef.current;
    if (child && scrollView) {
      const childPos = child.getBoundingClientRect().top;
      const scrollPos = scrollView.getBoundingClientRect().top;
      const offset = 50;
      scrollView.scrollTop =
        childPos - scrollPos - offset + scrollView.scrollTop;
    }
  }, []);

  const authors = data
    ? uniq(
        filterNullOrUndefined(
          data?.threadHistory.map(({ latest }) =>
            latest.__typename === 'ContentItem'
              ? getFieldValueForRole(
                  { data: latest.data, type: latest.type },
                  'creatorId',
                )
              : undefined,
          ),
        ),
      )
    : [];

  // Load info about thread and authors of the messages
  const { data: partialItemsInfo, loading: partialItemsLoading } =
    useGQLGetMoreInfoForPartialItemsQuery({
      variables: { ids: [thread, ...authors] },
    });

  const partialItemsThreadData = (() => {
    if (
      partialItemsInfo?.partialItems.__typename ===
      'PartialItemsSuccessResponse'
    ) {
      const threadData = partialItemsInfo.partialItems.items.find(
        (it) => it.__typename === 'ThreadItem' && it.id === thread.id,
      );
      // Extra check for type narrowing
      if (threadData?.__typename === 'ThreadItem') {
        return threadData;
      }
    }
    return undefined;
  })();
  const threadInfoItems = (() => {
    if (partialItemsThreadData) {
      return partialItemsThreadData.type.baseFields
        .filter(
          (it) =>
            it.name !==
            partialItemsThreadData.type.schemaFieldRoles.displayName,
        )
        .map((itemTypeField) => {
          return {
            ...(itemTypeField as GQLBaseField),
            value: partialItemsThreadData.data[itemTypeField.name],
          } as ItemTypeFieldFieldData;
        });
    }
  })();

  const getUserDataFromPartialItemResponse = (id: string, typeId: string) => {
    return partialItemsInfo?.partialItems.__typename ===
      'PartialItemsSuccessResponse'
      ? partialItemsInfo.partialItems.items.find(
          (it) =>
            it.__typename === 'UserItem' &&
            it.id === id &&
            it.type.id === typeId,
        )?.data
      : undefined;
  };
  if (!data || data.threadHistory.length === 0) {
    return null;
  }
  const newMessages = data.threadHistory
    .map((itemSubmission) => itemSubmission.latest as GQLContentItem)
    .sort((a, b) =>
      (getFieldValueForRole(a, 'createdAt') ?? '').localeCompare(
        getFieldValueForRole(b, 'createdAt') ?? '',
      ),
    );

  const firstVisibleMessage = reportedUserIdentifier
    ? newMessages.find(
        (it) =>
          getFieldValueForRole(it, 'creatorId')?.id ===
          reportedUserIdentifier.id,
      )
    : undefined;

  const threadComponent = [...newMessages].map((message, i) => {
    const messageCreator = getFieldValueForRole(message, 'creatorId');
    const messageCreatorType = allItemTypesData?.myOrg?.itemTypes.find(
      (it) => it.id === messageCreator?.typeId,
    ) as GQLUserItemType | undefined;

    const timestamp = getFieldValueForRole(message, 'createdAt');

    const isByReportedUser = reportedUserIdentifier
      ? messageCreator?.id === reportedUserIdentifier.id
      : false;
    return (
      <div
        key={message.submissionId}
        ref={
          firstVisibleMessage && message.id === firstVisibleMessage?.id
            ? targetChildRef
            : undefined
        }
      >
        <ManualReviewJobThreadItemComponent
          threadItem={message}
          author={messageCreator}
          authorType={messageCreatorType}
          timestamp={timestamp}
          authorData={
            messageCreator
              ? getUserDataFromPartialItemResponse(
                  messageCreator.id,
                  messageCreator.typeId,
                )
              : undefined
          }
          options={{
            isByReportedUser,
            isReportedMessage:
              reportedMessages.findIndex(
                (it) => it.id === message.id && it.typeId === message.type.id,
              ) !== -1,
            isSelected: selectedMessages.some((it) => it.id === message.id),
            unblurAllMedia,
            isReporter: false,
          }}
          selectAllUsersMessages={selectAllUsersMessages.bind(
            null,
            newMessages,
            selectedMessages,
            setSelectedMessages,
          )}
          deselectAllUsersMessages={deselectAllUsersMessages.bind(
            null,
            selectedMessages,
            setSelectedMessages,
          )}
          inspectUser={(user) => {
            if (
              reportedUserIdentifier &&
              reportedUserRef &&
              user.id === reportedUserIdentifier.id
            ) {
              reportedUserRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
              setModalData({ relatedUser: user, modalVisible: true });
            }
          }}
          showInspectedUser={() => {}}
          areAllUsersMessagesSelected={() =>
            areAllUsersMessagesSelected(
              newMessages,
              selectedMessages,
              reportedUserIdentifier,
            )
          }
          selectMessage={(message) =>
            setSelectedMessages([...selectedMessages, message])
          }
          deselectMessage={(message) =>
            setSelectedMessages(
              selectedMessages.filter((it) => it.id !== message.id),
            )
          }
          isActionable={isActionable}
        />
      </div>
    );
  });

  const displayNameField =
    partialItemsThreadData?.type?.schemaFieldRoles?.displayName;
  const threadTypeName = allItemTypesData?.myOrg?.itemTypes.find(
    (it) => it.id === thread.typeId,
  )?.name;
  const threadName =
    orgData?.myOrg?.id === '488cb41d501'
      ? `Script for Video ${thread.id}`
      : displayNameField
      ? `${threadTypeName}: ${partialItemsThreadData?.data[displayNameField]}`
      : threadTypeName
      ? `${threadTypeName} ID: ${thread.id}`
      : `Thread ID: ${thread.id}`;

  if (loading) {
    return <ComponentLoading />;
  }

  if (error) {
    return <div>Error loading user submissions: {error.message}</div>;
  }

  return (
    <>
      <div className="flex flex-col items-start w-full bg-white border border-gray-200 border-solid rounded-lg grow">
        {partialItemsLoading ? (
          <ComponentLoading />
        ) : (
          <div className="flex flex-col w-full p-5 bg-white rounded-lg space-y-1">
            <div className="flex flex-row items-center gap-4">
              <div className="font-bold text-start bg-slate-200 px-2 py-0.5 rounded w-fit self-center">
                {threadName}
              </div>
              {isActionable && (
                <ManualReviewJobRelatedActionsButtonPanel
                  actions={allActions.filter(
                    (action) =>
                      action.itemTypes
                        .map((it) => it.id)
                        .includes(thread.typeId) &&
                      // TODO: Delete when we can do this in a more robust way on the server.
                      action.__typename !== 'EnqueueToNcmecAction',
                  )}
                  allPolicies={allPolicies}
                  selectedPolicyIds={(action) =>
                    relatedActions
                      .filter(
                        (relatedAction) =>
                          relatedAction.target.identifier.itemId ===
                            thread?.id && relatedAction.action.id === action.id,
                      )
                      .flatMap((relatedAction) =>
                        relatedAction.policies.map((it) => it.id),
                      )
                  }
                  onChangeSelectedPolicies={(action, selectedPolicyIds) =>
                    onEnqueueActions([
                      {
                        action,
                        policies: allPolicies.filter((policy) =>
                          arrayFromArrayOrSingleItem(
                            selectedPolicyIds,
                          ).includes(policy.id),
                        ),
                        target: {
                          identifier: {
                            itemId: thread.id,
                            itemTypeId: thread.typeId,
                          },
                          displayName: thread.name ?? thread.id,
                        },
                      },
                    ])
                  }
                  requirePolicySelection={requirePolicySelectionToEnqueueAction}
                  allowMoreThanOnePolicySelection={
                    allowMoreThanOnePolicySelection
                  }
                />
              )}
            </div>
            {threadInfoItems != null &&
              !threadInfoItems.every((it) => it.value === undefined) && (
                <FieldsComponent
                  fields={threadInfoItems}
                  // Assertion is safe because partialItemsThreadData needs to be
                  // non-null for threadInfoItems to be non-null
                  itemTypeId={partialItemsThreadData!.type.id}
                  options={{
                    maxHeightImage: 300,
                    maxHeightVideo: 300,
                  }}
                />
              )}
          </div>
        )}
        <div className="divider" />
        <div
          className="flex flex-col w-full overflow-auto max-h-[600px] gap-2 p-5"
          ref={scrollViewRef}
        >
          {threadComponent}
        </div>
      </div>
      {isActionable && (
        <>
          <div className="flex flex-row self-end mt-2">
            <Button
              className="text-sm cursor-pointer rounded-md"
              onClick={() => setSelectedMessages([...newMessages])}
            >
              Select All
            </Button>
            {selectedMessages.length > 0 && (
              <Button
                className="ml-2 text-sm cursor-pointer rounded-md"
                onClick={() => setSelectedMessages([])}
              >
                Deselect All
              </Button>
            )}
          </div>
          {selectedMessages.length > 0 && (
            <>
              <div className="mt-2 font-bold">
                Action on all selected messages above
              </div>
              <ManualReviewJobRelatedActionsButtonPanel
                actions={allActions.filter((it) => {
                  const allSelectedItemTypeIds = filterNullOrUndefined(
                    uniq(
                      selectedMessages.map((message) => {
                        const messageCreator = getFieldValueForRole(
                          message,
                          'creatorId',
                        );
                        return messageCreator?.typeId;
                      }),
                    ),
                  );
                  return it.itemTypes.some((itemType) =>
                    allSelectedItemTypeIds.includes(itemType.id),
                  );
                })}
                allPolicies={allPolicies}
                selectedPolicyIds={(action) => {
                  const messageAuthorIds = uniq(
                    filterNullOrUndefined(
                      selectedMessages.map(
                        (message) =>
                          getFieldValueForRole(message, 'creatorId')?.id,
                      ),
                    ),
                  );

                  // We can have any combination of selected users, so in order
                  // to determine what policies to show as selected, we need to
                  // pull out all related actions that correspond to this given
                  // action and set of authors, and then pull out all their
                  // policy IDs and flatten that to get the set of policies that
                  // the button should show as selected.
                  return relatedActions
                    .filter(
                      (relatedAction) =>
                        relatedAction.action.id === action.id &&
                        messageAuthorIds.includes(
                          relatedAction.target.identifier.itemId,
                        ),
                    )
                    .flatMap((relatedAction) =>
                      relatedAction.policies.map((it) => it.id),
                    );
                }}
                onChangeSelectedPolicies={(action, selectedPolicyIds) => {
                  // We need to enqueue a related action for each author of each
                  // selected message, so we iterate over each selected
                  // messages, dedupe the authors, and enqueue a related action
                  // for each one.
                  const messageAuthors = uniq(
                    filterNullOrUndefined(
                      selectedMessages.map((message) =>
                        getFieldValueForRole(message, 'creatorId'),
                      ),
                    ),
                  );

                  onEnqueueActions(
                    messageAuthors.map((author) => ({
                      action,
                      policies: allPolicies.filter((policy) =>
                        arrayFromArrayOrSingleItem(selectedPolicyIds).includes(
                          policy.id,
                        ),
                      ),
                      target: {
                        identifier: {
                          itemId: author.id,
                          itemTypeId: author.typeId,
                        },
                        displayName: author.name ?? author.id,
                      },
                    })),
                  );
                }}
                requirePolicySelection={requirePolicySelectionToEnqueueAction}
                allowMoreThanOnePolicySelection={
                  allowMoreThanOnePolicySelection
                }
              />
            </>
          )}
        </>
      )}
      {inspectUserModal}
    </>
  );
}
