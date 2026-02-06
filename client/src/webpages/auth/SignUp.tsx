import { gql } from '@apollo/client';
import { Input } from 'antd';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';
import CoopButton from '../dashboard/components/CoopButton';

import {
  namedOperations,
  useGQLInviteUserTokenQuery,
  useGQLSignUpMutation,
} from '../../graphql/generated';
import LogoBlack from '../../images/LogoBlack.png';

gql`
  query InviteUserToken($token: String!) {
    inviteUserToken(token: $token) {
      ... on InviteUserTokenSuccessResponse {
        tokenData {
          token
          email
          role
          orgId
          samlEnabled
        }
      }
      ... on InviteUserTokenExpiredError {
        title
      }
      ... on InviteUserTokenMissingError {
        title
      }
    }
  }

  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      ... on SignUpSuccessResponse {
        data {
          id
          loginMethods
        }
      }
      ... on SignUpUserExistsError {
        title
      }
    }
  }
`;

/**
 * Sign Up form component - Token-only version
 */
export default function SignUp() {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [lastName, setLastName] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  // Fetch token data
  const {
    data: tokenData,
    loading: tokenLoading,
    error: tokenError,
  } = useGQLInviteUserTokenQuery({
    variables: { token: token ?? '' },
    skip: !token,
  });

  const [signUp, { loading: signUpLoading }] = useGQLSignUpMutation({
    refetchQueries: [namedOperations.Query.LoggedInUserForRoute],
    onCompleted: (data) => {
      if (data.signUp.__typename === 'SignUpSuccessResponse') {
        navigate('/dashboard');
      } else if (data.signUp.__typename === 'SignUpUserExistsError') {
        setErrorMessage(
          'An account with this email already exists. Please log in instead.',
        );
      }
    },
    onError: (error) => {
      setErrorMessage(error.message ?? 'An error occurred during sign up.');
    },
  });

  const tokenInfo =
    tokenData?.inviteUserToken?.__typename === 'InviteUserTokenSuccessResponse'
      ? tokenData.inviteUserToken.tokenData
      : null;

  const tokenErrorMessage =
    tokenData?.inviteUserToken?.__typename === 'InviteUserTokenExpiredError' ||
    tokenData?.inviteUserToken?.__typename === 'InviteUserTokenMissingError'
      ? tokenData.inviteUserToken.title
      : null;

  useEffect(() => {
    if (!token) {
      setErrorMessage('No invitation token provided.');
    }
  }, [token]);

  const onSignUp = async () => {
    if (!tokenInfo) {
      setErrorMessage('Invalid or expired invitation token.');
      return;
    }

    if (!firstName || !lastName) {
      setErrorMessage('Please enter your first and last name.');
      return;
    }

    if (tokenInfo.samlEnabled) {
      // SAML-enabled signup
      await signUp({
        variables: {
          input: {
            email: tokenInfo.email,
            firstName,
            lastName,
            role: tokenInfo.role,
            orgId: tokenInfo.orgId,
            inviteUserToken: token!,
            loginMethod: 'SAML',
          },
        },
      });
    } else {
      // Password-based signup
      if (!password || password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }

      await signUp({
        variables: {
          input: {
            email: tokenInfo.email,
            password,
            firstName,
            lastName,
            role: tokenInfo.role,
            orgId: tokenInfo.orgId,
            inviteUserToken: token!,
            loginMethod: 'PASSWORD',
          },
        },
      });
    }
  };

  if (tokenLoading) {
    return <FullScreenLoading />;
  }

  if (tokenError || tokenErrorMessage || !token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Helmet>
          <title>Invalid Invitation | Coop</title>
        </Helmet>
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
          <div className="flex justify-center mb-6">
            <img src={LogoBlack} alt="Coop Logo" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold text-center text-red-600 mb-4">
            Invalid or Expired Invitation
          </h1>
          <p className="text-center text-gray-600 mb-6">
            {tokenErrorMessage ??
              'This invitation link is invalid or has expired. Please contact your administrator for a new invitation.'}
          </p>
          <div className="flex justify-center">
            <Link to="/login">
              <CoopButton title="Go to Login" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenInfo) {
    return <FullScreenLoading />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Helmet>
        <title>Sign Up | Coop</title>
      </Helmet>
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <img src={LogoBlack} alt="Coop Logo" className="h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">
          Complete Your Account
        </h1>
        <p className="text-center text-gray-600 mb-6">
          You've been invited to join as{' '}
          <span className="font-semibold">{tokenInfo.email}</span>
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              size="large"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              size="large"
            />
          </div>

          {!tokenInfo.samlEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input.Password
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="large"
              />
            </div>
          )}

          <div className="w-full">
            <CoopButton
              title={tokenInfo.samlEnabled ? 'Create Account' : 'Sign Up'}
              onClick={onSignUp}
              loading={signUpLoading}
              disabled={
                !firstName ||
                !lastName ||
                (!tokenInfo.samlEnabled && (!password || password.length < 8))
              }
              size="large"
            />
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

