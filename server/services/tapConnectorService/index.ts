/**
 * Tap Connector Service — Ingests AT Protocol events from Tap and submits
 * them to Coop for moderation.
 *
 * Supports two ingestion modes controlled by TAP_INGESTION_MODE:
 *
 * - "report" (default): Items go through the reporting pipeline
 *   (ReportingService → reporting rules → ManualReviewToolService). Items
 *   land in the manual review queue for human review.
 *
 * - "items": Items go through the automatic enforcement pipeline
 *   (BullMQ → ItemProcessingWorker → rules engine). Items are processed
 *   by automated rules only.
 *
 * - "both": Items are sent through both pipelines simultaneously.
 *
 * Implements the Worker interface so it can be run alongside other Coop workers.
 */

import { v1 as uuidv1 } from 'uuid';

import { type ItemSubmissionMessageValue } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type ItemSubmissionBulkWrite } from '../../queues/itemSubmissionQueue.js';
import {
  rawItemSubmissionToItemSubmission,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  getFieldValueForRole,
  type ItemSubmission,
} from '../itemProcessingService/index.js';
import { type ModerationConfigService } from '../moderationConfigService/index.js';
import { type ReportingService } from '../reportingService/index.js';
import { type ManualReviewToolService } from '../manualReviewToolService/index.js';
import { type ItemInvestigationService } from '../itemInvestigationService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { type Worker } from '../../workers_jobs/index.js';

import { TapAdminApi, type TapStats, type TapRepoInfo } from './tapAdminApi.js';
import { TapClient } from './tapClient.js';
import { transformTapEvent } from './transformers.js';
import { type TapEvent, type TapConnectorConfig } from './types.js';

export { TapAdminApi, type TapStats, type TapRepoInfo } from './tapAdminApi.js';
export { type TapConnectorConfig } from './types.js';

type IngestionMode = 'report' | 'items' | 'both';

/** The public shape of the TapConnectorWorker as stored in the DI container. */
export type TapConnectorWorker = Worker & {
  getAdminApi(): TapAdminApi | null;
};

function getSyntheticThreadId(
  itemId: string,
  typeId: string,
  threadId?: string,
): string {
  return threadId
    ? jsonStringify([typeId, threadId])
    : jsonStringify([typeId, itemId]);
}

