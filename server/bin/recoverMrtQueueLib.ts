/* eslint-disable no-console */
/**
 * Helpers for `bin/recover-mrt-queue.ts`. Split out so the entry-point file
 * stays under the 500-line per-file lint cap; not intended for general reuse.
 */
import { type ItemIdentifier } from '@roostorg/coop-types';
import { v1 as uuidv1 } from 'uuid';

import type getBottle from '../iocContainer/index.js';
import { itemSubmissionToItemSubmissionWithTypeIdentifier } from '../services/itemProcessingService/index.js';
import {
  type JobId,
  type ManualReviewJobInput,
  type ReportHistory,
} from '../services/manualReviewToolService/index.js';
import { toCorrelationId } from '../utils/correlationIds.js';

export type Container = Awaited<ReturnType<typeof getBottle>>['container'];

export const RECOVERY_MODES = ['default', 'ncmec'] as const;
export type RecoveryMode = (typeof RECOVERY_MODES)[number];

export function isRecoveryMode(value: unknown): value is RecoveryMode {
  return (
    typeof value === 'string' &&
    (RECOVERY_MODES as readonly string[]).includes(value)
  );
}

export type Candidate = {
  itemId: string;
  itemTypeId: string;
  /** Latest job_creations.id (an external JobId) for this item in this queue. */
  latestJobId: JobId;
  /** Latest job_creations.created_at for this item in this queue. */
  latestCreatedAt: Date;
  policyIds: readonly string[];
};

export function itemKey(c: Pick<Candidate, 'itemId' | 'itemTypeId'>): string {
  return `${c.itemTypeId}\x00${c.itemId}`;
}

export type EnqueueResult = 'enqueued' | 'skipped';
export type EnqueueStats = {
  enqueued: number;
  skipped: number;
  failed: number;
};

/**
 * Shape of a row from `REPORTING_SERVICE.REPORTS`. All fields are nullable
 * because warehouse rows aren't guaranteed to be fully populated.
 */
type ReportsWarehouseRow = {
  org_id: string | null;
  request_id: string | null;
  reporter_user_id: string | null;
  reporter_user_item_type_id: string | null;
  reporter_kind: string | null;
  reported_at: string | null;
  policy_id: string | null;
  reported_for_reason: string | null;
  reported_item_id: string | null;
  reported_item_type_id: string | null;
};

/**
 * Bulk-fetch report history rows from the data warehouse for every candidate.
 * Mutates `out` in place. Chunks queries to stay under CH's parameter limit.
 */
export async function loadReportHistories(
  container: Container,
  orgId: string,
  candidates: readonly Candidate[],
  out: Map<string, ReportHistory>,
): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK);
    const itemIds = chunk.map((c) => c.itemId);
    const itemTypeIds = chunk.map((c) => c.itemTypeId);
    // Positional `?` placeholders. The IN-list match here is the cross-product
    // of the two columns, so we filter the (item_id, item_type_id) tuple in
    // JS (CH lacks a portable IN-tuple across providers).
    const rows = (await container.DataWarehouse.query(
      `
        SELECT
          org_id,
          request_id,
          reporter_user_id,
          reporter_user_item_type_id,
          reporter_kind,
          reported_at,
          policy_id,
          reported_for_reason,
          reported_item_id,
          reported_item_type_id
        FROM REPORTING_SERVICE.REPORTS
        WHERE org_id = ?
          AND reported_item_id IN (${itemIds.map(() => '?').join(', ')})
          AND reported_item_type_id IN (${itemTypeIds.map(() => '?').join(', ')})
        ORDER BY reported_at ASC
      `,
      container.Tracer,
      [orgId, ...itemIds, ...itemTypeIds],
    )) as readonly ReportsWarehouseRow[];

    const validKeys = new Set(chunk.map((c) => itemKey(c)));
    for (const row of rows) {
      const itemId = row.reported_item_id ?? '';
      const itemTypeId = row.reported_item_type_id ?? '';
      const key = `${itemTypeId}\x00${itemId}`;
      if (!validKeys.has(key)) continue;

      // The reportId surfaced via the API is the segment after `submit-report:`
      // in the warehouse's correlation-style request_id; fall back to the raw
      // value if the format ever changes so we don't lose the row entirely.
      const requestId = row.request_id ?? '';
      const reportId = requestId.includes(':')
        ? requestId.slice(requestId.indexOf(':') + 1)
        : requestId;

      const reportedAt =
        row.reported_at != null ? new Date(row.reported_at) : new Date(0);
      if (Number.isNaN(reportedAt.getTime())) continue;

      const reporterId: ItemIdentifier | undefined =
        row.reporter_kind === 'user' &&
        row.reporter_user_id != null &&
        row.reporter_user_item_type_id != null
          ? {
              id: row.reporter_user_id,
              typeId: row.reporter_user_item_type_id,
            }
          : undefined;

      const entry = {
        reporterId,
        reason: row.reported_for_reason ?? undefined,
        reportId,
        reportedAt,
        policyId: row.policy_id ?? undefined,
      };

      const existing = out.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        out.set(key, [entry]);
      }
    }
  }
}

