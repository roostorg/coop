import { readFileSync } from 'fs';
import { dirname, join } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';

import { type GetRuleAnomalyDetectionStatistics } from '../../services/ruleAnomalyDetectionService/index.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const tableDump = yaml.load(
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFileSync(join(__dirname, './rule_pass_sample_data.yaml'), 'utf-8'),
) as {
  [ruleId: string]: { passes: number; runs: number; pass_rate: number }[];
};

export const makeGetRuleAnomalyDetectionStatistics = (
  startFakePeriodDatesFrom: Date,
  fakeRuleIds: string[],
): GetRuleAnomalyDetectionStatistics =>
  async function (
    opts: {
      ruleIds?: string[];
      startTime?: Date;
      includePeriodsInProgress?: boolean;
    } = {},
  ) {
    const { ruleIds, includePeriodsInProgress = false, startTime } = opts;
    const firstPeriodTime = startFakePeriodDatesFrom.getTime();
    const fakeData = Object.entries(tableDump);

    return fakeRuleIds
      .flatMap((ruleId, i) =>
        fakeData[i % fakeData.length][1].map((period, periodIdx) => ({
          passCount: period.passes * 2,
          passingUsersCount: period.passes,
          runsCount: period.runs,
          ruleId,
          approxRuleVersion: new Date('2022-03-01T00:00Z'),
          windowStart: new Date(firstPeriodTime - periodIdx * 1000 * 60 * 60),
        })),
      )
      .filter(
        ({ ruleId, windowStart }) =>
          (!ruleIds || ruleIds.includes(ruleId)) &&
          (!startTime || windowStart > startTime),
      )
      .slice(includePeriodsInProgress ? 0 : 1);
  };
