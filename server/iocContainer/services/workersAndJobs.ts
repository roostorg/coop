import type Bottle from '@ethanresnick/bottlejs';

import { makeDetectRulePassRateAnomaliesJob } from '../../services/ruleAnomalyDetectionService/index.js';
import { makeRefreshUserScoresCacheJob } from '../../services/userStatisticsService/index.js';
import {
  type Job,
  type Worker,
  type WorkerOrJob,
} from '../../workers_jobs/index.js';
import makeItemProcessingWorker from '../../workers_jobs/ItemProcessingWorker.js';
import makeRefreshMRTDecisionsMaterializedViewJob from '../../workers_jobs/RefreshMRTDecisionsMaterializedViewJob.js';
import makeRetryFailedNcmecDecisionsJob from '../../workers_jobs/RetryFailedNcmecDecisionsJob.js';
import makeRunUserRulesJob from '../../workers_jobs/RunUserRulesJob.js';
import { type Dependencies } from '../index.js';
import { register, type AnnotatedFactory } from '../utils.js';

declare module '../index.js' {
  interface Dependencies {
    // NB: worker deps cannot be renamed
    // w/o breaking the deployment that starts them!
    ItemProcessingWorker: Worker;

    // Jobs. Like workers, can't be renamed w/o breaking stuff.
    // The distinction between jobs and workers is that workers run continuously,
    // whereas jobs run on a schedule and exit when done. However, both use the
    // same run-worker-or-job script right now for starting + graceful shutdowns.)
    DetectRulePassRateAnomaliesJob: Job;
    RunUserRulesJob: Job;
    RefreshUserScoresCacheJob: Job;
    RetryFailedNcmecDecisionsJob: Job;
    RefreshMRTDecisionsMaterializedViewJob: Job;
  }
}

const workerAndJobFactories = {
  ItemProcessingWorker: makeItemProcessingWorker,
  RunUserRulesJob: makeRunUserRulesJob,
  RefreshMRTDecisionsMaterializedViewJob:
    makeRefreshMRTDecisionsMaterializedViewJob,
  DetectRulePassRateAnomaliesJob: makeDetectRulePassRateAnomaliesJob,
  RefreshUserScoresCacheJob: makeRefreshUserScoresCacheJob,
  RetryFailedNcmecDecisionsJob: makeRetryFailedNcmecDecisionsJob,
} satisfies Record<string, AnnotatedFactory<WorkerOrJob>>;

export type WorkerOrJobName = keyof typeof workerAndJobFactories;

export const WORKER_AND_JOB_NAMES = Object.keys(
  workerAndJobFactories,
) as WorkerOrJobName[];

export function registerWorkersAndJobs(bottle: Bottle<Dependencies>) {
  for (const name of WORKER_AND_JOB_NAMES) {
    register(bottle, name, workerAndJobFactories[name]);
  }
}

export function isWorkerOrJobName(name: string): name is WorkerOrJobName {
  return WORKER_AND_JOB_NAMES.includes(name);
}
