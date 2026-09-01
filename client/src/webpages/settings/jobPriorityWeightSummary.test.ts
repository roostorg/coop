// @vitest-environment node
import { summarizeWeighting } from '@/webpages/settings/jobPriorityWeightSummary';

describe('summarizeWeighting', () => {
  const REPORTS = '# of User Reports';
  const SCORE = 'User Score';

  test('all weights zero falls back to FIFO wording', () => {
    expect(
      summarizeWeighting([
        { label: REPORTS, weight: 0 },
        { label: SCORE, weight: 0 },
      ]),
    ).toContain('first-in, first-out');
  });

  test('a single non-zero weight is described as entirely toward it', () => {
    expect(
      summarizeWeighting([
        { label: REPORTS, weight: 10 },
        { label: SCORE, weight: 0 },
      ]),
    ).toBe(`Your queue order is weighted entirely toward ${REPORTS}.`);
  });

  test('equal weights are described as evenly across both', () => {
    expect(
      summarizeWeighting([
        { label: REPORTS, weight: 7 },
        { label: SCORE, weight: 7 },
      ]),
    ).toBe(
      `Your queue order is weighted evenly across ${REPORTS} and ${SCORE}.`,
    );
  });

  test('a dominant weight (>=70% share) reads "heavily toward"', () => {
    // 10 / (10 + 2) = ~0.83
    expect(
      summarizeWeighting([
        { label: REPORTS, weight: 10 },
        { label: SCORE, weight: 2 },
      ]),
    ).toBe(
      `Your queue order is weighted heavily toward ${REPORTS}, with some weight on ${SCORE}.`,
    );
  });

  test('a mild lead (<70% share) reads "toward" without "heavily"', () => {
    // 10 / (10 + 6) = 0.625
    expect(
      summarizeWeighting([
        { label: REPORTS, weight: 10 },
        { label: SCORE, weight: 6 },
      ]),
    ).toBe(
      `Your queue order is weighted toward ${REPORTS}, with some weight on ${SCORE}.`,
    );
  });

  test('orders by weight regardless of input order, and ignores zero-weight entries', () => {
    expect(
      summarizeWeighting([
        { label: SCORE, weight: 3 },
        { label: REPORTS, weight: 9 },
        { label: 'Disabled Property', weight: 0 },
      ]),
    ).toBe(
      `Your queue order is weighted heavily toward ${REPORTS}, with some weight on ${SCORE}.`,
    );
  });
});
