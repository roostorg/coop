import { Checkbox } from '@/coop-ui/Checkbox';
import { Label } from '@/coop-ui/Label';
import { toast } from '@/coop-ui/Toast';
import { useGQLGetSsoRedirectUrlLazyQuery } from '@/graphql/generated';
import { gql } from '@apollo/client';
import { Input } from 'antd';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import CoopButton from '../dashboard/components/CoopButton';
import CoopModal from '../dashboard/components/CoopModal';

import LogoBlack from '../../images/LogoBlack.png';
import { redirectToSsoUrl } from './ssoRedirect';

gql`
  query GetSSORedirectUrl($emailAddress: String!) {
    getSSORedirectUrl(emailAddress: $emailAddress) {
      url
      method
    }
  }
`;

/**
 * Login form component
 */
export default function LoginSSO() {
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [remember, setRemember] = useState(true);
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  const [getSSORedirectUrl, { loading }] = useGQLGetSsoRedirectUrlLazyQuery();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    if (error === 'access_denied') {
      toast.error('SSO login was cancelled. Please try again.');
    } else if (error) {
      const detail = errorDescription ? `: ${errorDescription}` : '';
      toast.error(
        `SSO login failed${detail}. Please try again or contact your administrator.`,
      );
    }
  }, []);
  const errorModal = (
    <CoopModal
      title={'SSO Unavailable'}
      visible={errorModalVisible}
      onClose={() => setErrorModalVisible(false)}
      footer={[
        {
          title: 'Return to login',
          onClick: () => {
            window.location.href = '/login';
          },
        },
      ]}
    >
      {'SSO is not enabled for your organization. Please try to login again.'}
    </CoopModal>
  );

  return (
    <div className="flex flex-col h-screen p-8 mb-0 bg-slate-100">
      <Helmet>
        <title>Login</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex flex-col items-start justify-center border-none sm:border sm:border-solid border-slate-200 rounded-xl shadow-none sm:shadow h-full w-full sm:h-[560px] sm:w-[460px] m-0 p-0 sm:m-9 sm:px-12 gap-2">
          <Link to="/" className="flex items-center justify-center w-full my-2">
            <img src={LogoBlack} alt="Coop Logo" className="h-12" />
          </Link>
          <div className="py-5 text-2xl font-bold">
            Sign in to your Coop account
          </div>
          <>
            <div className="font-semibold">Email</div>
            <Input onChange={(e) => setEmail(e.target.value)} />
          </>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-me"
              defaultChecked
              checked={remember}
              onCheckedChange={setRemember}
            />
            <div className="my-4">
              <Label htmlFor="remember-me">Keep me signed in</Label>
            </div>
          </div>
          <CoopButton
            title="Next"
            disabled={!email?.length}
            loading={loading}
            onClick={() => {
              getSSORedirectUrl({
                variables: { emailAddress: email! },
                onCompleted: (data) => {
                  const redirectInfo = data.getSSORedirectUrl;
                  if (redirectInfo) {
                    redirectToSsoUrl(
                      redirectInfo.url,
                      redirectInfo.method as 'GET' | 'POST',
                    );
                  }
                },
                onError: (_error) => {
                  setErrorModalVisible(true);
                },
              });
            }}
          />
          {errorModalVisible && errorModal}
        </div>
      </div>
    </div>
  );
}
