// @vitest-environment node
import { GQLJobPriorityProperty } from '@/graphql/generated';
import {
  jobPriorityRowsToMap,
  jobPriorityWeightsChanged,
  jobPriorityWeightsInput,
} from '@/webpages/settings/jobPriorityWeights';

const { NumReports, UserScore } = GQLJobPriorityProperty;

describe('jobPriorityRowsToMap', () => {
  test('empty rows produce an empty map', () => {
    expect(jobPriorityRowsToMap([]).size).toBe(0);
  });

  test('keys the map by property', () => {
    const map = jobPriorityRowsToMap([
      { property: NumReports, weight: 7 },
      { property: UserScore, weight: 3 },
    ]);
    expect(map.get(NumReports)).toBe(7);
    expect(map.get(UserScore)).toBe(3);
  });
});

describe('jobPriorityWeightsInput', () => {
  test('emits one entry per known property, even when the map is empty', () => {
    const { weights } = jobPriorityWeightsInput(new Map());
    expect(weights).toEqual([
      { property: NumReports, weight: 0 },
      { property: UserScore, weight: 0 },
    ]);
  });

  test('uses the map value for each property', () => {
    const { weights } = jobPriorityWeightsInput(
      new Map([
        [NumReports, 9],
        [UserScore, 4],
      ]),
    );
    expect(weights).toEqual([
      { property: NumReports, weight: 9 },
      { property: UserScore, weight: 4 },
    ]);
  });

  test('defaults a missing property to 0 rather than dropping it', () => {
    const { weights } = jobPriorityWeightsInput(new Map([[NumReports, 5]]));
    expect(weights).toEqual([
      { property: NumReports, weight: 5 },
      { property: UserScore, weight: 0 },
    ]);
  });
});

describe('jobPriorityWeightsChanged', () => {
  test('false when the form matches the persisted rows', () => {
    const saved = [
      { property: NumReports, weight: 7 },
      { property: UserScore, weight: 3 },
    ];
    const current = new Map([
      [NumReports, 7],
      [UserScore, 3],
    ]);
    expect(jobPriorityWeightsChanged(saved, current)).toBe(false);
  });

  test('false when nothing is saved and the form is all zero (missing == 0)', () => {
    expect(jobPriorityWeightsChanged([], new Map())).toBe(false);
    expect(
      jobPriorityWeightsChanged(
        [],
        new Map([
          [NumReports, 0],
          [UserScore, 0],
        ]),
      ),
    ).toBe(false);
  });

  test('true when a weight differs from the persisted value', () => {
    const saved = [{ property: NumReports, weight: 7 }];
    const current = new Map([[NumReports, 8]]);
    expect(jobPriorityWeightsChanged(saved, current)).toBe(true);
  });

  test('true when the form sets a value for a property the saved rows omit', () => {
    const current = new Map([[UserScore, 2]]);
    expect(jobPriorityWeightsChanged([], current)).toBe(true);
  });
});
