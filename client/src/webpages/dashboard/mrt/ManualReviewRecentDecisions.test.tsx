import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import ManualReviewRecentDecisions from './ManualReviewRecentDecisions';

vi.mock('@/graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/graphql/generated')>()),
  useGQLOrgLookupDataQuery: () => ({
    data: {
      myOrg: { actions: [], policies: [], users: [], mrtQueues: [] },
    },
  }),
  useGQLGetDecidedJobFromJobIdQuery: () => ({ data: undefined }),
  useGQLGetRecentDecisionsLazyQuery: () => [
    vi.fn(),
    {
      loading: false,
      error: undefined,
      data: { getRecentDecisions: [] },
    },
  ],
  useGQLGetSkipsForRecentDecisionsLazyQuery: () => [vi.fn()],
  useGQLGetDecidedJobLazyQuery: () => [
    vi.fn(),
    { loading: false, error: undefined, data: undefined },
  ],
}));

vi.mock('../components/table/Table', () => ({
  default: ({ topLeftComponent }: { topLeftComponent?: ReactNode }) => (
    <>{topLeftComponent}</>
  ),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

test('names the user-search textbox', () => {
  render(
    <MemoryRouter>
      <ManualReviewRecentDecisions />
    </MemoryRouter>,
  );

  expect(
    screen
      .getByPlaceholderText("Input a user's ID or username")
      .getAttribute('name'),
  ).toBe('recent-decisions-user-search');
});
