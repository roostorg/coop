import { ItemIdentifier, RelatedItem } from '@roostorg/types';
import { Button } from 'antd';
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
import {
  getFieldValueForRole,
  getFieldValueOrValues,
} from '../../../../../../utils/itemUtils';
import NCMECThreadItemComponent from './NCMECThreadItemComponent';

export function NCMECThreadComponent(props: {
  threadIdentifier: ItemIdentifier;
  threadItemsWithIpAddress: readonly GQLMessageWithIpAddress[];
  reportedUserIdentifier?: RelatedItem;
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

  const currentSelectedMessages = selectedThreadsWithMessages.find(
    (it) =>
      it.threadId === threadIdentifier.id &&
      it.threadTypeId === threadIdentifier.typeId,
  );
  const firstMessage = threadItemsWithIpAddress.find(
    (it) =>
      it.message.id === currentSelectedMessages?.reportedContent[0].contentId &&
      it.message.type.id ===
        currentSelectedMessages?.reportedContent[0].contentTypeId,
  );
  const secondMessage = threadItemsWithIpAddress.find(
    (it) =>
      it.message.id ===
        currentSelectedMessages?.reportedContent[
          currentSelectedMessages?.reportedContent.length - 1
        ].contentId &&
      it.message.type.id ===
        currentSelectedMessages?.reportedContent[
          currentSelectedMessages?.reportedContent.length - 1
        ].contentTypeId,
  );

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const [selectedMessagePair, setSelectedMessagePair] = useState<
    | {
        firstMessage: GQLMessageWithIpAddress;
        secondMessage?: GQLMessageWithIpAddress;
      }
    | undefined
  >(firstMessage ? { firstMessage, secondMessage } : undefined);

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

  const checkMessage = (message: GQLMessageWithIpAddress) => {
    if (selectedMessagePair === undefined) {
      setSelectedMessagePair({ firstMessage: message });
    } else if (
      selectedMessagePair.firstMessage.message.id === message.message.id
    ) {
      setSelectedMessagePair(undefined);
    } else if (
      selectedMessagePair.secondMessage?.message.id === message.message.id
    ) {
      setSelectedMessagePair({
        firstMessage: selectedMessagePair.firstMessage,
      });
    } else if (selectedMessagePair.secondMessage === undefined) {
      setSelectedMessagePair({
        firstMessage: selectedMessagePair.firstMessage,
        secondMessage: message,
      });
    } else {
      setSelectedMessagePair({ firstMessage: message });
    }
  };

  const isMessageChecked = (messageWithIpAddress: GQLMessageWithIpAddress) => {
    const message = messageWithIpAddress.message;
    const timestamp = getFieldValueForRole(message, 'createdAt')!;
    if (selectedMessagePair === undefined) {
      return false;
    }
    if (
      selectedMessagePair.firstMessage.message.id === message.id ||
      selectedMessagePair.secondMessage?.message.id === message.id
    ) {
      return true;
    }
    if (selectedMessagePair.secondMessage === undefined) {
      return false;
    }
    const firstMessageTimestamp = getFieldValueForRole(
      selectedMessagePair.firstMessage.message,
      'createdAt',
    )!;
    const secondMessageTimestamp = getFieldValueForRole(
      selectedMessagePair.secondMessage.message,
      'createdAt',
    )!;
    return (
      (firstMessageTimestamp < timestamp &&
        timestamp < secondMessageTimestamp) ||
      (secondMessageTimestamp < timestamp && timestamp < firstMessageTimestamp)
    );
  };

  const checkedMessages = threadItemsWithIpAddress.filter(isMessageChecked);

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
            isReported={
              props.reportedUserIdentifier?.id === messageCreator?.id &&
              props.reportedUserIdentifier?.typeId === messageCreator?.typeId
            }
            isChecked={isMessageChecked(messageWithIpAddress)}
            checkMessage={checkMessage}
            disableChecks={isBeingReported}
          />
        </div>
      );
    },
  );
  return (
    <div className="mr-4">
      <div className="flex flex-col items-start w-full p-2 rounded gap-2 grow bg-coop-lightblue">
        <div
          className="flex flex-col w-full border border-gray-200 border-solid rounded max-h-[600px] gap-2 p-2 bg-white overflow-scroll"
          ref={scrollViewRef}
        >
          {messagesComponent}
        </div>
        <div className="self-end pr-2">
          {isBeingReported ? (
            <Button
              className="self-center mr-4"
              onClick={() => {
                props.setSelectedThreadsWithMessages(
                  selectedThreadsWithMessages.filter(
                    (it) =>
                      it.threadId !== threadIdentifier.id ||
                      it.threadTypeId !== threadIdentifier.typeId,
                  ),
                );
              }}
            >
              Remove Reported Messages
            </Button>
          ) : undefined}
          <Button
            className="self-center mt-5"
            disabled={
              selectedMessagePair?.secondMessage === undefined ||
              isBeingReported
            }
            onClick={() => {
              if (
                selectedMessagePair?.firstMessage &&
                selectedMessagePair?.secondMessage
              ) {
                props.setSelectedThreadsWithMessages([
                  ...selectedThreadsWithMessages.filter(
                    (it) =>
                      it.threadId !== threadIdentifier.id ||
                      it.threadTypeId !== threadIdentifier.typeId,
                  ),
                  {
                    threadId: threadIdentifier.id,
                    threadTypeId: threadIdentifier.typeId,
                    reportedContent: checkedMessages.map(
                      (messageWithIpAddress) => {
                        const message = messageWithIpAddress.message;
                        const type = (() => {
                          const stringField = message.type.baseFields.find(
                            (it) => it.type === 'STRING',
                          );
                          if (stringField) {
                            return 'text';
                          }
                          const videoField = message.type.baseFields.find(
                            (it) => it.type === 'VIDEO',
                          );
                          if (videoField) {
                            return 'video';
                          }
                          const imageField = message.type.baseFields.find(
                            (it) => it.type === 'IMAGE',
                          );
                          if (imageField) {
                            return 'img';
                          }
                          return 'unknown';
                        })();
                        return {
                          content: (() => {
                            const stringField = message.type.baseFields.find(
                              (it) => it.type === 'STRING',
                            );
                            if (stringField === undefined) {
                              // assume that in this case it's a photo or a video
                              return undefined;
                            }
                            const content = getFieldValueOrValues(
                              message.data,
                              stringField,
                            );
                            if (
                              Array.isArray(content) ||
                              content === undefined ||
                              content.type !== 'STRING'
                            ) {
                              // assume that in this case it's a photo or a video
                              return undefined;
                            }
                            return content.value;
                          })(),
                          type,
                          chatType: threadIdentifier.id.includes(
                            getFieldValueForRole(message, 'creatorId')!.id,
                          )
                            ? 'chat'
                            : 'groupchat',
                          contentId: message.id,
                          contentTypeId: message.type.id,
                          creatorId: getFieldValueForRole(message, 'creatorId')!
                            .id,
                          sentAt: getFieldValueForRole(message, 'createdAt')!,
                          targetId: getFieldValueForRole(message, 'threadId')!
                            .id,
                          ipAddress: {
                            ip: messageWithIpAddress.ipAddress.ip,
                            port: messageWithIpAddress.ipAddress.port,
                          },
                        };
                      },
                    ),
                  },
                ]);
              }
            }}
          >
            Add Reported Messages
          </Button>
        </div>
      </div>
    </div>
  );
}
