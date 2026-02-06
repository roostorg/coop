import { ItemIdentifier, RelatedItem } from '@roostorg/types';
import { Button } from 'antd';
import uniq from 'lodash/uniq';
import { useEffect, useRef, useState } from 'react';

import CoopModal from '../../../components/CoopModal';

import {
  GQLContentItem,
  GQLItemType,
  GQLUserItemType,
  useGQLGetMoreInfoForPartialItemsQuery,
  useGQLItemTypesQuery,
} from '../../../../../graphql/generated';
import {
  arrayFromArrayOrSingleItem,
  filterNullOrUndefined,
} from '../../../../../utils/collections';
import {
  getFieldValueForRole,
} from '../../../../../utils/itemUtils';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../ManualReviewJobReview';
import ManualReviewJobRelatedActionsButtonPanel from './ManualReviewJobRelatedActionsButtonPanel';
import ManualReviewJobThreadItemComponent from './threads/ManualReviewJobThreadItemComponent';
import {
  areAllUsersMessagesSelected,
  deselectAllUsersMessages,
  selectAllUsersMessages,
} from './threads/mrtThreadUtils';
import ManualReviewJobRelatedUserComponent from './user/ManualReviewJobRelatedUserComponent';

export function ManualReviewJobOtherItemsComponent(props: {
  reportedUserIdentifier?: ItemIdentifier;
  reportedMessages: readonly ItemIdentifier[];
  otherItems: readonly GQLContentItem[];
  unblurAllMedia: boolean;
  allItemTypes: readonly GQLItemType[];
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'itemTypes' | 'name' | 'id' | 'penalty'
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
    allItemTypes,
    allActions,
    allPolicies,
    otherItems,
    onEnqueueActions,
    relatedActions,
    reporterIdentifier,
    isActionable = false,
    reportedMessages,
    reportedUserRef,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;
  const { data: allItemTypesData } = useGQLItemTypesQuery();

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

  const authors = otherItems
    ? uniq(
        filterNullOrUndefined(
          otherItems.map((it) =>
            getFieldValueForRole({ data: it.data, type: it.type }, 'creatorId'),
          ),
        ),
      )
    : [];

  // Load info about authors of the messages
  const { data: partialItemsInfo } = useGQLGetMoreInfoForPartialItemsQuery({
    variables: { ids: [...authors] },
  });

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
  if (otherItems.length === 0) {
    return undefined;
  }

  const firstVisibleMessage = reportedUserIdentifier
    ? otherItems.find(
        (it) =>
          getFieldValueForRole(it, 'creatorId')?.id ===
          reportedUserIdentifier.id,
      )
    : undefined;

  const messagesComponent = [...otherItems].map((message, i) => {
    const messageCreator = getFieldValueForRole(message, 'creatorId');
    const messageCreatorType = allItemTypesData?.myOrg?.itemTypes.find(
      (it) => it.id === messageCreator?.typeId,
    ) as GQLUserItemType | undefined;

    const timestamp = getFieldValueForRole(message, 'createdAt');

    const isByReportedUser = reportedUserIdentifier
      ? messageCreator?.id === reportedUserIdentifier.id
      : false;
    const manualReviewJobThreadItemComponentOptions = {
      isByReportedUser,
      isReportedMessage:
        reportedMessages.findIndex(
          (it) => it.id === message.id && it.typeId === message.type.id,
        ) !== -1,
      isSelected: selectedMessages.some((it) => it.id === message.id),
      unblurAllMedia,
      isReporter: false,
    };
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
          options={manualReviewJobThreadItemComponentOptions}
          selectAllUsersMessages={selectAllUsersMessages.bind(
            null,
            otherItems,
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
              otherItems,
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
  return (
    <div className="flex flex-col items-start w-full gap-2 grow">
      <div
        className="flex flex-col w-full overflow-auto border border-gray-200 border-solid rounded-lg max-h-[600px] gap-2 p-5 bg-white"
        ref={scrollViewRef}
      >
        {messagesComponent}
      </div>
      {isActionable && (
        <>
          <div className="flex flex-row self-end mt-2">
            <Button
              className="text-sm cursor-pointer rounded-md"
              onClick={() => setSelectedMessages([...otherItems])}
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
                Action on all authors of selected messages above
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
          {selectedMessages.length > 0 && (
            <>
              <div className="mt-2 font-bold">
                Action on all selected messages above
              </div>
              <ManualReviewJobRelatedActionsButtonPanel
                actions={allActions.filter((it) => {
                  const allSelectedItemTypeIds = filterNullOrUndefined(
                    uniq(selectedMessages.map((message) => message.type.id)),
                  );
                  return it.itemTypes.some((itemType) =>
                    allSelectedItemTypeIds.includes(itemType.id),
                  );
                })}
                allPolicies={allPolicies}
                selectedPolicyIds={(action) => {
                  const selectedItemIds = uniq(
                    selectedMessages.map((message) => message.id),
                  );

                  // We can have any combination of selected items, so in order
                  // to determine what policies to show as selected, we need to
                  // pull out all related actions that correspond to this given
                  // action and set of items, and then pull out all their
                  // policy IDs and flatten that to get the set of policies that
                  // the button should show as selected.
                  return relatedActions
                    .filter(
                      (relatedAction) =>
                        relatedAction.action.id === action.id &&
                        selectedItemIds.includes(
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
                  onEnqueueActions(
                    selectedMessages.map((message) => ({
                      action,
                      policies: allPolicies.filter((policy) =>
                        arrayFromArrayOrSingleItem(selectedPolicyIds).includes(
                          policy.id,
                        ),
                      ),
                      target: {
                        identifier: {
                          itemId: message.id,
                          itemTypeId: message.type.id,
                        },
                        displayName: message.id,
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
    </div>
  );
}
