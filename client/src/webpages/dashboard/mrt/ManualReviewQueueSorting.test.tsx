import { fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ManualReviewCurrentJobsComponent from './manual_review_job/v2/user/ManualReviewJobCurrentJobsComponent';
import ManualReviewRecentDecisions from './ManualReviewRecentDecisions';

const queues = [
  { id: 'queue-zulu', name: 'Zulu' },
  { id: 'queue-alpha', name: 'Alpha' },
  { id: 'queue-mike', name: 'Mike' },
];

const recentDecisions = queues.map((queue, index) => ({
  __typename: 'ManualReviewDecision',
  id: `decision-${index}`,
  jobId: `job-${index}`,
  queueId: queue.id,
  reviewerId: null,
  itemId: `item-${index}`,
  itemTypeId: 'user',
  decisions: [{ __typename: 'IgnoreDecisionComponent', type: 'IGNORE' }],
  relatedActions: [],
  createdAt: `2026-08-${18 - index}T12:00:00.000Z`,
  decisionReason: null,
}));

const getRecentDecisions = vi.fn();

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLGetExistingJobsForItemQuery: () => ({
    loading: false,
    data: {
      getExistingJobsForItem: queues.map((queue, index) => ({
        queueId: queue.id,
        job: { createdAt: `2026-08-${18 - index}T12:00:00.000Z` },
      })),
      myOrg: { mrtQueues: queues },
    },
  }),
  useGQLOrgLookupDataQuery: () => ({
    data: {
      myOrg: { actions: [], policies: [], users: [], mrtQueues: queues },
    },
  }),
  useGQLGetDecidedJobFromJobIdQuery: () => ({ data: undefined }),
  useGQLGetRecentDecisionsLazyQuery: () => [
    getRecentDecisions,
    {
      loading: false,
      error: undefined,
      data: { getRecentDecisions: recentDecisions },
    },
  ],
  useGQLGetSkipsForRecentDecisionsLazyQuery: () => [vi.fn()],
  useGQLGetDecidedJobLazyQuery: () => [
    vi.fn(),
    { loading: false, error: undefined, data: undefined },
  ],
}));

vi.mock('./ManualReviewRecentDecisionsFilter', () => ({
  default: () => null,
}));

function queueNames() {
  const header = screen.getByRole('columnheader', { name: /Queue/ });
  const headers = screen.getAllByRole('columnheader');
  const queueColumnIndex = headers.indexOf(header);
  return within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map(
      (row) => within(row).getAllByRole('cell')[queueColumnIndex].textContent,
    );
}

function expectQueueSorting() {
  const queueHeader = screen.getByRole('columnheader', { name: /Queue/ });

  expect(queueNames()).toEqual(['Zulu', 'Alpha', 'Mike']);
  fireEvent.click(queueHeader);
  expect(queueNames()).toEqual(['Zulu', 'Mike', 'Alpha']);
  fireEvent.click(queueHeader);
  expect(queueNames()).toEqual(['Alpha', 'Mike', 'Zulu']);
}

describe('manual review queue sorting', () => {
  beforeEach(() => {
    localStorage.clear();
    getRecentDecisions.mockClear();
  });

  it('sorts current jobs by the rendered queue name', () => {
    render(
      <MemoryRouter>
        <ManualReviewCurrentJobsComponent
          userIdentifier={{ id: 'user-1', typeId: 'user' }}
        />
      </MemoryRouter>,
    );

    expectQueueSorting();
  });

  it('sorts recent decisions by the rendered queue name', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <ManualReviewRecentDecisions />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expectQueueSorting();
  });
});
