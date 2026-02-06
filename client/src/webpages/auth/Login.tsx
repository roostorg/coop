import { Checkbox } from '@/coop-ui/Checkbox';
import { Label } from '@/coop-ui/Label';
import { gql } from '@apollo/client';
import { Input } from 'antd';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';

import CoopButton from '../dashboard/components/CoopButton';
import CoopModal from '../dashboard/components/CoopModal';

import { namedOperations, useGQLLoginMutation } from '../../graphql/generated';
import LogoBlack from '../../images/LogoBlack.png';

gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      ... on LoginSuccessResponse {
        user {
          id
          email
        }
      }
      ... on LoginUserDoesNotExistError {
        title
        status
      }
      ... on LoginIncorrectPasswordError {
        title
        status
      }
      ... on LoginSsoRequiredError {
        title
        status
      }
    }
  }
`;

/**
 * Login form component
 */
export default function Login() {
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [remember, setRemember] = useState(false);

  const navigate = useNavigate();

  const [login, { client, loading }] = useGQLLoginMutation({
    onError: (e) => {
      if (e.graphQLErrors[0].extensions.name === 'LoginSsoRequiredError') {
        setErrorMessage(
          `Your Organization requires login via Single Sign-On.
          Please use the Single Sign-On button below to log in`,
        );
      } else {
        setErrorMessage(
          'We encountered an issue trying to process your request. Please try again.',
        );
      }
    },
    onCompleted: (response) => {
      switch (response.login.__typename) {
        case 'LoginSuccessResponse':
          client.resetStore().then(() => navigate('/dashboard'));
          break;
        case 'LoginIncorrectPasswordError':
        case 'LoginUserDoesNotExistError':
          setErrorMessage('Invalid email or password.');
          break;
        default:
          setErrorMessage(
            'We encountered an issue trying to process your request. Please try again.',
          );
      }
    },
    refetchQueries: [namedOperations.Query.PermissionGatedRouteLoggedInUser],
  });

  const errorModal = (
    <CoopModal
      title="Something went wrong"
      visible={errorMessage != null}
      onClose={() => setErrorMessage(undefined)}
    >
      {errorMessage}
    </CoopModal>
  );

  const onLogin = async () => {
    login({
      variables: {
        input: {
          email: email!,
          password: password!,
          remember,
        },
      },
      refetchQueries: [namedOperations.Query.PermissionGatedRouteLoggedInUser],
    });
  };

  const emailInput = (
    <div className="flex flex-col mb-4">
      <div className="mb-1">Email</div>
      <Input
        className="w-full rounded-lg"
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  );

  const passwordInput = (
    <div className="flex flex-col mb-4">
      <div className="mb-1">Password</div>
      <Input.Password
        className="w-full rounded-lg"
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onLogin();
          }
        }}
      />
    </div>
  );

  const rememberMeCheckbox = (
    <div className="flex items-center space-x-2">
      <Checkbox
        id="remember-me"
        defaultChecked={true}
        onCheckedChange={setRemember}
      />
      <Label htmlFor="remember-me">Keep me signed in</Label>
    </div>
  );

  const forgotPasswordButton = (
    <Link
      className="flex justify-start font-semibold text-primary hover:text-primary/70"
      to={'/forgot_password'}
    >
      Forgot Password?
    </Link>
  );

  return (
    <div className="flex flex-col h-screen p-8 mb-0 bg-slate-100">
      <Helmet>
        <title>Login</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex flex-col items-stretch justify-center border-none sm:border sm:border-solid border-slate-200 rounded-xl shadow-none sm:shadow h-full w-full sm:h-[560px] sm:w-[460px] m-0 p-0 sm:m-9 sm:px-12">
          <Link to="/" className="flex items-center justify-center w-full my-2">
            <img src={LogoBlack} alt="Coop Logo" className="h-12" />
          </Link>
          <div className="py-5 text-2xl font-bold">
            Sign in to your Coop account
          </div>
          {emailInput}
          {passwordInput}
          <div className="flex items-center justify-between mb-6">
            {rememberMeCheckbox}
            {forgotPasswordButton}
          </div>
          <div className="w-full">
            <CoopButton
              onClick={onLogin}
              title="Sign In"
              loading={loading}
              disabled={!email || !password}
            />
          </div>
          <Link
            className="flex justify-start my-4 font-semibold text-primary hover:text-primary/70"
            to={'/login/sso'}
          >
            Using Single Sign-On?
          </Link>
          {errorModal}
        </div>
      </div>
    </div>
  );
}
