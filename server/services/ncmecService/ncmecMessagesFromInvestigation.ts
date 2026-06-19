import { type ItemIdentifier } from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import { asyncIterableToArray } from '../../utils/collections.js';
import { getFieldValueForRole } from '../itemProcessingService/extractItemDataValues.js';
import { type ItemSubmission } from '../itemProcessingService/makeItemSubmission.js';

const PLACEHOLDER_IP_ADDRESS = { ip: '0.0.0.0', port: 0 } as const;

export type NcmecThreadWithMessagesAndIp = {
  threadId: string;
  threadTypeId: string;
  messages: {
    message: ItemSubmission;
    ipAddress: { ip: string; port: number };
  }[];
};

type ThreadBucket = {
  threadId: string;
  threadTypeId: string;
  messages: NcmecThreadWithMessagesAndIp['messages'];
};

function threadMapKey(threadId: string, threadTypeId: string): string {
  return `${threadId}\u0000${threadTypeId}`;
}

function resolveThreadForContentSubmission(
  submission: ItemSubmission,
):
  | { threadId: string; threadTypeId: string; fromThreadRole: boolean }
  | undefined {
  if (submission.itemType.kind !== 'CONTENT') {
    return undefined;
  }

  const threadRef = getFieldValueForRole(
    submission.itemType.schema,
    submission.itemType.schemaFieldRoles,
    'threadId',
    submission.data,
  );

  if (
    threadRef != null &&
    typeof threadRef === 'object' &&
    'id' in threadRef &&
    'typeId' in threadRef &&
    typeof threadRef.id === 'string' &&
    typeof threadRef.typeId === 'string'
  ) {
    return {
      threadId: threadRef.id,
      threadTypeId: threadRef.typeId,
      fromThreadRole: true,
    };
  }

  // Posts/DMs without a thread role still need a conversation bucket for review.
  return {
    threadId: submission.itemId,
    threadTypeId: submission.itemType.id,
    fromThreadRole: false,
  };
}

function messageSortKey(submission: ItemSubmission): string {
  if (submission.itemType.kind !== 'CONTENT') {
    return '';
  }
  const createdAt = getFieldValueForRole(
    submission.itemType.schema,
    submission.itemType.schemaFieldRoles,
    'createdAt',
    submission.data,
  );
  return typeof createdAt === 'string' ? createdAt : '';
}

/**
 * Builds NCMEC review threads from Coop's item investigation stores. Used when
 * the org's preservation/pre-preserve service is unavailable or returns no
 * conversations (typical in local dev).
 */
export async function getNcmecMessagesFromItemInvestigation(
  itemInvestigationService: Dependencies['ItemInvestigationService'],
  opts: {
    orgId: string;
    userId: ItemIdentifier;
    reportedMessages: readonly ItemIdentifier[];
  },
): Promise<NcmecThreadWithMessagesAndIp[]> {
  const buckets = new Map<string, ThreadBucket>();
  const seenMessageKeys = new Set<string>();
  // Threads referenced by gathered messages, so we can pull the full
  // conversation (all participants) rather than just the suspect's side.
  const threadsToExpand = new Map<string, ItemIdentifier>();

  const addSubmission = (submission: ItemSubmission) => {
    const thread = resolveThreadForContentSubmission(submission);
    if (thread === undefined) {
      return;
    }
    if (thread.fromThreadRole) {
      threadsToExpand.set(threadMapKey(thread.threadId, thread.threadTypeId), {
        id: thread.threadId,
        typeId: thread.threadTypeId,
      });
    }
    const messageKey = `${submission.itemId}\u0000${submission.itemType.id}`;
    if (seenMessageKeys.has(messageKey)) {
      return;
    }
    seenMessageKeys.add(messageKey);

    const key = threadMapKey(thread.threadId, thread.threadTypeId);
    const existing = buckets.get(key);
    const entry = {
      message: submission,
      ipAddress: PLACEHOLDER_IP_ADDRESS,
    };
    if (existing === undefined) {
      buckets.set(key, {
        threadId: thread.threadId,
        threadTypeId: thread.threadTypeId,
        messages: [entry],
      });
    } else {
      existing.messages.push(entry);
    }
  };

  for (const reported of opts.reportedMessages) {
    try {
      const investigated = await itemInvestigationService.getItemByIdentifier({
        orgId: opts.orgId,
        itemIdentifier: reported,
        latestSubmissionOnly: true,
      });
      if (investigated?.latestSubmission) {
        addSubmission(investigated.latestSubmission);
      }
    } catch {
      // Item may not be in investigation stores yet.
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const byCreator = await asyncIterableToArray(
      itemInvestigationService.getItemSubmissionsByCreator({
        orgId: opts.orgId,
        itemCreatorIdentifier: opts.userId,
        latestSubmissionsOnly: true,
        oldestReturnedSubmissionDate: thirtyDaysAgo,
        limit: 200,
      }),
    );
    for (const { latestSubmission } of byCreator) {
      addSubmission(latestSubmission);
    }
  } catch {
    // Scylla/ClickHouse may be unavailable in some dev setups.
  }

  // Expand each referenced thread into its full set of messages so the review
  // groups every message in a conversation together, not just the ones authored
  // by (or reported against) the user under review.
  for (const threadIdentifier of [...threadsToExpand.values()]) {
    try {
      const threadSubmissions = await asyncIterableToArray(
        itemInvestigationService.getThreadSubmissionsByTime({
          orgId: opts.orgId,
          threadId: threadIdentifier,
          latestSubmissionsOnly: true,
          limit: 50,
          numParentLevels: 0,
          oldestReturnedSubmissionDate: thirtyDaysAgo,
        }),
      );
      for (const { latestSubmission } of threadSubmissions) {
        addSubmission(latestSubmission);
      }
    } catch {
      // Thread store may be unavailable in some dev setups.
    }
  }

  return [...buckets.values()].map((bucket) => ({
    threadId: bucket.threadId,
    threadTypeId: bucket.threadTypeId,
    messages: bucket.messages
      .sort((a, b) =>
        messageSortKey(a.message).localeCompare(messageSortKey(b.message)),
      )
      .slice(-50),
  }));
}
