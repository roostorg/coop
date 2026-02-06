import { ReadableStream } from 'node:stream/web';
import type { ItemIdentifier } from '@roostorg/types';
import { type Dependencies } from '../../iocContainer/index.js';
import { type Scylla } from '../../scylla/index.js';
import type { ContentApiRequestLogEntry } from '../analyticsLoggers/ContentApiLogger.js';
import { type RuleExecutionCorrelationId } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { type CorrelationId } from '../../utils/correlationIds.js';
import { mapAsyncIterable } from '../../utils/iterables.js';
import { __throw } from '../../utils/misc.js';
import {
  type PublicMethodNames,
  type ReplaceDeep,
} from '../../utils/typescript-types.js';
import {
  itemSubmissionWithTypeIdentifierToItemSubmission,
  type ItemSubmissionWithTypeIdentifier,
} from '../itemProcessingService/index.js';
import { type ItemSubmission } from '../itemProcessingService/makeItemSubmission.js';
import { type ReportingRuleExecutionCorrelationId } from '../reportingService/index.js';
import { type ScyllaRelations } from './dbTypes.js';
import {
  ItemInvestigationService,
  type SubmissionsForItemWithTypeIdentifier,
} from './itemInvestigationService.js';
import {
  type IActionExecutionsAdapter,
} from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import {
  type IContentApiRequestsAdapter,
} from '../../plugins/warehouse/queries/IContentApiRequestsAdapter.js';

type AdaptedReturnType<T extends PublicMethodNames<ItemInvestigationService>> =
  ReplaceDeep<
    ReturnType<ItemInvestigationService[T]>,
    ItemSubmissionWithTypeIdentifier,
    ItemSubmission,
    true
  >;

/**
 * This is the shape that we return from the adapter to represent the
 * submissions we have for a given item.
 */
type SubmissionsForItem = {
  latestSubmission: ItemSubmission;
  priorSubmissions?: ItemSubmission[];
};

export const RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB = Symbol();
export type ReturnUnlimitedResultsAndPotentiallyHangDb =
  typeof RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB;

export class ItemInvestigationServiceAdapter {
  private readonly service: ItemInvestigationService;

  constructor(
    scylla: Scylla<ScyllaRelations>,
    tracer: Dependencies['Tracer'],
    partialItemsService: Dependencies['PartialItemsService'],
    actionExecutionsAdapter: IActionExecutionsAdapter,
    contentApiRequestsAdapter: IContentApiRequestsAdapter,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    meter: Dependencies['Meter'],
  ) {
    this.service = new ItemInvestigationService(
      scylla,
      tracer,
      partialItemsService,
      actionExecutionsAdapter,
      contentApiRequestsAdapter,
      meter,
    );
  }

  /**
   * insertItem is idempotent given identical input data,
   * meaning if all fields on a given itemSubmission along
   * with the related requestId and orgId are the same then
   * only one copy will be present in the underlying dataStore.
   *
   * In the case that the same Item is submitted to Coop
   * twice, the item will have multiple Item Submissions
   * inserted to the ItemInvestigationService, representing the
   * submission history for the given item.
   */
  async insertItem(
    data: Omit<
      ContentApiRequestLogEntry<false>,
      'failureReason' | 'requestId'
    > & {
      itemSubmission: { submissionTime: Date };
      requestId: CorrelationId<
        | RuleExecutionCorrelationId
        | ReportingRuleExecutionCorrelationId
        | CorrelationId<'submit-appeal'>
      >;
    },
  ): Promise<void> {
    await this.service.insertItem(data);
  }

