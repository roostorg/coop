import { gql } from '@apollo/client';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import CoopModal from '@/webpages/dashboard/components/CoopModal';

import { useGQLSendPasswordResetMutation } from '../../../graphql/generated';
import LogoBlack from '../../../images/LogoBlack.png';

gql`
  mutation SendPasswordReset($input: SendPasswordResetInput!) {
    sendPasswordReset(input: $input)
  }
`;

/**
 * Forgot password form component
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const [sendPasswordReset, { loading }] = useGQLSendPasswordResetMutation({
    onError: () => setModalVisible(true),
    onCompleted: () => setModalVisible(true),
  });

  const onSendPasswordReset = async (values: any) => {
    const { email } = values;
    sendPasswordReset({
      variables: {
        input: {
          email,
        },
      },
    });
  };

  const emailInput = (
    <Input
      className="my-6 rounded-lg"
      placeholder="Enter your email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
    />
  );

  const sendButton = (
    <Button
      className="w-full !border-none rounded-lg !bg-primary"
      type="primary"
      loading={loading}
      htmlType="submit"
      onClick={async () => onSendPasswordReset({ email })}
    >
      Send Reset Link
    </Button>
  );

  const modal = (
    <CoopModal
      title="Reset Link Sent"
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
    >
      <div>
        A password reset link has been sent to{' '}
        <span className="font-semibold">{email}</span>. If you don't receive the
        link within a few minutes, you can try resending it.
      </div>
    </CoopModal>
  );

  return (
    <div className="flex flex-col h-screen p-8 mb-0 bg-slate-100">
      <Helmet>
        <title>Forgot Password</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex flex-col items-start justify-center border border-solid border-slate-200 shadow rounded-xl my-1.5 mx-9 p-12 max-w-md">
          <Link to="/" className="flex items-center justify-center w-full my-2">
            <img src={LogoBlack} alt="Coop Logo" className="h-12" />
          </Link>
          <div className="py-5 text-2xl font-bold">Forgot your password?</div>
          <div className="mb-6 text-sm text-start">
            We'll send you a link so you can reset it. Please input the email
            address associated with your account.
          </div>
          <div className="flex flex-col items-center justify-center w-full gap-4">
            {emailInput}
            {sendButton}
            {modal}
          </div>
        </div>
      </div>
    </div>
  );
}
