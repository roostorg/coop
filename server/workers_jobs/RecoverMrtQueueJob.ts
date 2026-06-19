/* eslint-disable no-console */

import { type Kysely } from 'kysely';

import {
  enqueueOne,
  loadReportHistories,
  recordRecoveryFailureAndUpdateState,
  type Candidate,
  type EnqueueContainer,
  type RecoveryMode,
  type ReportHistoryContainer,
} from '../bin/recoverMrtQueueLib.js';
import { inject } from '../iocContainer/utils.js';
import {
  jobIdToGuid,
  type JobId,
  type ReportHistory,
} from '../services/manualReviewToolService/index.js';
import { jsonStringify } from '../utils/encoding.js';

type RecoveryPg = {
  'manual_review_tool.job_creations': {
    id: JobId;
    org_id: string;
    queue_id: string;
    item_id: string;
    item_type_id: string;
    created_at: Date;
    policy_ids: string[];
  };
  'manual_review_tool.manual_review_decisions': {
    id: string;
  };
};

type RecoveryCandidate = Candidate & {
  orgId: string;
  queueId: string;
};

const PAGE_SIZE = 1000;
const DECISION_CHUNK = 500;
const ENQUEUE_CONCURRENCY = 10;

async function loadRecoveryCandidates(
  pgQuery: Kysely<RecoveryPg>,
  lookbackDays: number,
) {
  const byKey = new Map<string, RecoveryCandidate>();
  const checkedGuids = new Set<string>();
  const decidedGuids = new Set<string>();
  let totalRowsLoaded = 0;
  let cursorCreatedAt: Date | null = null;
  let cursorId: JobId | null = null;

  while (true) {
    let q = pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select([
        'id',
        'org_id',
        'queue_id',
        'item_id',
        'item_type_id',
        'created_at',
        'policy_ids',
      ])
      .where(
        'created_at',
        '>=',
        new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
      );

    if (cursorCreatedAt != null && cursorId != null) {
      const cAt = cursorCreatedAt;
      const cId = cursorId;
      q = q.where((eb) =>
        eb.or([
          eb('created_at', '<', cAt),
          eb.and([eb('created_at', '=', cAt), eb('id', '<', cId)]),
        ]),
      );
    }

    const page = await q
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE_SIZE)
      .execute();

    if (page.length === 0) break;
    totalRowsLoaded = totalRowsLoaded + page.length;

    const newOrUpdatedJobIds: JobId[] = [];

    for (const row of page) {
      const key = `${row.org_id}\x00${row.queue_id}\x00${row.item_type_id}\x00${row.item_id}`;
      const existing = byKey.get(key);
      if (
        existing == null ||
        new Date(row.created_at).getTime() > existing.latestCreatedAt.getTime()
      ) {
        byKey.set(key, {
          orgId: row.org_id,
          queueId: row.queue_id,
          itemId: row.item_id,
          itemTypeId: row.item_type_id,
          latestJobId: row.id,
          latestCreatedAt: new Date(row.created_at),
          policyIds: row.policy_ids,
        });
        newOrUpdatedJobIds.push(row.id);
      }
    }

    const last = page[page.length - 1];
    cursorCreatedAt = new Date(last.created_at);
    cursorId = last.id;

    const newGuids: string[] = [];
    for (const jobId of newOrUpdatedJobIds) {
      const guid = jobIdToGuid(jobId);
      if (!checkedGuids.has(guid)) {
        checkedGuids.add(guid);
        newGuids.push(guid);
      }
    }

    for (let i = 0; i < newGuids.length; i += DECISION_CHUNK) {
      const chunk = newGuids.slice(i, i + DECISION_CHUNK);
      const decisionRows = await pgQuery
        .selectFrom('manual_review_tool.manual_review_decisions')
        .select(['id'])
        .where('id', 'in', chunk)
        .execute();
      for (const r of decisionRows) decidedGuids.add(r.id);
    }

    if (page.length < PAGE_SIZE) break;
  }

  console.log(
    `Loaded ${totalRowsLoaded} job_creations rows across paginated reads`,
  );
  console.log(`Deduplicated to ${byKey.size} distinct items`);

  return Array.from(byKey.values()).filter(
    (c) => !decidedGuids.has(jobIdToGuid(c.latestJobId)),
  );
}

