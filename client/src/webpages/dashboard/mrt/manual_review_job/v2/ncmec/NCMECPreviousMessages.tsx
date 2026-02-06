import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';
import { List } from 'antd';
import { useState } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import {
  GQLNcmecThreadInput,
  useGQLGetLatestUserSubmittedItemsWithThreadsQuery,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import { NCMECThreadComponent } from './NCMECThreadComponent';

gql`
  query getLatestUserSubmittedItemsWithThreads(
    $userId: ItemIdentifierInput!
    $reportedMessages: [ItemIdentifierInput!]!
  ) {
    ncmecThreads(userId: $userId, reportedMessages: $reportedMessages) {
      threadId
      threadTypeId
      messages {
        message {
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
        ipAddress {
          ip
          port
        }
      }
    }
  }
`;

export default function NCMECPreviousMessages(props: {
  userIdentifier: ItemIdentifier;
  isActionable?: boolean;
  setSelectedThreadsWithMessages: (
    threadsWithMessages: GQLNcmecThreadInput[],
  ) => void;
  selectedThreadsWithMessages: GQLNcmecThreadInput[];
}) {
  const { selectedThreadsWithMessages, setSelectedThreadsWithMessages } = props;
  const [selectedThread, setSelectedThread] = useState<
    | {
        id: string;
        typeId: string;
      }
    | undefined
  >(undefined);
  const { data, loading } = useGQLGetLatestUserSubmittedItemsWithThreadsQuery({
    variables: {
      userId: props.userIdentifier,
      // TODO: Add reported messages
      reportedMessages: [],
    },
    onCompleted: (data) => {
      setSelectedThread(
        data.ncmecThreads.length > 0
          ? {
              id: data.ncmecThreads[0].threadId,
              typeId: data.ncmecThreads[0].threadTypeId,
            }
          : undefined,
      );
    },
  });

  if (loading) {
    return <ComponentLoading />;
  }
  const threadsWithMessages = data?.ncmecThreads;
  if (threadsWithMessages === undefined || threadsWithMessages.length === 0) {
    return <div>No previous messages found</div>;
  }
  const selectedThreadMessages = threadsWithMessages
    .find(
      (it) =>
        it.threadId === selectedThread?.id &&
        it.threadTypeId === selectedThread?.typeId,
    )
    ?.messages.map((it) => it as GQLMessageWithIpAddress)
    .sort((a, b) => {
      const aCreatedAt = getFieldValueForRole(a.message, 'createdAt');
      const bCreatedAt = getFieldValueForRole(b.message, 'createdAt');
      return aCreatedAt && bCreatedAt
        ? aCreatedAt.localeCompare(bCreatedAt)
        : 0;
    });
  return (
    <div className="flex items-start">
      <List
        bordered
        dataSource={threadsWithMessages.map((it) => {
          return { id: it.threadId, typeId: it.threadTypeId };
        })}
        renderItem={(thread) => {
          const reportedMessagesInThread = selectedThreadsWithMessages.find(
            (it) =>
              it.threadId === thread.id && it.threadTypeId === thread.typeId,
          )?.reportedContent;
          return (
            <List.Item
              className={`cursor-pointer self-start flex ${
                selectedThread &&
                selectedThread.id === thread.id &&
                selectedThread.typeId === thread.typeId
                  ? 'bg-gray-200'
                  : ''
              }`}
              onClick={() => {
                setSelectedThread(thread);
              }}
              key={thread.id}
            >
              {thread.id}
              {reportedMessagesInThread ? (
                <span className="ml-2 text-xs text-gray-500">
                  {reportedMessagesInThread.length} reported
                </span>
              ) : undefined}
            </List.Item>
          );
        }}
      />
      {selectedThread === undefined ? undefined : selectedThreadMessages ===
          undefined || selectedThreadMessages.length === 0 ? (
        <div>No messages found</div>
      ) : (
        <NCMECThreadComponent
          key={`${selectedThread.id}-${selectedThread.typeId}`}
          threadIdentifier={selectedThread}
          threadItemsWithIpAddress={selectedThreadMessages}
          unblurAllMedia={false}
          reportedUserIdentifier={props.userIdentifier}
          isActionable={props.isActionable ?? false}
          setSelectedThreadsWithMessages={setSelectedThreadsWithMessages}
          selectedThreadsWithMessages={selectedThreadsWithMessages}
        />
      )}
    </div>
  );
}
