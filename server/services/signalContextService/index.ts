import {
  type ItemIdentifier,
  type SignalContextItem,
  type SignalContextNeeds,
  type SignalEvaluationContext,
} from '@roostorg/coop-types';

import { type RuleInput } from '../../rule_engine/RuleEvaluator.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type ItemInvestigationService } from '../itemInvestigationService/index.js';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
  type ItemSubmission,
} from '../itemProcessingService/index.js';
import { DEFAULT_MAX_THREAD_MESSAGES, MAX_THREAD_MESSAGES } from './limits.js';

export type SignalContextLoader = {
  load: (needs: SignalContextNeeds) => Promise<SignalEvaluationContext>;
};

export type SignalContextLoaderFactory = (opts: {
  orgId: string;
  ruleInput: RuleInput;
}) => SignalContextLoader;

const SECTION_TIMEOUT_MS = 3000;
const THREAD_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 90;

export function makeSignalContextLoaderFactory(
  itemInvestigationService: Pick<
    ItemInvestigationService,
    'getItemByIdentifier' | 'getThreadSubmissionsByTime'
  >,
  options: { sectionTimeoutMs?: number } = {},
): SignalContextLoaderFactory {
  const sectionTimeoutMs = options.sectionTimeoutMs ?? SECTION_TIMEOUT_MS;
  return ({ orgId, ruleInput }) => {
    const itemLoad = isFullRuleInput(ruleInput)
      ? Promise.resolve(ruleInput)
      : undefined;
    const itemByIdentifier = new Map<string, Promise<ItemSubmission | null>>();
    const threadByCount = new Map<
      number,
      Promise<NonNullable<SignalEvaluationContext['thread']> | null>
    >();

    const loadItemByIdentifier = async (identifier: ItemIdentifier) => {
      const key = `${identifier.typeId}:${identifier.id}`;
      const existing = itemByIdentifier.get(key);
      if (existing) return existing;
      const promise = itemInvestigationService
        .getItemByIdentifier({
          orgId,
          itemIdentifier: identifier,
          latestSubmissionOnly: true,
        })
        .then((result) => result?.latestSubmission ?? null);
      itemByIdentifier.set(key, promise);
      return promise;
    };

    const load = async (
      needs: SignalContextNeeds,
    ): Promise<SignalEvaluationContext> => {
      const normalized = normalizeNeeds(needs);
      const unavailable: Array<'item' | 'parent' | 'thread'> = [];
      const context: {
        item?: SignalContextItem;
        parent?: SignalContextItem;
        thread?: SignalEvaluationContext['thread'];
        unavailable?: typeof unavailable;
      } = {};

      if (!isFullRuleInput(ruleInput)) {
        if (normalized.includeFullItem) {
          const loaded = await withTimeout(
            async () =>
              loadItemByIdentifier({
                id: ruleInput.itemId,
                typeId: ruleInput.itemType.id,
              }),
            sectionTimeoutMs,
          );
          if (loaded) context.item = toContextItem(loaded);
          else unavailable.push('item');
        } else {
          context.item = {
            itemId: ruleInput.itemId,
            itemTypeId: ruleInput.itemType.id,
            itemTypeName: ruleInput.itemType.name,
            itemTypeKind: ruleInput.itemType.kind,
            data: {},
          };
        }
        context.unavailable = unavailable.length ? unavailable : undefined;
        return context;
      }

      const submission = await itemLoad!;
      context.item = toContextItem(submission);

      const sectionLoads: Promise<void>[] = [];
      // Sections the item has no reference for are omitted; `unavailable` is
      // only for referenced items that failed to load.
      if (
        normalized.includeParent &&
        submission.itemType.kind === 'CONTENT' &&
        isItemReference(getRoleReference(submission, 'parentId'))
      ) {
        sectionLoads.push(
          withTimeout(
            async () => loadParent(submission, loadItemByIdentifier),
            sectionTimeoutMs,
          ).then(
            (parent) => {
              if (parent) context.parent = toContextItem(parent);
              else unavailable.push('parent');
            },
            () => {
              unavailable.push('parent');
            },
          ),
        );
      }
      if (
        normalized.includeThread &&
        (submission.itemType.kind === 'THREAD' ||
          (submission.itemType.kind === 'CONTENT' &&
            isItemReference(getRoleReference(submission, 'threadId'))))
      ) {
        const count = normalized.maxThreadMessages;
        let threadLoad = threadByCount.get(count);
        if (!threadLoad) {
          threadLoad = withTimeout(
            async (abortSignal) =>
              loadThread(
                submission,
                orgId,
                itemInvestigationService,
                count,
                abortSignal,
              ),
            sectionTimeoutMs,
          );
          threadByCount.set(count, threadLoad);
        }
        sectionLoads.push(
          threadLoad.then(
            (thread) => {
              if (thread) context.thread = thread;
              else unavailable.push('thread');
            },
            () => {
              unavailable.push('thread');
            },
          ),
        );
      }
      await Promise.all(sectionLoads);
      context.unavailable = unavailable.length ? unavailable : undefined;
      return context;
    };

    const memoized = new Map<string, Promise<SignalEvaluationContext>>();
    return {
      async load(needs) {
        const key = jsonStringify(normalizeNeeds(needs));
        const existing = memoized.get(key);
        if (existing) return existing;
        const promise = load(needs).catch(() => ({
          unavailable: ['item'] as const,
        }));
        memoized.set(key, promise);
        return promise;
      },
    };
  };
}

