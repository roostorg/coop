import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom/extend-expect';

import {
  GQLManageUsersDocument,
  GQLRolesForOrgDocument,
  GQLUserPermission,
  GQLUserRole,
} from '@/graphql/generated';

import ManageUsers from './ManageUsers';

const mocks: MockedResponse[] = [
  {
    request: { query: GQLManageUsersDocument },
    result: {
      data: {
        myOrg: {
          id: 'org-1',
          name: 'Test Org',
          hasNCMECReportingEnabled: false,
          users: [
            {
              id: 'user-1',
              firstName: 'Approved',
              lastName: 'User',
              email: 'approved@example.com',
              role: GQLUserRole.Admin,
              createdAt: '1723334400000',
              approvedByAdmin: true,
              rejectedByAdmin: false,
            },
          ],
          pendingInvites: [
            {
              id: 'invite-1',
              email: 'invited@example.com',
              role: GQLUserRole.Admin,
              createdAt: '2024-08-10T00:00:00.000Z',
            },
          ],
        },
        me: {
          id: 'user-1',
          email: 'approved@example.com',
          firstName: 'Approved',
          lastName: 'User',
          permissions: [GQLUserPermission.ManageUsers],
        },
      },
    },
  },
  {
    request: { query: GQLRolesForOrgDocument },
    result: { data: { rolesForOrg: [] } },
  },
];

function approvalStatuses() {
  return within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[3].textContent);
}

it('sorts approval statuses by their raw string values in both directions', async () => {
  render(
    <HelmetProvider>
      <MockedProvider mocks={mocks}>
        <MemoryRouter initialEntries={['/dashboard/settings/users?tab=users']}>
          <ManageUsers />
        </MemoryRouter>
      </MockedProvider>
    </HelmetProvider>,
  );

  await waitFor(() =>
    expect(screen.getByText('approved@example.com')).toBeInTheDocument(),
  );

  const approvalStatusHeader = screen.getByRole('columnheader', {
    name: /Approval Status/,
  });

  fireEvent.click(approvalStatusHeader);
  expect(approvalStatuses()).toEqual(['Pending Invite', 'Approved']);

  fireEvent.click(approvalStatusHeader);
  expect(approvalStatuses()).toEqual(['Approved', 'Pending Invite']);
});
