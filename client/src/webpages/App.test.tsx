import { GQLLoggedInUserForRouteDocument } from '@/graphql/generated';
import { MockedProvider } from '@apollo/client/testing';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';

import App from './App';

function renderLoggedOut(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <HelmetProvider>
      <MockedProvider
        mocks={[
          {
            request: { query: GQLLoggedInUserForRouteDocument },
            result: { data: { me: null } },
            maxUsageCount: Infinity,
          },
        ]}
      >
        <App />
      </MockedProvider>
    </HelmetProvider>,
  );
}

describe('App routing', () => {
  it('supports links and browser back/forward between lazy public pages', async () => {
    renderLoggedOut('/login');
    fireEvent.click(
      await screen.findByRole('link', { name: 'Forgot Password?' }),
    );

    expect(
      await screen.findByText('Forgot your password?'),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/forgot_password');

    act(() => window.history.back());
    expect(
      await screen.findByText('Sign in to your Coop account'),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');

    act(() => window.history.forward());
    expect(
      await screen.findByText('Forgot your password?'),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/forgot_password');
  });

  it.each(['/dashboard/settings?tab=users', '/settings'])(
    'discovers protected dashboard routes and redirects a logged-out visit to %s',
    async (path) => {
      renderLoggedOut(path);

      await waitFor(() => expect(window.location.pathname).toBe('/login'), {
        timeout: 10000,
      });
      expect(
        await screen.findByText('Sign in to your Coop account'),
      ).toBeInTheDocument();
    },
    15000,
  );
});