/**
 * Re-enqueue one candidate. DEFAULT goes through `ManualReviewToolService.enqueue`;
 * NCMEC goes through `NcmecService.enqueueForHumanReviewIfApplicable`, which
 * always routes to the org's configured default NCMEC queue.
 */
export async function enqueueOne(
  container: Container,
  orgId: string,
  queueId: string,
  candidate: Candidate,
  mode: RecoveryMode,
  reportHistoryByItem: Map<string, ReportHistory>,
): Promise<EnqueueResult> {
  const itemIdentifier: ItemIdentifier = {
    id: candidate.itemId,
    typeId: candidate.itemTypeId,
  };

  // `job_creations` only stores ids, so we re-fetch the body via
  // ItemInvestigationService, which cascades Scylla -> Partial Items endpoint
  // -> warehouse content-API requests. If all three miss the item is gone
  // and we skip.
  const itemResult =
    await container.ItemInvestigationService.getItemByIdentifier({
      orgId,
      itemIdentifier,
      latestSubmissionOnly: true,
    }).catch((e: unknown) => {
      console.warn(
        `[${candidate.itemTypeId}/${candidate.itemId}] item lookup failed:`,
        e instanceof Error ? e.message : e,
      );
      return null;
    });
  if (itemResult?.latestSubmission == null) {
    console.warn(
      `[${candidate.itemTypeId}/${candidate.itemId}] no item data found in Scylla, partial-items endpoint, or warehouse -- skipping`,
    );
    return 'skipped';
  }

  // The adapter returns a full `ItemSubmission`; enqueue expects the
  // slimmer `ItemSubmissionWithTypeIdentifier`.
  const itemSubmission = itemSubmissionToItemSubmissionWithTypeIdentifier(
    itemResult.latestSubmission,
  );

  // Synthetic correlation id makes this run greppable in logs/traces.
  const correlationId = toCorrelationId<'manual-action-run'>({
    type: 'manual-action-run',
    id: `recover-mrt-queue:${uuidv1()}`,
  });

  if (mode === 'ncmec') {
    const result =
      await container.NcmecService.enqueueForHumanReviewIfApplicable({
        orgId,
        createdAt: candidate.latestCreatedAt,
        item: itemSubmission,
        correlationId,
        enqueueSource: 'MRT_JOB',
        enqueueSourceInfo: { kind: 'MRT_JOB' },
        reenqueuedFrom: { jobId: candidate.latestJobId },
      });
    return result.status === 'ENQUEUED' ? 'enqueued' : 'skipped';
  }

  // `reportedForReasons` is mirrored from the rebuilt history so the reviewer
  // UI shows reporter+reason without restoring the legacy field.
  const history = reportHistoryByItem.get(itemKey(candidate)) ?? [];
  const input: ManualReviewJobInput = {
    orgId,
    correlationId,
    createdAt: candidate.latestCreatedAt,
    enqueueSource: 'MRT_JOB',
    enqueueSourceInfo: { kind: 'MRT_JOB' },
    reenqueuedFrom: { jobId: candidate.latestJobId },
    payload: {
      kind: 'DEFAULT',
      item: itemSubmission,
      reportHistory: history,
      reportedForReasons: history.map((h) => ({
        reporterId: h.reporterId,
        reason: h.reason,
      })),
    },
    policyIds: [...candidate.policyIds],
  };

  await container.ManualReviewToolService.enqueue(input, queueId);
  return 'enqueued';
}

/**
 * Drain `candidates` through a fixed-size pool of workers. Per-item errors
 * are caught so a single bad item doesn't abort the whole run.
 */
export async function runEnqueueWorkers(
  container: Container,
  orgId: string,
  queueId: string,
  candidates: readonly Candidate[],
  mode: RecoveryMode,
  reportHistoryByItem: Map<string, ReportHistory>,
  concurrency: number,
): Promise<EnqueueStats> {
  const stats: EnqueueStats = { enqueued: 0, skipped: 0, failed: 0 };
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      try {
        const result = await enqueueOne(
          container,
          orgId,
          queueId,
          candidate,
          mode,
          reportHistoryByItem,
        );
        stats[result]++;
      } catch (e: unknown) {
        stats.failed++;
        console.warn(
          `[${candidate.itemTypeId}/${candidate.itemId}] enqueue failed:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return stats;
}
