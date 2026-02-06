import type Bottle from '@ethanresnick/bottlejs';

import { makeDetectRulePassRateAnomaliesJob } from '../../services/ruleAnomalyDetectionService/index.js';
import { makeRefreshUserScoresCacheJob } from '../../services/userStatisticsService/index.js';
import { type Job, type Worker } from '../../workers_jobs/index.js';
import makeItemProcessingWorker from '../../workers_jobs/ItemProcessingWorker.js';
import makeRefreshMRTDecisionsMaterializedViewJob from '../../workers_jobs/RefreshMRTDecisionsMaterializedViewJob.js';
import makeRetryFailedNcmecDecisionsJob from '../../workers_jobs/RetryFailedNcmecDecisionsJob.js';
import makeRunUserRulesJob from '../../workers_jobs/RunUserRulesJob.js';
import makeSnowflakeIngestionToS3Worker from '../../workers_jobs/SnowflakeIngestionToS3Worker.js';
import { type Dependencies } from '../index.js';
import { register } from '../utils.js';

declare module '../index.js' {
  interface Dependencies {
    // NB: worker deps cannot be renamed
    // w/o breaking the kubernetes logic that starts them!
    DumpToS3Worker: Worker;
    SnowflakeIngestionToS3Worker: Worker;
    ItemProcessingWorker: Worker;

    // Jobs. Like workers, can't be renamed w/o breaking stuff.
    // The distinction between jobs and workers is that workers run continuously,
    // whereas jobs run on a schedule and exit when done. However, both use the
    // same run-worker-or-job script right now for starting + graceful shutdowns.)
    DetectRulePassRateAnomaliesJob: Job;
    RunUserRulesJob: Job;
    RefreshUserScoresCacheJob: Job;
    IngestReportsIntoMRTJob: Job;
    RetryFailedNcmecDecisionsJob: Job;
    RefreshMRTDecisionsMaterializedViewJob: Job;
  }
}

export function registerWorkersAndJobs(bottle: Bottle<Dependencies>) {
  register(
    bottle,
    'SnowflakeIngestionToS3Worker',
    makeSnowflakeIngestionToS3Worker,
  );
  register(bottle, 'ItemProcessingWorker', makeItemProcessingWorker);
  register(bottle, 'RunUserRulesJob', makeRunUserRulesJob);
  register(
    bottle,
    'RefreshMRTDecisionsMaterializedViewJob',
    makeRefreshMRTDecisionsMaterializedViewJob,
  );
  register(
    bottle,
    'DetectRulePassRateAnomaliesJob',
    makeDetectRulePassRateAnomaliesJob,
  );
  register(bottle, 'RefreshUserScoresCacheJob', makeRefreshUserScoresCacheJob);
  register(
    bottle,
    'RetryFailedNcmecDecisionsJob',
    makeRetryFailedNcmecDecisionsJob,
  );
}
