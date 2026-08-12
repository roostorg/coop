import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import ManualReviewDefaultCharts from './ManualReviewDefaultCharts';

vi.mock('../ManualReviewDecisionsTable', () => ({
  default: () => null,
}));

vi.mock('./ManualReviewDashboardInsightsCard', () => ({
  default: () => null,
}));

vi.mock('./ManualReviewDashboardInsightsChart', () => {
  function MockInsightsChart({
    title,
    metric,
    initialGroupBy,
  }: {
    title: string;
    metric: string;
    initialGroupBy: string[];
  }) {
    return (
      <div
        data-testid={`insights-chart-${title}`}
        data-metric={metric}
        data-initial-group-by={JSON.stringify(initialGroupBy)}
      />
    );
  }

  return { default: MockInsightsChart };
});

vi.mock('./TimeToActionChart', () => ({
  default: () => null,
}));

it('groups the Skipped Jobs By Queue chart by queue', () => {
  render(
    <ManualReviewDefaultCharts
      timeWindow={{
        start: new Date('2026-08-11T00:00:00.000Z'),
        end: new Date('2026-08-12T00:00:00.000Z'),
      }}
      loading={false}
      totalIngestedReportsInWindow={0}
      totalIngestedReportsInPreviousWindow={0}
      averageTimeToReviewInWindow={0}
      averageTimeToReviewInPreviousWindow={0}
      currentlyOpenJobs={0}
    />,
  );

  const chart = screen.getByTestId('insights-chart-Skipped Jobs By Queue');
  expect(chart.getAttribute('data-metric')).toBe('SKIPPED_JOBS');
  expect(chart.getAttribute('data-initial-group-by')).toBe('["QUEUE_ID"]');
});