function normalizeNeeds(needs: SignalContextNeeds) {
  return {
    includeFullItem: needs.includeFullItem === true,
    includeParent: needs.includeParent === true,
    includeThread: needs.includeThread === true,
    maxThreadMessages: clamp(
      needs.maxThreadMessages ?? DEFAULT_MAX_THREAD_MESSAGES,
      MAX_THREAD_MESSAGES,
    ),
  };
}

function clamp(value: number, max: number) {
  return Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), max)
    : 0;
}

async function withTimeout<T>(
  start: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs: number = SECTION_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      start(controller.signal),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('signal context section timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function loadParent(
  submission: ItemSubmission,
  loadItem: (identifier: ItemIdentifier) => Promise<ItemSubmission | null>,
) {
  const identifier = getRoleReference(submission, 'parentId');
  return identifier && typeof identifier === 'object'
    ? loadItem(identifier as ItemIdentifier)
    : null;
}

async function loadThread(
  submission: ItemSubmission,
  orgId: string,
  service: Pick<ItemInvestigationService, 'getThreadSubmissionsByTime'>,
  maxMessages: number,
  abortSignal: AbortSignal,
) {
  let threadId: ItemIdentifier | undefined;
  if (submission.itemType.kind === 'THREAD') {
    threadId = { id: submission.itemId, typeId: submission.itemType.id };
  } else if (submission.itemType.kind === 'CONTENT') {
    const value = getRoleReference(submission, 'threadId');
    if (value && typeof value === 'object') threadId = value as ItemIdentifier;
  }
  if (!threadId) return null;

  // Rules can run long after the item was posted (reports, appeals, routing),
  // so the thread ends at the item rather than at the time of evaluation.
  const itemTime = getItemTime(submission);
  const messages: SignalContextItem[] = [];
  for await (const result of service.getThreadSubmissionsByTime({
    orgId,
    threadId,
    // One for the item itself, one to detect truncation.
    limit: maxMessages + 2,
    numParentLevels: 0,
    latestSubmissionsOnly: true,
    ...(itemTime
      ? {
          newestReturnedSubmissionDate: itemTime,
          oldestReturnedSubmissionDate: new Date(
            itemTime.getTime() - THREAD_LOOKBACK_MS,
          ),
        }
      : {}),
  })) {
    if (abortSignal.aborted) break;
    const item = result.latestSubmission;
    if (
      (item.itemId === submission.itemId &&
        item.itemType.id === submission.itemType.id) ||
      item.itemType.kind === 'USER'
    ) {
      continue;
    }
    messages.push(toContextItem(item));
    if (messages.length > maxMessages) break;
  }
  const truncated = messages.length > maxMessages;
  // Storage returns newest first; the contract is oldest first.
  const kept = messages.slice(0, maxMessages).reverse();
  return {
    id: threadId.id,
    typeId: threadId.typeId,
    messages: kept,
    truncated,
  };
}

function getItemTime(submission: ItemSubmission): Date | undefined {
  const createdAt = getCreatedAt(submission);
  const parsed = createdAt != null ? new Date(String(createdAt)) : undefined;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return submission.submissionTime;
}

function getCreatedAt(submission: ItemSubmission): unknown {
  return submission.itemType.schemaFieldRoles.createdAt
    ? getFieldValueForRole(
        submission.itemType.schema,
        submission.itemType.schemaFieldRoles,
        'createdAt',
        submission.data,
      )
    : undefined;
}

function isItemReference(value: unknown): value is ItemIdentifier {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { typeId?: unknown }).typeId === 'string'
  );
}

function getRoleReference(
  submission: ItemSubmission,
  role: 'parentId' | 'threadId',
) {
  const fieldName = (
    submission.itemType.schemaFieldRoles as Record<string, string | undefined>
  )[role];
  if (!fieldName) return undefined;
  const field = submission.itemType.schema.find(
    (candidate) => candidate.name === fieldName,
  );
  const value = field
    ? getFieldValueOrValues(submission.data, field)
    : undefined;
  return Array.isArray(value) ? undefined : value?.value;
}

function isFullRuleInput(input: RuleInput): input is ItemSubmission {
  return 'data' in input && 'submissionId' in input && Boolean(input.data);
}

function toContextItem(submission: ItemSubmission): SignalContextItem {
  const identity = {
    itemId: submission.itemId,
    itemTypeId: submission.itemType.id,
    itemTypeName: submission.itemType.name,
    itemTypeKind: submission.itemType.kind,
  };
  // User records are never passed to plugins, only their identity.
  if (submission.itemType.kind === 'USER') return { ...identity, data: {} };
  const createdAt = getCreatedAt(submission);
  return {
    ...identity,
    data: submission.data,
    ...(createdAt != null
      ? {
          createdAt:
            createdAt instanceof Date
              ? createdAt.toISOString()
              : String(createdAt),
        }
      : {}),
    ...(submission.creator
      ? {
          creator: {
            id: submission.creator.id,
            typeId: submission.creator.typeId,
          },
        }
      : {}),
  };
}
