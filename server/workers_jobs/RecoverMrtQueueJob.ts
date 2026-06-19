/* eslint-disable no-console */

import { loadRecoveryCandidates } from '../bin/recoverMrtQueueCandidates.js';
import {
  loadReportHistories,
  processRecoveryCandidatesForGroup,
  type EnqueueContainer,
  type RecoveryCandidate,
  type ReportHistoryContainer,
} from '../bin/recoverMrtQueueLib.js';
import { inject } from '../iocContainer/utils.js';
import { type ReportHistory } from '../services/manualReviewToolService/index.js';
import { jsonStringify } from '../utils/encoding.js';

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
          const reportHistoryByItem = new Map<string, ReportHistory>();
          await loadReportHistories(
            recoveryContainer,
            orgId,
            orgCandidates,
            reportHistoryByItem,
          );
          const stats = await processRecoveryCandidatesForGroup({
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
          const stats = await processRecoveryCandidatesForGroup({
            recoveryContainer: enqueueContainer,
            manualReviewToolService,
            configService,
            candidates: orgCandidates,
            mode: 'ncmec',
            reportHistoryByItem: new Map<string, ReportHistory>(),
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
