import {
  GQLRulePassRateAnalyticsDocument,
  type GQLRulePassRateAnalyticsQuery,
} from '@/graphql/generated';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, within } from '@testing-library/react';
import { vi } from 'vitest';

import RuleInsightsActionsChart from './RuleInsightsActionsChart';

describe('RuleInsightsActionsChart', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ['America/Los_Angeles', 420],
    ['UTC', 0],
    ['Asia/Tokyo', -540],
  ])('preserves calendar-day labels in %s', async (timezone, offset) => {
    vi.stubEnv('TZ', timezone);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 22, 12));
    expect(new Date().getTimezoneOffset()).toBe(offset);
    const measure = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('recharts-responsive-container')
          ? new DOMRect(0, 0, 900, 400)
          : measure.call(this);
      },
    );

    const mock: MockedResponse<GQLRulePassRateAnalyticsQuery> = {
      request: {
        query: GQLRulePassRateAnalyticsDocument,
        variables: { id: 'rule-1' },
      },
      result: {
        data: {
          __typename: 'Query',
          rule: {
            __typename: 'ContentRule',
            insights: {
              __typename: 'RuleInsights',
              passRateData: [
                {
                  __typename: 'RulePassRateData',
                  date: '2026-09-21',
                  totalMatches: 3,
                  totalRequests: 10,
                },
                {
                  __typename: 'RulePassRateData',
                  date: '2026-09-22T00:00:00.000Z',
                  totalMatches: 7,
                  totalRequests: 20,
                },
              ],
            },
          },
          allRuleInsights: null,
        },
      },
    };

    const { container } = render(
      <MockedProvider mocks={[mock]}>
        <RuleInsightsActionsChart ruleId="rule-1" />
      </MockedProvider>,
    );

    const chart = within(container);
    expect(await chart.findByText('09/22/26')).toBeInTheDocument();
    expect(chart.getByText('09/21/26')).toBeInTheDocument();
    expect(chart.queryByText('09/20/26')).not.toBeInTheDocument();
  });
});
