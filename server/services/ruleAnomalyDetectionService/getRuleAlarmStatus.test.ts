import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import fc from 'fast-check';
import yaml from 'js-yaml';
import _ from 'lodash';

import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import getRuleAlarmStatus from './getRuleAlarmStatus.js';

const { sum } = _;

const sampleArbitrary = fc
  .tuple(fc.nat(), fc.nat())
  .map(([a, b]) => ({ passes: a, runs: a + b || 1 }));

const samplesPassRate = (samples: { passes: number; runs: number }[]) =>
  sum(samples.map((it) => it.passes)) / sum(samples.map((it) => it.runs));

const __dirname = dirname(new URL(import.meta.url).pathname);
const tableDump = yaml.load(
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFileSync(
    join(__dirname, '../../test/stubs/rule_pass_sample_data.yaml'),
    'utf-8',
  ),
) as {
  [ruleId: string]: { passes: number; runs: number; pass_rate: number }[];
};

describe('getRuleAlarmStatus', () => {
  // Again, we don't really know what the 'right' behavior is, so these tests
  // just verify some lose constrainsts as a sanity check on the current logic,
  // and to prevent regressions.
  test('should return false when no executions passed', () => {
    // This could be a property test, but it doesn't really need to be.
    const sampleData = [
      { passes: 0, runs: 15783 },
      { passes: 0, runs: 18528 },
      { passes: 0, runs: 17253 },
      { passes: 0, runs: 15372 },
      { passes: 0, runs: 9759 },
    ];

    expect([RuleAlarmStatus.OK, RuleAlarmStatus.INSUFFICIENT_DATA]).toContain(
      getRuleAlarmStatus(sampleData),
    );
  });

  test('should return false if the pass rate in the most recent period is lower than the historical average', () => {
    fc.assert(
      fc.property(fc.array(sampleArbitrary, { minLength: 25 }), (samples) => {
        // Construct a new sample with a mean just below the generated ones.
        const samplePassRate = samplesPassRate(samples);

        const latestPeriod = {
          passes: 1,
          runs: Math.ceil(1 / samplePassRate) + 1,
        };

        expect([
          RuleAlarmStatus.OK,
          RuleAlarmStatus.INSUFFICIENT_DATA,
        ]).toContain(getRuleAlarmStatus([latestPeriod, ...samples]));
      }),
    );
  });

  test('should produce plausible results given sample data', () => {
    const results = Object.fromEntries(
      Object.entries(tableDump).map(([ruleId, ruleData]) => {
        return [ruleId, getRuleAlarmStatus(ruleData)];
      }),
    );

    // Everything from this table dump of real data isn't anomalous.
    expect(results).toMatchInlineSnapshot(`
      {
        "060ba6f64ab": "OK",
        "07b248e6c5b": "OK",
        "0bec4897302": "OK",
        "2bf679d4520": "OK",
        "2fc6ec48b68": "OK",
        "4fb36ec8fb0": "OK",
        "67b4a7ff206": "OK",
        "682bf679d45": "OK",
        "772be50f82a": "OK",
        "7b248e6c5bd": "OK",
        "7b4a7ff2064": "OK",
        "8060ba6f64a": "OK",
        "82bf679d452": "OK",
        "878060ba6f6": "OK",
        "a0140eb5fa0": "OK",
        "b1fd90d4b09": "OK",
        "b4a7ff2064d": "OK",
        "ba9fb0cf3f8": "OK",
        "bec48973022": "OK",
        "c682bf679d4": "OK",
        "ce549bbaf40": "OK",
        "e549bbaf40a": "OK",
        "e6884fe7426": "OK",
      }
    `);
  });

  test('should report some anomalies if the pass rate is 1%', () => {
    // The media pass rate across all rules in our sample data way, way under
    // 1%, so this is a huge increase that should very often get flagged.
    const results = Object.fromEntries(
      Object.entries(tableDump).map(([ruleId, [lastPeriod, ...rest]]) => {
        return [
          ruleId,
          [
            // log true pass rate from before we modified it.
            lastPeriod.passes / lastPeriod.runs,
            getRuleAlarmStatus([
              { ...lastPeriod, passes: Math.floor(lastPeriod.runs * 0.01) },
              ...rest,
            ]),
          ],
        ];
      }),
    );

    expect(results).toMatchInlineSnapshot(`
      {
        "060ba6f64ab": [
          0.0010648007301490721,
          "ALARM",
        ],
        "07b248e6c5b": [
          0.0019014298752662003,
          "ALARM",
        ],
        "0bec4897302": [
          0,
          "ALARM",
        ],
        "2bf679d4520": [
          0.000152114390021296,
          "ALARM",
        ],
        "2fc6ec48b68": [
          0,
          "ALARM",
        ],
        "4fb36ec8fb0": [
          0.0027380590203833284,
          "ALARM",
        ],
        "67b4a7ff206": [
          0.000076057195010648,
          "ALARM",
        ],
        "682bf679d45": [
          0.00007599939200486396,
          "ALARM",
        ],
        "772be50f82a": [
          0.000076057195010648,
          "ALARM",
        ],
        "7b248e6c5bd": [
          0.009507149376331,
          "OK",
        ],
        "7b4a7ff2064": [
          0.0038028597505324006,
          "ALARM",
        ],
        "8060ba6f64a": [
          0.0007605719501064801,
          "ALARM",
        ],
        "82bf679d452": [
          0.00022817158503194403,
          "ALARM",
        ],
        "878060ba6f6": [
          0.0063127471858837846,
          "ALARM",
        ],
        "a0140eb5fa0": [
          0,
          "ALARM",
        ],
        "b1fd90d4b09": [
          0,
          "ALARM",
        ],
        "b4a7ff2064d": [
          0.006991944064447485,
          "ALARM",
        ],
        "ba9fb0cf3f8": [
          0.001823985408116735,
          "ALARM",
        ],
        "bec48973022": [
          0.0007605719501064801,
          "ALARM",
        ],
        "c682bf679d4": [
          0,
          "ALARM",
        ],
        "ce549bbaf40": [
          0.0015972010952236082,
          "ALARM",
        ],
        "e549bbaf40a": [
          0.0006845147550958321,
          "ALARM",
        ],
        "e6884fe7426": [
          0,
          "ALARM",
        ],
      }
    `);
  });
});