  getThreadSubmissionsByPosition(opts: {
    orgId: string;
    threadId: ItemIdentifier;
    parentId: ItemIdentifier | null;
    siblingsSplitAtDate: Date;
    numPriorSiblings?: number;
    numSubsequentSiblings?: number;
    numParentLevels?: number;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AdaptedReturnType<'getThreadSubmissionsByPosition'> {
    const raw = this.service.getThreadSubmissionsByPosition(opts);

    return {
      parents: this.#adaptInternalStreamToItemSubmissionsForItem(
        opts.orgId,
        raw.parents,
      ),
      priorSiblings: this.#adaptInternalStreamToItemSubmissionsForItem(
        opts.orgId,
        raw.priorSiblings,
      ),
      subsequentSiblings: this.#adaptInternalStreamToItemSubmissionsForItem(
        opts.orgId,
        raw.subsequentSiblings,
      ),
    };
  }

  getAncestorItems(opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    numParentLevels: number;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AdaptedReturnType<'getAncestorItems'> {
    const rawParents = this.service.getAncestorItems(opts);
    return this.#adaptInternalStreamToItemSubmissionsForItem(
      opts.orgId,
      rawParents,
    );
  }

  getItemSubmissionsByCreator(opts: {
    orgId: string;
    itemCreatorIdentifier: ItemIdentifier;
    limit?: number | ReturnUnlimitedResultsAndPotentiallyHangDb;
    oldestReturnedSubmissionDate?: Date;
    earliestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AdaptedReturnType<'getItemSubmissionsByCreator'> {
    const raw = this.service.getItemSubmissionsByCreator(opts);
    return this.#adaptInternalStreamToItemSubmissionsForItem(opts.orgId, raw);
  }

  getThreadSubmissionsByTime(opts: {
    orgId: string;
    threadId: ItemIdentifier;
    limit?: number;
    numParentLevels?: number;
    newestReturnedSubmissionDate?: Date;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AdaptedReturnType<'getThreadSubmissionsByTime'> {
    return mapAsyncIterable(
      this.service.getThreadSubmissionsByTime(opts),
      async ({ parents, latestSubmission, priorSubmissions }) => {
        return {
          ...(await this.#convertToSubmissionsForItem(opts.orgId, {
            latestSubmission,
            priorSubmissions,
          })),
          parents: this.#adaptInternalStreamToItemSubmissionsForItem(
            opts.orgId,
            parents,
          ),
        };
      },
    );
  }

  async getItemByIdentifier(opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    latestSubmissionOnly?: boolean;
    signal?: AbortSignal;
  }): Promise<SubmissionsForItem | null> {
    const rawItem = await this.service.getItemByIdentifier(opts);
    return rawItem
      ? this.#convertToSubmissionsForItem(opts.orgId, rawItem)
      : null;
  }

  getItemByTypeAgnosticIdentifier(opts: {
    orgId: string;
    itemId: string;
    latestSubmissionOnly?: boolean;
  }): AsyncIterableIterator<SubmissionsForItem> {
    const { orgId, itemId, latestSubmissionOnly = true } = opts;
    const controller = new AbortController();
    const { signal } = controller;

    const stream = new ReadableStream<SubmissionsForItem>({
      start: (controller) => {
        this.moderationConfigService
          .getItemTypes({ orgId })
          .then(async (itemTypes) => {
            return Promise.all(
              itemTypes.map(async (it) => {
                const rawSubmissionsForItem =
                  await this.service.getItemByIdentifier({
                    orgId,
                    itemIdentifier: { id: itemId, typeId: it.id },
                    latestSubmissionOnly,
                    signal,
                  });

                if (rawSubmissionsForItem) {
                  controller.enqueue(
                    await this.#convertToSubmissionsForItem(
                      orgId,
                      rawSubmissionsForItem,
                    ),
                  );
                }
              }),
            );
          })
          .then(() => {
            controller.close();
          })
          .catch((error: unknown) => {
            // The promise that we're catching here can reject because either:
            //
            // 1. there was an error getting the values that should go into the
            //    stream (e.g., `getItemTypesForOrgEventuallyConsistent` or
            //    `getItemByIdentifier` threw b/c the db was unreachable); or
            //
            // 2. The stream was canceled because the consumer was no longer
            //    interested in it; that cancelation lead us to abort the signal
            //    (so that `getItemByIdentifier` would stop doing pointless
            //    work), which lead `getItemByIdentifier` to reject with an
            //    "AbortError". NB: Because we "own" this signal -- i.e., it's
            //    created inside `getItemByTypeAgnosticIdentifier` and never
            //    escapes -- and we only abort it on stream cancelation, the
            //    signal can only be aborted if the stream was canceled.
            //
            // If we're in the first case, we need to call `controller.error()`,
            // to expose the error when the stream is read from in future. But,
            // if we're in the second case (which will be the case iff the
            // signal is aborted, per comment above), the stream's already
            // canceled so we don't have to do anything.
            if (!signal.aborted) {
              controller.error(error);
            }
          });
      },
      cancel() {
        controller.abort();
      },
    });

    // This uses the ReadableStream's built-in logic to convert it to an async
    // (iterable) iterator. Under this logic, calling `return()` on the iterator
    // -- which is the standard way for an iterator's consumer to indicate that
    // it no longer cares about future yielded items, and which JS does
    // automatically in various appropriate/common cases (e.g., when a `break`
    // or `throw` happens inside a `for await ... of` loop) -- will cancel the
    // stream, which will abort the signal and save all the unnecessary work in
    // `getItemByIdentifier`.
    return stream[Symbol.asyncIterator]();
  }

  async getItemActionHistory(opts: {
    orgId: string;
    itemId: string;
    itemTypeId: string;
    itemSubmissionTime: Date | undefined;
  }) {
    return this.service.getItemActionHistory(opts);
  }

  #adaptInternalStreamToItemSubmissionsForItem(
    orgId: string,
    submissionsForItemWithTypeIdentifierStream: AsyncIterable<SubmissionsForItemWithTypeIdentifier>,
  ): AsyncIterable<SubmissionsForItem> {
    return mapAsyncIterable(
      submissionsForItemWithTypeIdentifierStream,
      this.#convertToSubmissionsForItem.bind(this, orgId),
    );
  }

  async #convertToSubmissionsForItem(
    orgId: string,
    it: SubmissionsForItemWithTypeIdentifier,
  ): Promise<SubmissionsForItem> {
    const convertToItemSubmission =
      this.#getTypeAndConvertToFullSubmission.bind(this, orgId);

    return {
      latestSubmission: await convertToItemSubmission(it.latestSubmission),
      priorSubmissions: it.priorSubmissions
        ? await Promise.all(it.priorSubmissions.map(convertToItemSubmission))
        : undefined,
    };
  }

  async #getTypeAndConvertToFullSubmission(
    orgId: string,
    it: ItemSubmissionWithTypeIdentifier,
  ): Promise<ItemSubmission> {
    const type = await this.moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: it.itemTypeIdentifier,
    });
    if (!type) {
      throw new Error(
        `No item type for org ${orgId} with ID ${it.itemTypeIdentifier.id}`,
      );
    }

    return itemSubmissionWithTypeIdentifierToItemSubmission(it, type);
  }
}
