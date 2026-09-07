import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    const buttons = screen.getAllByRole('button', {
      name: /invalidate all reports/i,
    });
    expect(buttons).toHaveLength(2);
  });

  it('renders no invalidate buttons when the viewer lacks permission', () => {
    renderMerged(false);
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(
      screen.queryByRole('button', { name: /invalidate all reports/i }),
    ).not.toBeInTheDocument();
  });
});

const sortableReportHistory = [
  {
    reportId: 'sort_primary',
    reportedAt: '2026-03-01T12:00:00Z',
    policyId: null,
    reason: 'Primary',
    reporterId: null,
  },
  {
    reportId: 'sort_zeta',
    reportedAt: '2026-01-02T00:00:00Z',
    policyId: 'policy_zeta',
    reason: 'Bravo',
    reporterId: { id: 'charlie', typeId: 'user_type' },
  },
  {
    reportId: 'sort_beta',
    reportedAt: '2025-12-30T00:00:00Z',
    policyId: 'policy_beta',
    reason: 'Charlie',
    reporterId: { id: 'alpha', typeId: 'user_type' },
  },
  {
    reportId: 'sort_alpha',
    reportedAt: '2026-02-01T12:00:00Z',
    policyId: 'policy_alpha',
    reason: 'Alpha',
    reporterId: { id: 'bravo', typeId: 'user_type' },
  },
];

const sortingMocks = [
  {
    request: {
      query: GQLGetUserItemsDocument,
      variables: {
        itemIdentifiers: [
          { id: 'charlie', typeId: 'user_type' },
          { id: 'alpha', typeId: 'user_type' },
          { id: 'bravo', typeId: 'user_type' },
        ],
      },
    },
    result: { data: { latestItemSubmissions: [] } },
  },
  {
    request: { query: GQLPoliciesDocument },
    result: {
      data: {
        myOrg: {
          id: 'org',
          __typename: 'Org',
          policies: [
            { id: 'policy_zeta', name: 'Zeta Policy', __typename: 'Policy' },
            { id: 'policy_beta', name: 'Beta Policy', __typename: 'Policy' },
            { id: 'policy_alpha', name: 'Alpha Policy', __typename: 'Policy' },
          ],
        },
      },
    },
  },
];

function renderedReasons() {
  return within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[2].textContent);
}

describe('MergedReportsComponent sorting', () => {
  it.each([
    [
      'Reported By',
      ['Charlie', 'Alpha', 'Bravo'],
      ['Bravo', 'Alpha', 'Charlie'],
    ],
    [
      'Reported For',
      ['Alpha', 'Charlie', 'Bravo'],
      ['Bravo', 'Charlie', 'Alpha'],
    ],
    ['Reason', ['Alpha', 'Bravo', 'Charlie'], ['Charlie', 'Bravo', 'Alpha']],
    [
      'Report Time',
      ['Charlie', 'Bravo', 'Alpha'],
      ['Alpha', 'Bravo', 'Charlie'],
    ],
  ])(
    'sorts %s by visible semantics in ascending and descending order',
    async (header, ascending, descending) => {
      render(
        <MemoryRouter>
          <MockedProvider
            mocks={sortingMocks}
            defaultOptions={{ watchQuery: { fetchPolicy: 'no-cache' } }}
          >
            <MergedReportsComponent
              primaryReportId="sort_primary"
              reportHistory={sortableReportHistory}
            />
          </MockedProvider>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: /show/i }));
      await screen.findByText('Zeta Policy');

      const columnHeader = screen.getByRole('columnheader', { name: header });
      fireEvent.click(columnHeader);
      expect(renderedReasons()).toEqual(ascending);

      fireEvent.click(columnHeader);
      expect(renderedReasons()).toEqual(descending);
    },
  );
});
