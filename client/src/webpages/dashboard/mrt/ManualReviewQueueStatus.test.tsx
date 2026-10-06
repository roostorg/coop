import { fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ManualReviewAnalyticsDashboard from './ManualReviewAnalyticsDashboard';
import ManualReviewQueueStatus from './ManualReviewQueueStatus';

const mocks = vi.hoisted(() => ({ queues: vi.fn(), refetch: vi.fn() }));
vi.mock('../../../graphql/generated', () => ({
  useGQLManualReviewQueuesQuery: mocks.queues,
  useGQLManualReviewMetricsQuery: () => ({
    loading: false,
    data: {
      getTotalPendingJobsCount: 0,
      reportingInsights: { totalIngestedReportsByDay: [] },
    },
  }),
  useGQLGetAverageTimeToReviewQuery: () => ({
    loading: false,
    data: { getTimeToAction: [{ timeToAction: 0 }] },
  }),
  useGQLGetAverageHandleTimeSummaryQuery: () => ({
    loading: false,
    data: { getHandleTime: [{ handleTimeSeconds: 0 }] },
  }),
}));
vi.mock('@/coop-ui/DateRangePicker', () => ({
  DateRangePicker: () => <div>Date picker</div>,
}));
vi.mock('./visualization/ManualReviewCustomCharts', () => ({
  default: () => <div>Custom charts</div>,
}));
vi.mock('./visualization/ManualReviewDefaultCharts', () => ({
  default: () => <div>Historical charts</div>,
}));

const queue = {
  id: 'queue-a',
  name: 'Content reviews',
  pendingJobCount: 3,
  oldestJobCreatedAt: '2026-09-28T04:00:00.000Z',
  isAppealsQueue: false,
};
const result = (queues = [queue]) => ({
  loading: false,
  error: undefined,
  data: { me: { reviewableQueues: queues } },
  refetch: mocks.refetch,
});
const countTable = () =>
  within(screen.getByRole('table', { name: 'Pending jobs by queue' }));
const ageTable = () =>
  within(
    screen.getByRole('table', { name: 'Reported oldest pending age by queue' }),
  );

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.queues.mockReset();
  mocks.refetch.mockReset().mockResolvedValue({});
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-28T04:30:00.000Z'));
  mocks.queues.mockReturnValue(result());
});

describe('queue status', () => {
  it('shows counts and reported age with units and limitations', () => {
    render(<ManualReviewQueueStatus />);
    expect(countTable().getByText('3')).not.toBeNull();
    expect(ageTable().getByText('30')).not.toBeNull();
    expect(
      ageTable().getByRole('columnheader', { name: 'Minutes' }),
    ).not.toBeNull();
    expect(screen.getByText(/not guaranteed to be the oldest/)).not.toBeNull();
    expect(
      screen.getByText(/separate reads, not an atomic snapshot/),
    ).not.toBeNull();
    expect(mocks.queues).toHaveBeenCalledWith({
      fetchPolicy: 'no-cache',
      notifyOnNetworkStatusChange: true,
    });
  });

  it('keeps zero counts separate from unavailable ages', () => {
    mocks.queues.mockReturnValue(
      result([{ ...queue, pendingJobCount: 0, oldestJobCreatedAt: '' }]),
    );
    render(<ManualReviewQueueStatus />);
    expect(countTable().getByText('0')).not.toBeNull();
    expect(ageTable().getByText('Unavailable')).not.toBeNull();
  });

  it.each(['invalid-date', '2026-10-01T00:00:00.000Z'])(
    'rejects invalid or future timestamps: %s',
    (oldestJobCreatedAt) => {
      mocks.queues.mockReturnValue(result([{ ...queue, oldestJobCreatedAt }]));
      render(<ManualReviewQueueStatus />);
      expect(ageTable().getByText('Unavailable')).not.toBeNull();
    },
  );

  it('hides previous values while loading', () => {
    mocks.queues.mockReturnValue({ ...result(), loading: true });
    render(<ManualReviewQueueStatus />);
    expect(screen.getByRole('status').textContent).toContain(
      'Loading queue status',
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Refresh queue status' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('does not show stale values or healthy zeroes when the query fails', () => {
    mocks.queues.mockReturnValue({ ...result(), error: new Error('failed') });
    render(<ManualReviewQueueStatus />);
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('distinguishes no visible queues from an unavailable response', () => {
    mocks.queues.mockReturnValue(result([]));
    const { rerender } = render(<ManualReviewQueueStatus />);
    expect(
      screen.getByText('No review queues are available to you.'),
    ).not.toBeNull();
    mocks.queues.mockReturnValue({ ...result(), data: undefined });
    rerender(<ManualReviewQueueStatus />);
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
  });

  it('refreshes on request and displays the new snapshot', () => {
    const { rerender } = render(<ManualReviewQueueStatus />);
    expect(mocks.refetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh queue status' }),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    mocks.queues.mockReturnValue(
      result([
        { ...queue, name: 'Appeals', pendingJobCount: 2, isAppealsQueue: true },
      ]),
    );
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-28T04:40:00.000Z'));
    rerender(<ManualReviewQueueStatus />);
    expect(countTable().getByText('2')).not.toBeNull();
    expect(ageTable().getByText('40')).not.toBeNull();
    expect(ageTable().getByText('Appeals (Appeals)')).not.toBeNull();
  });

  it('handles a rejected refresh without an unhandled promise', async () => {
    mocks.refetch.mockRejectedValueOnce(new Error('network error'));
    const { rerender } = render(<ManualReviewQueueStatus />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh queue status' }),
    );
    await Promise.resolve();
    mocks.queues.mockReturnValue({
      ...result(),
      error: new Error('network error'),
    });
    rerender(<ManualReviewQueueStatus />);
    expect(screen.getByRole('alert')).not.toBeNull();
  });
});

it('loads queue data only on its Analytics tab and hides the historical date range', () => {
  render(
    <HelmetProvider>
      <ManualReviewAnalyticsDashboard />
    </HelmetProvider>,
  );
  expect(screen.getByText('Historical charts')).not.toBeNull();
  expect(mocks.queues).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Queue status' }));
  expect(
    screen.getByRole('table', { name: 'Pending jobs by queue' }),
  ).not.toBeNull();
  expect(screen.queryByText('Date picker')).toBeNull();
  const calls = mocks.queues.mock.calls.length;
  fireEvent.click(screen.getByRole('tab', { name: 'My Custom Dashboard' }));
  expect(screen.getByText('Custom charts')).not.toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByText('Date picker')).not.toBeNull();
  expect(mocks.queues).toHaveBeenCalledTimes(calls);
});