const makeTapConnectorWorker = inject(
  [
    'ModerationConfigService',
    'ReportingService',
    'ManualReviewToolService',
    'ItemInvestigationService',
    'Meter',
    'itemSubmissionQueueBulkWrite',
  ],
  (
    moderationConfigService: ModerationConfigService,
    reportingService: ReportingService,
    manualReviewToolService: ManualReviewToolService,
    itemInvestigationService: ItemInvestigationService,
    _Meter: unknown,
    itemSubmissionQueueBulkWrite: ItemSubmissionBulkWrite,
  ): TapConnectorWorker => {
    let tapClient: TapClient | null = null;
    let tapAdminApi: TapAdminApi | null = null;
    let batchBuffer: TapEvent[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    let shutdownRequested = false;

    const config: TapConnectorConfig = {
      tapUrl: process.env.TAP_URL ?? 'http://tap:2480',
      tapAdminPassword: process.env.TAP_ADMIN_PASSWORD ?? '',
      batchSize: parseInt(process.env.TAP_BATCH_SIZE ?? '100', 10),
      batchIntervalMs: parseInt(
        process.env.TAP_BATCH_INTERVAL_MS ?? '1000',
        10,
      ),
      orgId: process.env.TAP_ORG_ID ?? '',
      apiKey: process.env.TAP_API_KEY ?? '',
    };

    const ingestionMode: IngestionMode =
      (process.env.TAP_INGESTION_MODE as IngestionMode) ?? 'report';
    const useReportPath =
      ingestionMode === 'report' || ingestionMode === 'both';
    const useItemsPath =
      ingestionMode === 'items' || ingestionMode === 'both';

    /**
     * Submit an item through the /report pipeline:
     * ReportingService → reporting rules → MRT queue.
     */
    async function submitViaReportPath(
      itemSubmission: ItemSubmission & { submissionTime: Date },
    ): Promise<void> {
      const reportId = uuidv1();
      const requestId = toCorrelationId({
        type: 'submit-report',
        id: reportId,
      });
      const reportedAt = itemSubmission.submissionTime;

      // Insert into Scylla for context
      try {
        await itemInvestigationService.insertItem({
          orgId: config.orgId,
          requestId,
          itemSubmission,
        });
      } catch {
        // Non-fatal
      }

      // Write to data warehouse via ReportingService
      await reportingService.submitReport({
        requestId,
        orgId: config.orgId,
        reporter: { kind: 'rule', id: 'tap-connector' },
        reportedAt,
        reportedForReason: undefined,
        reportedItem: itemSubmission,
        reportedItemThread: undefined,
        reportedItemsInThread: undefined,
        additionalItemSubmissions: [],
        skipJobEnqueue: true,
      });

      // Run reporting rules
      try {
        await reportingService.runEnabledRules(itemSubmission, requestId);
      } catch {
        // Non-fatal
      }

      // Enqueue for manual review
      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);

      await manualReviewToolService.enqueue({
        createdAt: reportedAt,
        orgId: config.orgId,
        enqueueSource: 'REPORT' as const,
        enqueueSourceInfo: { kind: 'REPORT' } as const,
        policyIds: [],
        correlationId: requestId,
        payload: {
          item,
          kind: 'DEFAULT',
          reportHistory: [
            {
              reason: undefined,
              reporterId: undefined,
              reportId,
              reportedAt,
              policyId: undefined,
            },
          ],
          reportedForReasons: [
            {
              reason: undefined,
              reporterId: undefined,
            },
          ],
        },
      });
    }

    /**
     * Submit an item through the /items pipeline:
     * BullMQ queue → ItemProcessingWorker → automatic rules engine.
     */
    async function submitViaItemsPath(
      itemSubmission: ItemSubmission & { submissionTime: Date },
    ): Promise<void> {
      const requestId = toCorrelationId({
        type: 'post-items',
        id: uuidv1(),
      });

      const threadId =
        itemSubmission.itemType.kind === 'CONTENT'
          ? getFieldValueForRole(
              itemSubmission.itemType.schema,
              itemSubmission.itemType.schemaFieldRoles,
              'threadId',
              itemSubmission.data,
            )
          : undefined;

      const withTypeId =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);

      const message: ItemSubmissionMessageValue = {
        metadata: {
          requestId,
          orgId: config.orgId,
          syntheticThreadId: getSyntheticThreadId(
            itemSubmission.itemId,
            itemSubmission.itemType.id,
            threadId?.id,
          ),
        },
        itemSubmissionWithTypeIdentifier: {
          submissionId: withTypeId.submissionId,
          itemTypeIdentifier: withTypeId.itemTypeIdentifier,
          itemId: withTypeId.itemId,
          dataJSON: jsonStringify(itemSubmission.data),
          submissionTime: itemSubmission.submissionTime,
        },
      };

      await itemSubmissionQueueBulkWrite([message]);
    }

    async function processBatch(events: TapEvent[]): Promise<void> {
      if (events.length === 0) return;

      const rawSubmissions = events
        .map(transformTapEvent)
        .filter((s): s is NonNullable<typeof s> => s != null);

      if (rawSubmissions.length === 0) return;

      const itemTypes = await moderationConfigService.getItemTypes({
        orgId: config.orgId,
        directives: { maxAge: 10 },
      });

      const toItemSubmission = rawItemSubmissionToItemSubmission.bind(
        null,
        itemTypes,
        config.orgId,
        async () => undefined,
      );

      for (const rawSubmission of rawSubmissions) {
        try {
          const result = await toItemSubmission(rawSubmission);
          if (result.error || !result.itemSubmission) continue;

          const itemSubmission = result.itemSubmission as ItemSubmission & {
            submissionTime: Date;
          };

          // Ensure submissionTime is set
          if (!itemSubmission.submissionTime) {
            (itemSubmission as any).submissionTime = new Date();
          }

          const promises: Promise<void>[] = [];

          if (useReportPath) {
            promises.push(submitViaReportPath(itemSubmission));
          }

          if (useItemsPath) {
            promises.push(submitViaItemsPath(itemSubmission));
          }

          await Promise.all(promises);
        } catch (err) {
          console.error(
            '[TapConnector] Failed to process event:',
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Ack the last event ID in the batch
      const lastEvent = events[events.length - 1];
      if (lastEvent && tapClient) {
        tapClient.ack(lastEvent.id);
      }
    }

    function flushBatch(): void {
      const batch = batchBuffer;
      batchBuffer = [];

      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }

      processBatch(batch).catch((err) => {
        console.error('[TapConnector] Batch processing error:', err);
      });
    }

    function onEvent(event: TapEvent): void {
      if (shutdownRequested) return;

      batchBuffer.push(event);

      if (batchBuffer.length >= config.batchSize) {
        flushBatch();
      } else if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, config.batchIntervalMs);
      }
    }

    return {
      type: 'Worker' as const,

      async run(_signal?: AbortSignal): Promise<void> {
        if (!config.orgId) {
          console.error(
            '[TapConnector] TAP_ORG_ID not set, skipping startup',
          );
          return;
        }

        console.log(
          `[TapConnector] Starting with ingestion mode: ${ingestionMode}`,
        );

        tapAdminApi = new TapAdminApi(
          config.tapUrl,
          config.tapAdminPassword,
        );

        tapClient = new TapClient({
          tapUrl: config.tapUrl,
          onEvent,
          onError: (err) => {
            console.error('[TapConnector] Event error:', err.message);
          },
        });

        tapClient.connect();

        await new Promise<void>((resolve) => {
          const checkShutdown = setInterval(() => {
            if (shutdownRequested) {
              clearInterval(checkShutdown);
              resolve();
            }
          }, 500);

          _signal?.addEventListener('abort', () => {
            shutdownRequested = true;
          });
        });
      },

      async shutdown(): Promise<void> {
        shutdownRequested = true;

        if (batchBuffer.length > 0) {
          try {
            await processBatch(batchBuffer);
            batchBuffer = [];
          } catch {
            // Best-effort flush on shutdown
          }
        }

        if (batchTimer) {
          clearTimeout(batchTimer);
          batchTimer = null;
        }

        await tapClient?.close();
      },

      getAdminApi(): TapAdminApi | null {
        return tapAdminApi;
      },
    };
  },
);

export default makeTapConnectorWorker;
