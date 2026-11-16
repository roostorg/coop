import { TooltipProvider } from '@/coop-ui/Tooltip';
import {
  GQLQueueFormDataDocument,
  GQLUserPermission,
} from '@/graphql/generated';
import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';

import ManualReviewQueueForm from './ManualReviewQueueForm';

it('prevents assigning roles with automatic queue access without disabling other roles', async () => {
  render(
    <HelmetProvider>
      <TooltipProvider>
        <MockedProvider
          mocks={[
            {
              request: { query: GQLQueueFormDataDocument },
              result: {
                data: {
                  rolesForOrg: [
                    {
                      id: 'manager-role',
                      displayName: 'Renamed queue manager',
                      permissions: [GQLUserPermission.EditMrtQueues],
                    },
                    {
                      id: 'reviewer-role',
                      displayName: 'Admin',
                      permissions: [GQLUserPermission.ViewMrt],
                    },
                  ],
                  myOrg: {
                    hasAppealsEnabled: false,
                    hasPartialItemsEndpoint: false,
                    users: [],
                    actions: [],
                    usersWhoCanReviewEveryQueue: [],
                  },
                },
              },
            },
          ]}
        >
          <MemoryRouter>
            <ManualReviewQueueForm />
          </MemoryRouter>
        </MockedProvider>
      </TooltipProvider>
    </HelmetProvider>,
  );

  await screen.findByText('Manage Access');
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);

  fireEvent.click(await screen.findByText('Renamed queue manager'));
  expect(screen.getAllByText('Renamed queue manager')).toHaveLength(1);

  fireEvent.click(screen.getByText('Admin'));
  expect(screen.getAllByText('Admin')).toHaveLength(2);
});
