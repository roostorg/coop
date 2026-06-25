import { Badge } from '@/coop-ui/Badge';
import {
  FileTextOutlined,
  MessageOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/coop-types';
import { useState } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import {
  GQLNcmecThreadInput,
  useGQLGetLatestUserSubmittedItemsWithThreadsQuery,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import { NCMECThreadComponent } from './NCMECThreadComponent';
import { buildSelectedThreadsForReportedMessages } from './ncmecThreadReportUtils';

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
  /** Identifiers of the content item(s) that triggered the report. Seeds the
   * threads lookup so the API can surface the relevant conversations and the
   * "X reported" badges. Empty for account-level reports. */
  reportedMessages?: readonly ItemIdentifier[];
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
  const { data, loading, error } =
    useGQLGetLatestUserSubmittedItemsWithThreadsQuery({
      variables: {
        userId: props.userIdentifier,
        reportedMessages: (props.reportedMessages ?? []).map((m) => ({
          id: m.id,
          typeId: m.typeId,
        })),
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
        if (
          (props.isActionable ?? false) &&
          props.selectedThreadsWithMessages.length === 0 &&
          (props.reportedMessages?.length ?? 0) > 0
        ) {
          const preselected = buildSelectedThreadsForReportedMessages(
            data.ncmecThreads.map((t) => ({
              threadId: t.threadId,
              threadTypeId: t.threadTypeId,
              messages: t.messages as GQLMessageWithIpAddress[],
            })),
            props.reportedMessages ?? [],
          );
          if (preselected.length > 0) {
            setSelectedThreadsWithMessages(preselected);
          }
        }
      },
    });

  if (loading) {
    return <ComponentLoading />;
  }
  if (error) {
    return (
      <div className="text-sm text-coop-alert-red">
        Failed to load conversations. Check server logs and NCMEC preservation
        settings.
      </div>
    );
  }
  const threadsWithMessages = data?.ncmecThreads;
  if (threadsWithMessages === undefined || threadsWithMessages.length === 0) {
    return (
      <div className="text-sm text-slate-600">
        No previous messages found for this user in the last 30 days. If this
        account should have text content, confirm items were submitted to Coop
        and that preservation or item investigation data is available.
      </div>
    );
  }
  const reportedIdSet = new Set(
    (props.reportedMessages ?? []).map((m) => `${m.id}\u0000${m.typeId}`),
  );
  const threadHasReportedMessage = (threadId: string, threadTypeId: string) =>
    threadsWithMessages
      .find((t) => t.threadId === threadId && t.threadTypeId === threadTypeId)
      ?.messages.some((m) =>
        m.message.__typename === 'ContentItem'
          ? reportedIdSet.has(`${m.message.id}\u0000${m.message.type.id}`)
          : false,
      ) ?? false;
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
    <div className="flex w-full overflow-hidden border rounded-lg border-slate-200">
      <div className="flex flex-col overflow-y-auto border-r w-80 shrink-0 border-slate-200 bg-slate-50 max-h-[660px]">
        {threadsWithMessages.map((thread) => {
          const isSelected =
            selectedThread?.id === thread.threadId &&
            selectedThread?.typeId === thread.threadTypeId;
          const reportedMessagesInThread = selectedThreadsWithMessages.find(
            (it) =>
              it.threadId === thread.threadId &&
              it.threadTypeId === thread.threadTypeId,
          )?.reportedContent;
          const messageCount = thread.messages.length;
          // An entry is a real thread when its messages belong to a thread (the
          // content carries a `threadId` role). Standalone posts/DMs have no
          // thread role, so the server buckets them under their own id.
          const isPost = !thread.messages.some((m) =>
            m.message.__typename === 'ContentItem'
              ? getFieldValueForRole(m.message, 'threadId') != null
              : false,
          );
          const triggered = threadHasReportedMessage(
            thread.threadId,
            thread.threadTypeId,
          );
          return (
            <button
              type="button"
              key={`${thread.threadId}-${thread.threadTypeId}`}
              onClick={() =>
                setSelectedThread({
                  id: thread.threadId,
                  typeId: thread.threadTypeId,
                })
              }
              className={`flex flex-col items-start w-full gap-1 px-3 py-3 text-left border-b border-l-2 transition-colors border-slate-200 ${
                isSelected
                  ? 'border-l-indigo-500 bg-indigo-50'
                  : 'border-l-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 text-slate-500">
                {isPost ? <FileTextOutlined /> : <MessageOutlined />}
                <span className="text-xs font-medium">
                  {isPost ? 'Post' : 'Thread'}
                </span>
              </div>
              <span className="max-w-full text-sm truncate text-slate-800">
                {thread.threadId}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {triggered ? (
                  <Badge
                    size="sm"
                    className="border-transparent gap-1 bg-amber-500 text-white"
                  >
                    <WarningFilled />
                    Triggered report
                  </Badge>
                ) : null}
                {!isPost ? (
                  <span className="text-xs text-slate-500">
                    {messageCount} msgs
                  </span>
                ) : null}
                {reportedMessagesInThread ? (
                  <span className="text-xs text-slate-500">
                    {reportedMessagesInThread.length} reported
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-w-0">
        {selectedThread === undefined ? null : selectedThreadMessages ===
            undefined || selectedThreadMessages.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No messages found</div>
        ) : (
          <NCMECThreadComponent
            key={`${selectedThread.id}-${selectedThread.typeId}`}
            threadIdentifier={selectedThread}
            threadItemsWithIpAddress={selectedThreadMessages}
            unblurAllMedia={false}
            reportedUserIdentifier={props.userIdentifier}
            reportedMessageIds={props.reportedMessages}
            isActionable={props.isActionable ?? false}
            setSelectedThreadsWithMessages={setSelectedThreadsWithMessages}
            selectedThreadsWithMessages={selectedThreadsWithMessages}
          />
        )}
      </div>
    </div>
  );
}
