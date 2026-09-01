import { gql } from '@apollo/client';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import CoopModal from '@/webpages/dashboard/components/CoopModal';

import {
  useGQLPasswordRequirementsQuery,
  useGQLResetPasswordMutation,
} from '../../../graphql/generated';
import LogoBlack from '../../../images/LogoBlack.png';
import { DEFAULT_MIN_PASSWORD_LENGTH } from '../../../utils/password';

gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input)
  }
`;
/**
 * Reset password form component
 */
export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState<string | undefined>(undefined);
  const [confirmPassword, setConfirmPassword] = useState<string | undefined>(
    undefined,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [showErrorModal, setShowErrorModal] = useState(false);
  const showError = () => setShowErrorModal(true);

  const { token } = useParams<{ token: string | undefined }>();
  const navigate = useNavigate();

  const { data: passwordRequirementsData } = useGQLPasswordRequirementsQuery();
  const minPasswordLength =
    passwordRequirementsData?.passwordRequirements.minLength ??
    DEFAULT_MIN_PASSWORD_LENGTH;

  const [resetPassword, { loading: resetPasswordLoading }] =
    useGQLResetPasswordMutation({
      onError: showError,
      onCompleted: (data) => {
        if (!data.resetPassword) {
          showError();
        } else {
          navigate('/dashboard');
        }
      },
    });

  if (!token) {
    return <Navigate to="/login" />;
  }

  const newPasswordInput = (
    <Input.Password
      className="rounded-lg"
      placeholder={`Enter new password (min ${minPasswordLength} characters)`}
      value={newPassword}
      onChange={(event) => {
        setNewPassword(event.target.value);
      }}
    />
  );

  const confirmPasswordInput = (
    <Input.Password
      className="rounded-lg"
      placeholder="Confirm new password"
      value={confirmPassword}
      onChange={(event) => setConfirmPassword(event.target.value)}
    />
  );

  const submitButton = (
    <Button
      className="w-full mt-4 !border-none rounded-lg !bg-primary"
      type="primary"
      htmlType="submit"
      loading={resetPasswordLoading}
      onClick={async () => {
        if (newPassword !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          return;
        }
        if (!newPassword || newPassword.length < minPasswordLength) {
          setErrorMessage(
            `Password must be at least ${minPasswordLength} characters long.`,
          );
          return;
        }
        setErrorMessage(undefined);
        await resetPassword({
          variables: {
            input: {
              token,
              newPassword,
            },
          },
        });
      }}
    >
      Update Password
    </Button>
  );

  const errorModal = (
    <CoopModal
      title="Something went wrong"
      visible={showErrorModal}
      onClose={() => setShowErrorModal(false)}
    >
      We encountered an issue trying to process your request. Please try again.
    </CoopModal>
  );

  return (
    <div className="flex flex-col h-screen p-8 mb-0 bg-slate-100">
      <Helmet>
        <title>Reset Password</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex flex-col justify-center my-1.5 mx-9 p-12 w-[460px] items-start border-neutral-200 rounded-2xl border border-solid">
          <Link to="/" className="flex items-center justify-center w-full my-2">
            <img src={LogoBlack} alt="Coop Logo" className="h-12" />
          </Link>
          <div className="py-5 text-2xl font-bold">Reset Password</div>
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-3 w-full bg-red-50 border border-red-200 rounded text-red-700 text-sm"
            >
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col items-center justify-center w-full gap-4">
            {newPasswordInput}
            {confirmPasswordInput}
            {submitButton}
            {errorModal}
          </div>
        </div>
      </div>
    </div>
  );
}
