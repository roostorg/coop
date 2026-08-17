import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LookbackVersion } from '../RuleInsightsSamplesTable';
import RuleInsightsSampleDetailResults from './RuleInsightsSampleDetailResults';

const { fetchProactive, fetchReporting } = vi.hoisted(() => ({
  fetchProactive: vi.fn(),
  fetchReporting: vi.fn(),
}));

vi.mock('@/graphql/generated', async () => {
  const actual = await vi.importActual<typeof import('@/graphql/generated')>(
    '@/graphql/generated',
  );
  return {
    ...actual,
    useGQLGetFullResultForRuleLazyQuery: () => [
      fetchProactive,
      { loading: false },
    ],
    useGQLGetFullReportingResultForRuleLazyQuery: () => [
      fetchReporting,
      { loading: false },
    ],
    useGQLItemTypesQuery: () => ({ data: undefined }),
  };
});

describe('RuleInsightsSampleDetailResults', () => {
  beforeEach(() => {
    fetchProactive.mockReset();
    fetchReporting.mockReset();
  });

  it.each([
    [true, fetchReporting, fetchProactive],
    [false, fetchProactive, fetchReporting],
  ])(
    'uses the generated hook for reporting=%s',
    async (isReportingRule, expected, other) => {
      render(
        <RuleInsightsSampleDetailResults
          ruleId="rule-1"
          isReportingRule={isReportingRule}
          itemIdentifier={{ id: 'item-1', typeId: 'post' }}
          itemSubmissionDate="2026-08-09T12:34:56.000Z"
          lookback={LookbackVersion.LATEST}
        />,
      );

      await waitFor(() => expect(expected).toHaveBeenCalledOnce());
      expect(other).not.toHaveBeenCalled();
    },
  );

  it('ignores stale callbacks after selecting a different execution', async () => {
    const { rerender } = render(
      <RuleInsightsSampleDetailResults
        ruleId="rule-1"
        isReportingRule
        itemIdentifier={{ id: 'item-1', typeId: 'post' }}
        itemSubmissionDate="2026-08-09T12:34:56.000Z"
        lookback={LookbackVersion.LATEST}
      />,
    );
    await waitFor(() => expect(fetchReporting).toHaveBeenCalledOnce());
    const requestA = fetchReporting.mock.calls[0][0];

    rerender(
      <RuleInsightsSampleDetailResults
        ruleId="rule-1"
        isReportingRule
        itemIdentifier={{ id: 'item-2', typeId: 'comment' }}
        itemSubmissionDate="2026-08-10T12:34:56.000Z"
        lookback={LookbackVersion.PRIOR}
      />,
    );
    await waitFor(() => expect(fetchReporting).toHaveBeenCalledTimes(2));
    const requestB = fetchReporting.mock.calls[1][0];

    act(() => {
      requestB.onCompleted({
        getFullReportingRuleResultForItem: {
          __typename: 'ReportingRuleExecutionResult',
          result: {
            conjunction: 'AND',
            conditions: [],
            result: { outcome: 'PASSED' },
          },
        },
      });
    });
    expect(screen.getAllByText('Matched')).toHaveLength(2);

    act(() => {
      requestA.onCompleted({
        getFullReportingRuleResultForItem: {
          __typename: 'ReportingRuleExecutionResult',
          result: {
            conjunction: 'AND',
            conditions: [],
            result: { outcome: 'FAILED' },
          },
        },
      });
      requestA.onError(new Error('stale request failed'));
    });

    expect(screen.getAllByText('Matched')).toHaveLength(2);
    expect(screen.queryByText('Error: stale request failed')).toBeNull();
  });
});
