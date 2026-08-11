import {
  GQLManualReviewDecisionType,
  type GQLManualReviewDecision,
} from '@/graphql/generated';
import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import ManualReviewRecentDecisionSummary from './ManualReviewRecentDecisionSummary';

vi.mock('@/graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/graphql/generated')>()),
  useGQLRecentDecisionsSummaryDataQuery: () => ({
    loading: false,
    data: {
      myOrg: {
        users: [],
        mrtQueues: [],
        actions: [],
        policies: [],
        itemTypes: [],
      },
    },
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

it('renders populated decision lists without a missing-key warning', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const selectedDecision = {
    __typename: 'ManualReviewDecision',
    id: 'decision-1',
    jobId: 'job-1',
    createdAt: '2026-08-11T12:00:00.000Z',
    reviewerId: null,
    queueId: 'queue-1',
    decisionReason: null,
    decisions: [
      {
        __typename: 'IgnoreDecisionComponent',
        type: GQLManualReviewDecisionType.Ignore,
      },
    ],
    relatedActions: [
      {
        __typename: 'AcceptAppealDecisionComponent',
        actionIds: [],
        appealId: 'appeal-1',
        type: GQLManualReviewDecisionType.AcceptAppeal,
      },
    ],
  } as GQLManualReviewDecision;

  render(
    <ManualReviewRecentDecisionSummary
      selectedDecision={selectedDecision}
      showCloseButton={false}
    />,
  );

  const missingKeyWarnings = consoleError.mock.calls.filter((call) => {
    const warning = call.join(' ');
    return (
      warning.includes(
        'Each child in a list should have a unique "key" prop',
      ) && warning.includes('ManualReviewRecentDecisionSummary')
    );
  });
  expect(missingKeyWarnings).toEqual([]);
});
