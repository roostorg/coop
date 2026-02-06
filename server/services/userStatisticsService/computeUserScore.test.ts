// eslint-disable-next-line import/no-extraneous-dependencies
import { computeUserScore } from './computeUserScore.js';

describe('computeUserScore', () => {
  const userSubmissionStatistics = [
    { itemTypeId: 'abc', numSubmissions: 92 },
    { itemTypeId: 'def', numSubmissions: 8 },
  ];

  const userActionStatistics = [
    // This action, policy pair was applied twice by user rules,
    // hence no item submission ids.
    {
      actionId: '1',
      policyId: '1',
      count: 2,
      itemSubmissionIds: [],
    },
  ];

  test('should count actions triggered by user rules', async () => {
    const sut = computeUserScore.bind(
      null,
      userSubmissionStatistics,
      userActionStatistics,
    );

    // should have two actions, with an effective 4 penalty points, out of 100
    // submissions, which is a 4.
    expect(
      await sut([{ policyId: '1', actionId: '1', penalties: [1, 3] }]),
    ).toBe(4);

    // ditto, but now 6 penalty points, which is a 3.
    expect(
      await sut([{ policyId: '1', actionId: '1', penalties: [2, 4] }]),
    ).toBe(3);
  });

  test('should apply only the most-severe penalty per item submission', async () => {
    const sut = computeUserScore.bind(null, userSubmissionStatistics, [
      { actionId: '1', policyId: '1', count: 1, itemSubmissionIds: ['a'] },
      { actionId: '2', policyId: '1', count: 1, itemSubmissionIds: ['a'] },
    ]);

    // should use penalty 4 for submission `a`, because that's the highest
    // first-strike penalty among the (action, policy) pairs that `a` matched.
    expect(
      await sut([
        { actionId: '1', policyId: '1', penalties: [2, 12] },
        { actionId: '2', policyId: '1', penalties: [4] },
      ]),
    ).toBe(4);
  });

  test('should return expected results', async () => {
    const sut = computeUserScore.bind(
      null,
      [
        { itemTypeId: 'abc', numSubmissions: 92 },
        { itemTypeId: 'def', numSubmissions: 8 },
      ],
      [
        {
          actionId: '1',
          policyId: '1',
          count: 2,
          itemSubmissionIds: ['a', 'b'],
        },
        { actionId: '2', policyId: '1', count: 1, itemSubmissionIds: ['c'] },
        { actionId: '1', policyId: '2', count: 1, itemSubmissionIds: ['d'] },
        {
          actionId: '2',
          policyId: '2',
          count: 6,
          itemSubmissionIds: ['e', 'f', 'g', 'h', 'i', 'j'],
        },
        // doesn't blow up on null policy id. and the penalty from (action,
        // policy) = (2, 2) above should apply to these repeat submission ids.
        {
          actionId: '2',
          policyId: null,
          count: 2,
          itemSubmissionIds: ['i', 'j'],
        },
      ],
    );

    // If no penalties are defined, the user should get a score of 5.
    expect(await sut([])).toBe(5);

    // if the penalties are all 1 (which should apply to all subsequent
    // "strikes"), then we have 10 violations out of 100 submissions, which
    // should be a 3.
    expect(
      await sut([
        { actionId: '1', policyId: '1', penalties: [1] },
        { actionId: '1', policyId: '2', penalties: [1] },
        { actionId: '2', policyId: '1', penalties: [1] },
        { actionId: '2', policyId: '2', penalties: [1] },
      ]),
    ).toBe(3);

    // If one penalty is 3, then we have 13 'effective' violations out of 100
    // submissions, which would be a 2.
    expect(
      await sut([
        { actionId: '1', policyId: '1', penalties: [1] },
        { actionId: '1', policyId: '2', penalties: [1] },
        { actionId: '2', policyId: '1', penalties: [3] },
        { actionId: '2', policyId: '2', penalties: [1] },
      ]),
    ).toBe(2);

    // One penalty at 3 for an one (action, penalty) pair that occurred twice,
    // plus one penatly at 9, means we have 28 effective violations out of 100,
    // which should be a 2.
    expect(
      await sut([
        { actionId: '1', policyId: '1', penalties: [3] },
        { actionId: '1', policyId: '2', penalties: [1] },
        { actionId: '2', policyId: '1', penalties: [9] },
        { actionId: '2', policyId: '2', penalties: [1] },
      ]),
    ).toBe(2);

    // it should support different penalties for the first, second, ..., nth
    // violation. (action 2, policy 2) has six occurrences, so this should lead
    // to 1 + 3 + 9 + 27 + 27 + 27 = 94 effective violations out of 100.
    expect(
      await sut([{ actionId: '2', policyId: '2', penalties: [1, 3, 9, 27] }]),
    ).toBe(1);
  });
});
