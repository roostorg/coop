/* eslint-disable react/jsx-key */
import React, { Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';

import FullScreenLoading from '@/components/common/FullScreenLoading';
import ErrorBoundary from '@/components/ErrorBoundary';
import LegacyCSSProvider from '@/components/LegacyCSSProvider';

import { useGQLUserAndOrgQuery } from '../graphql/generated';
import { RequireAuth, RequireLoggedOut } from '../routing/auth';
import AwaitingApproval from './auth/AwaitingApproval';
import RejectedByAdmin from './auth/RejectedByAdmin';
import './dashboard/Dashboard.css';

function lazyLoad(path: string) {
  // we must do this interpolation here for lazy loading to work properly for
  // some reason. See https://stackoverflow.com/a/73359606
  return React.lazy(async () => import(`${path}`));
}

const Login = lazyLoad('./auth/Login');
const ForgotPassword = lazyLoad('./auth/forgot_password/ForgotPassword');
const ResetPassword = lazyLoad('./auth/forgot_password/ResetPassword');
const SignUp = lazyLoad('./auth/SignUp');
const LoginSSO = lazyLoad('./auth/LoginSSO');
/**
 * This is the container for the React app. All React
 * components that render an entire webpage should be
 * listed here, along with their URL paths.
 *
 * Important: For any webpage that should only be visible to authenticated
 * users, they should be wrapped in a <RequireAuth /> instead of
 * a normal <Route />.
 *
 * Similarly, if any screens should only be visible to logged out users,
 * they should be wrapped in a <RequireLoggedOut /> tag.
 */

function RootRedirect() {
  const { loading, data } = useGQLUserAndOrgQuery();
  
  if (loading) {
    return <FullScreenLoading />;
  }
  
  // If user is logged in, redirect to dashboard, otherwise to login
  if (data?.me) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/login" replace />;
}

export default function App() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <AppWrapper />,
        children: [
          {
            path: '',
            element: <RootRedirect />,
          },
          {
            path: 'login',
            element: (
              <RequireLoggedOut>
                <Login />
              </RequireLoggedOut>
            ),
          },
          {
            path: 'login/saml/callback',
            // This endpoint should only be accessed with POST requests during SAML
            // authentication. So if a user tries navigating to it in the browser, we
            // just redirect them to login.
            element: <Navigate replace to="/login" />,
          },
          {
            path: 'login/sso',
            element: (
              <RequireLoggedOut>
                <LoginSSO />
              </RequireLoggedOut>
            ),
          },
          {
            path: 'forgot_password',
            element: (
              <RequireLoggedOut>
                <ForgotPassword />
              </RequireLoggedOut>
            ),
          },
          {
            path: 'reset_password/:token?',
            element: (
              <RequireLoggedOut>
                <ResetPassword />
              </RequireLoggedOut>
            ),
          },
          {
            path: 'signup/:token',
            element: (
              <RequireLoggedOut>
                <SignUp />
              </RequireLoggedOut>
            ),
          },
          {
            path: 'awaiting_approval',
            element: (
              <RequireAuth>
                <AwaitingApproval />
              </RequireAuth>
            ),
          },
          {
            path: 'rejected',
            element: (
              <RequireAuth>
                <RejectedByAdmin />
              </RequireAuth>
            ),
          },
          // Redirects
          {
            path: 'rules',
            element: <Navigate replace to="/dashboard/rules" />,
          },
          {
            path: 'actions',
            element: <Navigate replace to="/dashboard/actions" />,
          },
          {
            path: 'items_types',
            element: <Navigate replace to="/dashboard/item_types" />,
          },
          {
            path: 'content_types',
            element: <Navigate replace to="/dashboard/item_types" />,
          },
          {
            path: 'settings',
            element: <Navigate replace to="/dashboard/settings" />,
          },
        ],
      },
    ],
    {
      async patchRoutesOnNavigation({ path, patch }) {
        if (path.startsWith('/dashboard')) {
          const { DashboardRoutes } = await import('./dashboard/Dashboard');
          patch(null, [DashboardRoutes()]);
        }
      },
    },
  );

  return (
    <div className="bg-[#F9F9F9] flex flex-col w-full h-full bottom-0 relative">
      <RouterProvider router={router} />
    </div>
  );
}

function AppWrapper() {
  const loadingFallback = <FullScreenLoading />;
  return (
    <LegacyCSSProvider>
      <Suspense fallback={loadingFallback}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Suspense>
    </LegacyCSSProvider>
  );
}
