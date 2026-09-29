import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import ReportingRuleInsightsActionsChart from './ReportingRuleInsightsActionsChart';
import RuleInsightsActionsChart from './RuleInsightsActionsChart';

vi.mock('@/graphql/generated', () => {
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
  const matches = [100, 2, 3, 100];
  return {
    useGQLReportingRulePassRateAnalyticsQuery: () => ({
      loading: false,
      data: {
        reportingRule: {
          insights: {
            passRateData: dates.map((date, i) => ({
              date,
              totalMatches: matches[i],
              totalRequests: 10,
            })),
          },
        },
      },
    }),
    useGQLRulePassRateAnalyticsQuery: () => ({
      loading: false,
      data: {
        rule: {
          insights: {
            passRateData: dates.map((date, i) => ({
              date: `${date}T00:00:00.000Z`,
              totalMatches: matches[i],
              totalRequests: 10,
            })),
          },
        },
        allRuleInsights: {
          totalSubmissionsByDay: [
            { date: new Date(2026, 8, 21), count: 100 },
            { date: new Date(2026, 8, 22), count: 8 },
            { date: new Date(2026, 8, 23), count: 12 },
            { date: new Date(2026, 8, 24), count: 100 },
          ],
        },
      },
    }),
  };
});

vi.mock('@/coop-ui/DateRangePicker', () => {
  function DateRangePicker(props: { onUpdate: (value: unknown) => void }) {
    return (
      <button
        onClick={() =>
          props.onUpdate({
            range: {
              from: new Date(2026, 8, 22),
              to: new Date(2026, 8, 23, 23, 59, 59),
            },
          })
        }
      >
        Select two days
      </button>
    );
  }
  return { DateRangePicker };
});

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: () => null,
}));

describe('rule insights daily charts', () => {
  it.each([
    ['reporting', ReportingRuleInsightsActionsChart],
    ['proactive', RuleInsightsActionsChart],
  ] as const)('includes both selected days for %s rules', (_, Chart) => {
    render(<Chart ruleId="rule-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Select two days' }));

    expect(screen.getByText('5')).toBeTruthy();
    if (Chart === RuleInsightsActionsChart) {
      expect(screen.getByText('25%')).toBeTruthy();
    }
  });
});
