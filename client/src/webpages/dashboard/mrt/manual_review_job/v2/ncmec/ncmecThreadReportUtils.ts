import { ItemIdentifier } from '@roostorg/coop-types';

import {
  GQLNcmecThreadInput,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
} from '../../../../../../utils/itemUtils';

/** NCMEC submit requires `sentAt: DateTime!`. Many orgs use custom timestamp
 * field names; fall back so text-only reports still submit. */
function resolveMessageSentAt(
  message: GQLMessageWithIpAddress['message'],
): string {
  const fromRole = getFieldValueForRole(message, 'createdAt');
  if (typeof fromRole === 'string' && fromRole.length > 0) {
    return fromRole;
  }

  for (const fieldName of [
    'datetime',
    'created_at',
    'posted_at',
    'timestamp',
    'sent_at',
  ]) {
    const field = message.type.baseFields.find((it) => it.name === fieldName);
    if (field === undefined) {
      continue;
    }
    const value = getFieldValueOrValues(message.data, field);
    if (
      value !== undefined &&
      !Array.isArray(value) &&
      value.type === 'DATETIME' &&
      typeof value.value === 'string' &&
      value.value.length > 0
    ) {
      return value.value;
    }
    if (
      value !== undefined &&
      !Array.isArray(value) &&
      value.type === 'STRING' &&
      typeof value.value === 'string' &&
      value.value.length > 0 &&
      !Number.isNaN(Date.parse(value.value))
    ) {
      return new Date(value.value).toISOString();
    }
  }

  return new Date().toISOString();
}

function resolveMessageCreatorId(
  message: GQLMessageWithIpAddress['message'],
): string {
  const fromRole = getFieldValueForRole(message, 'creatorId');
  if (fromRole?.id) {
    return fromRole.id;
  }

  const ownerField = message.type.baseFields.find(
    (it) => it.name === 'owner_id',
  );
  if (ownerField !== undefined) {
    const owner = getFieldValueOrValues(message.data, ownerField);
    if (
      owner !== undefined &&
      !Array.isArray(owner) &&
      owner.type === 'RELATED_ITEM' &&
      typeof owner.value === 'object' &&
      owner.value !== null &&
      'id' in owner.value &&
      typeof owner.value.id === 'string'
    ) {
      return owner.value.id;
    }
  }

  throw new Error(
    `Cannot resolve creator for content item ${message.id}: map a creatorId field role or include owner_id in data.`,
  );
}

export function messageToNcmecReportedContent(
  messageWithIpAddress: GQLMessageWithIpAddress,
  threadIdentifier: ItemIdentifier,
): GQLNcmecThreadInput['reportedContent'][number] {
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

  const creator = getFieldValueForRole(message, 'creatorId');
  const creatorId = resolveMessageCreatorId(message);
  const threadIdField = getFieldValueForRole(message, 'threadId');

  return {
    content: (() => {
      const stringField = message.type.baseFields.find(
        (it) => it.type === 'STRING',
      );
      if (stringField === undefined) {
        return undefined;
      }
      const content = getFieldValueOrValues(message.data, stringField);
      if (
        Array.isArray(content) ||
        content === undefined ||
        content.type !== 'STRING'
      ) {
        return undefined;
      }
      return content.value;
    })(),
    type,
    chatType: threadIdentifier.id.includes(creator?.id ?? creatorId)
      ? 'chat'
      : 'groupchat',
    contentId: message.id,
    contentTypeId: message.type.id,
    creatorId,
    sentAt: resolveMessageSentAt(message),
    targetId: threadIdField?.id ?? threadIdentifier.id,
    ipAddress: {
      ip: messageWithIpAddress.ipAddress.ip,
      port: messageWithIpAddress.ipAddress.port,
    },
  };
}

export function buildSelectedThreadsForReportedMessages(
  threads: ReadonlyArray<{
    threadId: string;
    threadTypeId: string;
    messages: ReadonlyArray<GQLMessageWithIpAddress>;
  }>,
  reportedMessages: readonly ItemIdentifier[],
): GQLNcmecThreadInput[] {
  if (reportedMessages.length === 0) {
    return [];
  }
  const reportedKeys = new Set(
    reportedMessages.map((m) => `${m.id}\u0000${m.typeId}`),
  );

  return threads.flatMap((thread) => {
    const matching = thread.messages.filter((m) =>
      reportedKeys.has(`${m.message.id}\u0000${m.message.type.id}`),
    );
    if (matching.length === 0) {
      return [];
    }
    return [
      {
        threadId: thread.threadId,
        threadTypeId: thread.threadTypeId,
        reportedContent: matching.map((m) =>
          messageToNcmecReportedContent(m, {
            id: thread.threadId,
            typeId: thread.threadTypeId,
          }),
        ),
      },
    ];
  });
}
