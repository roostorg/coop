import { gql } from '@apollo/client';
import React from 'react';
import { Navigate } from 'react-router-dom';

import FullScreenLoading from '../components/common/FullScreenLoading';

import { useGQLLoggedInUserForRouteQuery } from '../graphql/generated';

gql`
  query LoggedInUserForRoute {
    me {
      id
      approvedByAdmin
      rejectedByAdmin
    }
  }
`;

/**
 * Wrapper for all private routes (i.e. routes gated by user auth)
 */
export function RequireAuth(props: { children: React.ReactElement }) {
  const { loading, error, data } = useGQLLoggedInUserForRouteQuery();

  if (error || (data != null && data.me == null)) {
    return <Navigate to="/login" />;
  }
  const user = data?.me;
  if (loading || user == null) {
    return <FullScreenLoading />;
  }

  if (user != null && Boolean(user.rejectedByAdmin)) {
    return <Navigate to="/rejected" />;
  }

  if (user != null && !user.approvedByAdmin) {
    return <Navigate to="/awaiting_approval" />;
  }

  return props.children;
}

/**
 * Wrapper for all public-only routes
 * (i.e. routes only accessible to logged out users)
 */
export function RequireLoggedOut(props: { children: React.ReactElement }) {
  const { loading, error, data } = useGQLLoggedInUserForRouteQuery();

  if (error) {
    return <Navigate to="/login" />;
  }
  if (loading) {
    return <FullScreenLoading />;
  }
  if (data != null && data.me != null) {
    // User is logged in. Redirect to Dashboard
    return <Navigate to="/dashboard" />;
  }
  const isLoggedOut = data != null && data.me == null;
  return isLoggedOut ? props.children : <FullScreenLoading />;
}
