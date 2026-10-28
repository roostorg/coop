import { MockedProvider } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';

import {
  GQLCoopUpdateAvailableDocument as CoopUpdateAvailableDocument,
  GQLUserPermission,
} from '../graphql/generated';
import CoopUpdateBanner from './CoopUpdateBanner';

it('shows admins the persistent release link when an update is available', async () => {
  render(
    <MockedProvider
      mocks={[
        {
          request: { query: CoopUpdateAvailableDocument },
          result: { data: { coopUpdateAvailable: true } },
        },
      ]}
    >
      <CoopUpdateBanner permissions={[GQLUserPermission.ManageOrg]} />
    </MockedProvider>,
  );
  const status = screen.getByRole('status');
  expect(status).toBeEmptyDOMElement();
  await waitFor(() =>
    expect(status).toHaveTextContent('A new version of Coop is available.'),
  );
  expect(screen.getByRole('status')).toBe(status);
  expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
    'href',
    'https://github.com/roostorg/coop/releases',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it.each(['up to date', 'unavailable'])(
  'does not render when %s',
  async (state) => {
    let responded = false;
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: CoopUpdateAvailableDocument },
            result: () => {
              responded = true;
              return state === 'up to date'
                ? { data: { coopUpdateAvailable: false } }
                : { errors: [new GraphQLError('unavailable')] };
            },
          },
        ]}
      >
        <CoopUpdateBanner permissions={[GQLUserPermission.ManageOrg]} />
      </MockedProvider>,
    );
    await waitFor(() => expect(responded).toBe(true));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  },
);

it('hides an available update after admin permission is removed', async () => {
  const { rerender } = render(
    <MockedProvider
      mocks={[
        {
          request: { query: CoopUpdateAvailableDocument },
          result: { data: { coopUpdateAvailable: true } },
        },
      ]}
    >
      <CoopUpdateBanner permissions={[GQLUserPermission.ManageOrg]} />
    </MockedProvider>,
  );
  await screen.findByRole('link', { name: 'Learn more' });
  rerender(
    <MockedProvider>
      <CoopUpdateBanner permissions={[GQLUserPermission.ViewMrt]} />
    </MockedProvider>,
  );
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