async function processCandidatesForGroup(opts: {
  recoveryContainer: EnqueueContainer;
  manualReviewToolService: {
    getRecoveryStatesForJobIds(
      jobIds: readonly string[],
    ): Promise<Array<{ jobId: string; status: 'PENDING' | 'FAILED' }>>;
    deleteRecoveryStatesForJobIds(jobIds: readonly string[]): Promise<void>;
    recordRecoveryFailure(input: {
      jobId: string;
      orgId: string;
      queueId: string;
      itemId: string;
      itemTypeId: string;
      error: string;
      maxRetries: number;
    }): Promise<{ retryCount: number; status: 'PENDING' | 'FAILED' }>;
  };
  configService: {
    mrtRecoveryMaxRetries: number;
  };
  candidates: readonly RecoveryCandidate[];
  mode: RecoveryMode;
  reportHistoryByItem: Map<string, ReportHistory>;
}) {
  const { manualReviewToolService, candidates, mode, reportHistoryByItem } =
    opts;
  const stats = { enqueued: 0, skipped: 0, failed: 0 };
  let cursor = 0;
  const recoveryStates = new Map(
    (
      await manualReviewToolService.getRecoveryStatesForJobIds(
        candidates.map((c) => c.latestJobId),
      )
    ).map((state) => [state.jobId, state]),
  );

  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      const currentState = recoveryStates.get(candidate.latestJobId);
      if (currentState?.status === 'FAILED') {
        stats.skipped++;
        continue;
      }

      try {
        const result = await enqueueOne(
          opts.recoveryContainer,
          candidate.orgId,
          candidate.queueId,
          candidate,
          mode,
          reportHistoryByItem,
        );

        if (result === 'enqueued') {
          await manualReviewToolService.deleteRecoveryStatesForJobIds([
            candidate.latestJobId,
          ]);
          stats.enqueued++;
          continue;
        }

        await recordRecoveryFailureAndUpdateState({
          manualReviewToolService,
          recoveryStates,
          candidate,
          error: 'Recovery skipped because the item could not be rebuilt',
          maxRetries: opts.configService.mrtRecoveryMaxRetries,
        });
        stats.skipped++;
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        const updated = await recordRecoveryFailureAndUpdateState({
          manualReviewToolService,
          recoveryStates,
          candidate,
          error,
          maxRetries: opts.configService.mrtRecoveryMaxRetries,
        });
        stats.failed++;
        if (updated.status === 'FAILED') {
          console.warn(
            `[${candidate.orgId} ${candidate.queueId} ${candidate.itemTypeId}/${candidate.itemId}] recovery exhausted after ${updated.retryCount} attempts`,
          );
        }
      }
    }
  };

  await Promise.all(Array.from({ length: ENQUEUE_CONCURRENCY }, worker));
  return stats;
}

export default inject(
  [
    'closeSharedResourcesForShutdown',
    'ManualReviewToolService',
    'NcmecService',
    'ConfigService',
    'KyselyPg',
    'DataWarehouse',
    'Tracer',
    'ItemInvestigationService',
  ],
  (
    closeSharedResourcesForShutdown,
    manualReviewToolService,
    ncmecService,
    configService,
    pgQuery,
    dataWarehouse,
    tracer,
    itemInvestigationService,
  ) => {
    const recoveryContainer: ReportHistoryContainer = {
      DataWarehouse: dataWarehouse,
      Tracer: tracer,
    };
    const enqueueContainer: EnqueueContainer = {
      ItemInvestigationService: itemInvestigationService,
      ManualReviewToolService: manualReviewToolService,
      NcmecService: ncmecService,
    };

    async function buildReportHistoryByOrg(
      orgId: string,
      candidates: readonly RecoveryCandidate[],
    ) {
      const out = new Map<string, ReportHistory>();
      await loadReportHistories(recoveryContainer, orgId, candidates, out);
      return out;
    }

    return {
      type: 'Job' as const,
      async run() {
        const candidates = await loadRecoveryCandidates(
          pgQuery,
          configService.mrtRecoveryLookbackDays,
        );

        if (candidates.length === 0) {
          console.log('No MRT candidates found for recovery');
          return;
        }

        const settingsByOrg = new Map<
          string,
          { defaultNcmecQueueId: string | null }
        >(
          await Promise.all(
            [...new Set(candidates.map((c) => c.orgId))].map(
              async (
                orgId,
              ): Promise<[string, { defaultNcmecQueueId: string | null }]> => [
                orgId,
                {
                  defaultNcmecQueueId:
                    (await ncmecService.getNcmecOrgSettings(orgId))
                      ?.defaultNcmecQueueId ?? null,
                },
              ],
            ),
          ),
        );

        const defaultCandidatesByOrg = new Map<string, RecoveryCandidate[]>();
        const ncmecCandidatesByOrg = new Map<string, RecoveryCandidate[]>();
        for (const candidate of candidates) {
          const mode =
            settingsByOrg.get(candidate.orgId)?.defaultNcmecQueueId ===
            candidate.queueId
              ? 'ncmec'
              : 'default';
          const bucket =
            mode === 'ncmec' ? ncmecCandidatesByOrg : defaultCandidatesByOrg;
          const list = bucket.get(candidate.orgId) ?? [];
          list.push(candidate);
          bucket.set(candidate.orgId, list);
        }

        for (const [orgId, orgCandidates] of defaultCandidatesByOrg) {
          const reportHistoryByItem = await buildReportHistoryByOrg(
            orgId,
            orgCandidates,
          );
          const stats = await processCandidatesForGroup({
            recoveryContainer: enqueueContainer,
            manualReviewToolService,
            configService,
            candidates: orgCandidates,
            mode: 'default',
            reportHistoryByItem,
          });
          console.log(jsonStringify({ orgId, mode: 'default', stats }));
        }

        for (const [orgId, orgCandidates] of ncmecCandidatesByOrg) {
          const stats = await processCandidatesForGroup({
            recoveryContainer: enqueueContainer,
            manualReviewToolService,
            configService,
            candidates: orgCandidates,
            mode: 'ncmec',
            reportHistoryByItem: new Map(),
          });
          console.log(jsonStringify({ orgId, mode: 'ncmec', stats }));
        }
      },
      async shutdown() {
        await closeSharedResourcesForShutdown();
      },
    };
  },
);
