import { TooltipProvider } from '@/coop-ui/Tooltip';
import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import ManualReviewQueuesDashboard from './ManualReviewQueuesDashboard';

let reviewableQueues: {
  id: string;
  name: string;
  description: string | null;
  pendingJobCount: number;
  oldestJobCreatedAt: string | null;
  isDefaultQueue: boolean;
  isAppealsQueue: boolean;
}[] = [];

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLManualReviewQueuesQuery: () => ({
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    data: {
      myOrg: { hasAppealsEnabled: true, previewJobsViewEnabled: false },
      me: {
        id: 'user-1',
        permissions: [],
        favoriteMRTQueues: [],
        reviewableQueues,
      },
    },
  }),
  useGQLGetResolvedJobsForUserQuery: () => ({ data: undefined }),
  useGQLGetSkippedJobsForUserQuery: () => ({ data: undefined }),
  useGQLRoutingRulesQuery: () => ({ data: undefined }),
  useGQLAddFavoriteMrtQueueMutation: () => [vi.fn()],
  useGQLRemoveFavoriteMrtQueueMutation: () => [vi.fn()],
  useGQLDeleteManualReviewQueueMutation: () => [vi.fn()],
  useGQLDeleteAllJobsFromQueueMutation: () => [vi.fn()],
}));

function appealsQueue(pendingJobCount: number) {
  return {
    id: 'appeals-queue',
    name: 'Appeals Queue',
    description: null,
    pendingJobCount,
    oldestJobCreatedAt: null,
    isDefaultQueue: false,
    isAppealsQueue: true,
  };
}

function reportsQueue(pendingJobCount: number) {
  return {
    ...appealsQueue(pendingJobCount),
    id: 'reports-queue',
    name: 'Reports Queue',
    isAppealsQueue: false,
  };
}

function renderDashboard() {
  render(
    <HelmetProvider>
      <TooltipProvider>
        <MemoryRouter>
          <ManualReviewQueuesDashboard />
        </MemoryRouter>
      </TooltipProvider>
    </HelmetProvider>,
  );
}

describe('ManualReviewQueuesDashboard appeals tab indicator', () => {
  it('shows a dot on the Appeals tab when an appeals queue has pending jobs', () => {
    reviewableQueues = [appealsQueue(3)];
    renderDashboard();
    const appealsTab = screen.getByRole('tab', { name: /Appeals$/ });
    expect(
      within(appealsTab).getByRole('img', { name: 'Pending appeals' }),
    ).toBeInTheDocument();
  });

  it('hides the dot when only non-appeals queues have pending jobs', () => {
    reviewableQueues = [appealsQueue(0), reportsQueue(5)];
    renderDashboard();
    expect(screen.getByRole('tab', { name: 'Appeals' })).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Pending appeals' }),
    ).not.toBeInTheDocument();
  });
});
