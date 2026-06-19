import { Button } from '@/coop-ui/Button';
import { ItemIdentifier, RelatedItem } from '@roostorg/coop-types';
import uniq from 'lodash/uniq';
import { useRef, useState } from 'react';

import {
  GQLNcmecThreadInput,
  GQLUserItemType,
  useGQLGetMoreInfoForPartialItemsQuery,
  useGQLItemTypesQuery,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../../utils/collections';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import NCMECThreadItemComponent from './NCMECThreadItemComponent';
import { messageToNcmecReportedContent } from './ncmecThreadReportUtils';

export function NCMECThreadComponent(props: {
  threadIdentifier: ItemIdentifier;
  threadItemsWithIpAddress: readonly GQLMessageWithIpAddress[];
  reportedUserIdentifier?: RelatedItem;
  /** Identifiers of the message(s) that triggered the report at enqueue time.
   * Used to mark those specific messages so reviewers know what to act on. */
  reportedMessageIds?: readonly ItemIdentifier[];
  unblurAllMedia: boolean;
  isActionable?: boolean;
  setSelectedThreadsWithMessages: (
    threadsWithMessages: GQLNcmecThreadInput[],
  ) => void;
  selectedThreadsWithMessages: GQLNcmecThreadInput[];
}) {
  const {
    threadIdentifier,
    unblurAllMedia,
    threadItemsWithIpAddress,
    selectedThreadsWithMessages,
    isActionable = false,
  } = props;

  const messageSelectionKey = (messageWithIpAddress: GQLMessageWithIpAddress) =>
    `${messageWithIpAddress.message.id}\u0000${messageWithIpAddress.message.type.id}`;

  const currentSelectedMessages = selectedThreadsWithMessages.find(
    (it) =>
      it.threadId === threadIdentifier.id &&
      it.threadTypeId === threadIdentifier.typeId,
  );

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(
    () =>
      new Set(
        (currentSelectedMessages?.reportedContent ?? []).map(
          (content) => `${content.contentId}\u0000${content.contentTypeId}`,
        ),
      ),
  );

  const isBeingReported =
    selectedThreadsWithMessages.find(
      (it) =>
        it.threadId === threadIdentifier.id &&
        it.threadTypeId === threadIdentifier.typeId,
    ) !== undefined;

  const authors = threadItemsWithIpAddress
    ? uniq(
        filterNullOrUndefined(
          threadItemsWithIpAddress.map((it) =>
            getFieldValueForRole(
              { data: it.message.data, type: it.message.type },
              'creatorId',
            ),
          ),
        ),
      )
    : [];

  // Load info about authors of the messages
  const { data: partialItemsInfo } = useGQLGetMoreInfoForPartialItemsQuery({
    variables: { ids: [...authors] },
  });

  const { data: allItemTypesData } = useGQLItemTypesQuery();

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
  if (threadItemsWithIpAddress.length === 0) {
    return undefined;
  }

  const toggleMessageSelection = (message: GQLMessageWithIpAddress) => {
    const key = messageSelectionKey(message);
    setSelectedMessageKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const addedMessageKeys = new Set(
    (currentSelectedMessages?.reportedContent ?? []).map(
      (content) => `${content.contentId}\u0000${content.contentTypeId}`,
    ),
  );

  const isMessageChecked = (messageWithIpAddress: GQLMessageWithIpAddress) => {
    const key = messageSelectionKey(messageWithIpAddress);
    if (isBeingReported) {
      return addedMessageKeys.has(key);
    }
    return selectedMessageKeys.has(key);
  };

  const messagesToAdd = threadItemsWithIpAddress.filter(
    (m) =>
      selectedMessageKeys.has(messageSelectionKey(m)) &&
      !addedMessageKeys.has(messageSelectionKey(m)),
  );

  // Messages that can still be selected (i.e., not already added to the report).
  const selectableMessageKeys = threadItemsWithIpAddress
    .filter((m) => !addedMessageKeys.has(messageSelectionKey(m)))
    .map(messageSelectionKey);
  const allSelectableSelected =
    selectableMessageKeys.length > 0 &&
    selectableMessageKeys.every((key) => selectedMessageKeys.has(key));

  const toggleSelectAll = () => {
    setSelectedMessageKeys((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) {
        selectableMessageKeys.forEach((key) => next.delete(key));
      } else {
        selectableMessageKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const messagesComponent = [...threadItemsWithIpAddress].map(
    (messageWithIpAddress) => {
      const message = messageWithIpAddress.message;
      const messageCreator = getFieldValueForRole(message, 'creatorId');
      const messageCreatorType = allItemTypesData?.myOrg?.itemTypes.find(
        (it) => it.id === messageCreator?.typeId,
      ) as GQLUserItemType | undefined;

      const timestamp = getFieldValueForRole(message, 'createdAt')!;

      return (
        <div key={message.submissionId}>
          <NCMECThreadItemComponent
            threadItemWithIpAddress={messageWithIpAddress}
            author={messageCreator}
            authorData={getUserDataFromPartialItemResponse(
              messageCreator?.id ?? '',
              messageCreator?.typeId ?? '',
            )}
            authorType={messageCreatorType}
            timestamp={timestamp}
            isActionable={isActionable}
            unblurAllMedia={unblurAllMedia}
            triggeredReport={(props.reportedMessageIds ?? []).some(
              (it) => it.id === message.id && it.typeId === message.type.id,
            )}
            isChecked={isMessageChecked(messageWithIpAddress)}
            checkMessage={toggleMessageSelection}
            isSuspectAuthor={
              props.reportedUserIdentifier?.id === messageCreator?.id &&
              props.reportedUserIdentifier?.typeId === messageCreator?.typeId
            }
            disableChecks={isBeingReported}
          />
        </div>
      );
    },
  );
  return (
    <div className="flex flex-col w-full h-full">
      <div
        className="flex flex-col w-full px-4 py-1 overflow-y-auto divide-y divide-slate-100 max-h-[600px] grow"
        ref={scrollViewRef}
      >
        {messagesComponent}
      </div>
      {isActionable ? (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200">
          {isBeingReported ? (
            <Button
              variant="outline"
              color="red"
              size="sm"
              onClick={() => {
                props.setSelectedThreadsWithMessages(
                  selectedThreadsWithMessages.filter(
                    (it) =>
                      it.threadId !== threadIdentifier.id ||
                      it.threadTypeId !== threadIdentifier.typeId,
                  ),
                );
                setSelectedMessageKeys(new Set());
              }}
            >
              Remove Reported Messages
            </Button>
          ) : undefined}
          {isBeingReported ? undefined : (
            <Button
              variant="outline"
              color="gray"
              size="sm"
              disabled={selectableMessageKeys.length === 0}
              onClick={toggleSelectAll}
            >
              {allSelectableSelected ? 'Deselect all' : 'Select all'}
            </Button>
          )}
          {isBeingReported ? undefined : (
            <Button
              color="indigo"
              size="sm"
              disabled={messagesToAdd.length === 0}
              onClick={() => {
                if (messagesToAdd.length === 0) {
                  return;
                }
                const newReportedContent = messagesToAdd.map(
                  (messageWithIpAddress) =>
                    messageToNcmecReportedContent(
                      messageWithIpAddress,
                      threadIdentifier,
                    ),
                );
                props.setSelectedThreadsWithMessages([
                  ...selectedThreadsWithMessages.filter(
                    (it) =>
                      it.threadId !== threadIdentifier.id ||
                      it.threadTypeId !== threadIdentifier.typeId,
                  ),
                  {
                    threadId: threadIdentifier.id,
                    threadTypeId: threadIdentifier.typeId,
                    reportedContent: [
                      ...(currentSelectedMessages?.reportedContent ?? []),
                      ...newReportedContent,
                    ],
                  },
                ]);
              }}
            >
              {messagesToAdd.length === 1
                ? 'Add Reported Message'
                : `Add ${messagesToAdd.length} Reported Messages`}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
