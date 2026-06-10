import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLGetUserItemsDocument,
  GQLPoliciesDocument,
} from '@/graphql/generated';

import MergedReportsComponent from './MergedReportsComponent';

// Regression: previously only the latest reporter was actionable; any
// reporter in the merged table had no invalidate button.

const reporterA = {
  id: 'reporter_a',
  typeId: 'user_type',
  __typename: 'ItemIdentifier',
};
const reporterB = {
  id: 'reporter_b',
  typeId: 'user_type',
  __typename: 'ItemIdentifier',
};

const reportHistory = [
  {
    reportId: 'r_primary',
    reportedAt: new Date('2026-05-27T10:00:00Z'),
    policyId: null,
    reason: null,
    reporterId: reporterA,
  },
  {
    reportId: 'r_other_1',
    reportedAt: new Date('2026-05-27T09:00:00Z'),
    policyId: null,
    reason: null,
    reporterId: reporterB,
  },
  {
    reportId: 'r_other_2',
    reportedAt: new Date('2026-05-27T08:00:00Z'),
    policyId: null,
    reason: null,
    reporterId: reporterA,
  },
];

// Minimal stubs; component degrades gracefully when these resolve empty.
const baseMocks = [
  {
    request: {
      query: GQLGetUserItemsDocument,
      variables: {
        itemIdentifiers: [
          { id: reporterB.id, typeId: reporterB.typeId },
          { id: reporterA.id, typeId: reporterA.typeId },
        ],
      },
    },
    result: { data: { latestItemSubmissions: [] } },
  },
  {
    request: { query: GQLPoliciesDocument },
    result: { data: { myOrg: { id: 'org', policies: [], __typename: 'Org' } } },
  },
];

function renderMerged(canInvalidateReports: boolean) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={baseMocks}>
        <MergedReportsComponent
          primaryReportId="r_primary"
          reportHistory={reportHistory}
          canInvalidateReports={canInvalidateReports}
        />
      </MockedProvider>
    </MemoryRouter>,
  );
}

describe('MergedReportsComponent invalidation actions', () => {
  it('renders an invalidate button on every non-primary report row when the viewer has permission', () => {
    renderMerged(true);
    // Expand the table; collapsed by default.
    screen.getByRole('button', { name: /show/i }).click();
    const buttons = screen.getAllByRole('button', {
      name: /invalidate reports/i,
    });
    expect(buttons).toHaveLength(2);
  });

  it('renders no invalidate buttons when the viewer lacks permission', () => {
    renderMerged(false);
    screen.getByRole('button', { name: /show/i }).click();
    expect(
      screen.queryByRole('button', { name: /invalidate reports/i }),
    ).not.toBeInTheDocument();
  });
});
