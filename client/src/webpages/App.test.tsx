import { MockedProvider } from '@apollo/client/testing';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GQLLoggedInUserForRouteDocument,
  GQLUserAndOrgDocument,
} from '../graphql/generated';
import App from './App';

vi.mock('./auth/Login', () => ({
  default: () => <h1>Login page</h1>,
}));

// Keep the browser router and auth gates real while isolating dashboard data.
vi.mock('./dashboard/Dashboard', async () => {
  const { Link, useLocation, useParams } = await import('react-router-dom');
  const { RequireAuth } = await import('../routing/auth');
  function Page() {
    const { pathname, search } = useLocation();
    const { id } = useParams();
    return (
      <>
        <h1>{pathname + search}</h1>
        <span>{id}</span>
        <Link to="/dashboard/actions">Actions</Link>
      </>
    );
  }
  return {
    DashboardRoutes: () => ({
      path: 'dashboard',
      children: ['', 'actions', 'rules/proactive/info/:id'].map((path) => ({
        path,
        element: (
          <RequireAuth>
            <Page />
          </RequireAuth>
        ),
      })),
    }),
  };
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function renderApp(path: string, loggedIn: boolean) {
  window.history.replaceState(null, '', path);
  const me = loggedIn
    ? { id: 'user-1', approvedByAdmin: true, rejectedByAdmin: false }
    : null;
  return render(
    <MockedProvider
      mocks={[GQLLoggedInUserForRouteDocument, GQLUserAndOrgDocument].map(
        (query) => ({
          request: { query },
          result: { data: { me } },
          maxUsageCount: Infinity,
        }),
      )}
      addTypename={false}
    >
      <App />
    </MockedProvider>,
  );
}

describe('application routing', () => {
  it('discovers dashboard deep links and supports subsequent navigation', async () => {
    renderApp('/dashboard/rules/proactive/info/rule-42?source=review', true);
    await screen.findByRole('heading', {
      name: '/dashboard/rules/proactive/info/rule-42?source=review',
    });
    expect(screen.getByText('rule-42')).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Actions' }));
    await screen.findByRole('heading', { name: '/dashboard/actions' });
    expect(window.location.pathname).toBe('/dashboard/actions');
  });

  it('redirects logged-out dashboard visitors to login', async () => {
    renderApp('/dashboard/actions', false);
    await screen.findByRole('heading', { name: 'Login page' });
    expect(window.location.pathname).toBe('/login');
  });

  it('redirects legacy links into dynamically discovered dashboard routes', async () => {
    renderApp('/actions', true);
    await screen.findByRole('heading', { name: '/dashboard/actions' });
    expect(window.location.pathname).toBe('/dashboard/actions');
  });

  it('redirects the root to login when logged out', async () => {
    renderApp('/', false);
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    await screen.findByRole('heading', { name: 'Login page' });
  });
});
