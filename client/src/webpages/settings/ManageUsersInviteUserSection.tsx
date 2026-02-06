import {
  GQLUserRole,
  namedOperations,
  useGQLHasNcmecReportingEnabledQuery,
  useGQLInviteUserMutation,
} from '@/graphql/generated';
import { titleCaseEnumString } from '@/utils/string';
import { gql } from '@apollo/client';
import { useState } from 'react';

import CoopButton from '../dashboard/components/CoopButton';
import CoopInput from '../dashboard/components/CoopInput';
import CoopModal from '../dashboard/components/CoopModal';
import CoopRadioGroup from '../dashboard/components/CoopRadioGroup';
import FormSectionHeader from '../dashboard/components/FormSectionHeader';

import { getRoleDescription } from './ManageUsersFormUtils';

gql`
  query HasNcmecReportingEnabled {
    myOrg {
      hasNCMECReportingEnabled
    }
  }

  mutation InviteUser($input: InviteUserInput!) {
    inviteUser(input: $input)
  }
`;

export default function ManageUsersInviteUserSection() {
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<GQLUserRole | undefined>(undefined);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [inviteSentModalVisible, setInviteSentModalVisible] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | undefined>(undefined);
  const [copySuccess, setCopySuccess] = useState(false);

  const { data } = useGQLHasNcmecReportingEnabledQuery();
  const hasNCMECReportingEnabled = data?.myOrg?.hasNCMECReportingEnabled;

  const [inviteUser, { loading, error }] = useGQLInviteUserMutation({
    refetchQueries: [namedOperations.Query.ManageUsers],
    onError: () => setInviteSentModalVisible(true),
    onCompleted: (data) => {
      setInviteToken(data.inviteUser ?? undefined);
      setInviteSentModalVisible(true);
    },
  });

  const rolesModal = (
    <CoopModal
      title="User Roles"
      visible={roleModalVisible}
      onClose={() => setRoleModalVisible(false)}
    >
      <div className="max-w-[600px]">
        {Object.values(GQLUserRole)
          // If the org doesn't have NCMEC reporting enabled, don't show the CHILD_SAFETY_MODERATOR role
          .filter((role) =>
            !hasNCMECReportingEnabled
              ? role !== GQLUserRole.ChildSafetyModerator
              : true,
          )
          .map((role, i) => (
            <div key={i}>
              <div className="text-lg font-bold">
                {titleCaseEnumString(role)}
              </div>
              <div className="h-1" />
              {getRoleDescription(role)}
              <div className="h-3" />
            </div>
          ))}
      </div>
    </CoopModal>
  );

  const copyInviteLink = () => {
    if (inviteToken) {
      const uiUrl = process.env.REACT_APP_UI_URL ?? window.location.origin;
      const signupUrl = `${uiUrl}/signup/${inviteToken}`;
      navigator.clipboard.writeText(signupUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const inviteSentModal = (
    <CoopModal
      title={error ? 'Invitation Error' : 'Invitation Created'}
      visible={inviteSentModalVisible}
      onClose={() => {
        setInviteSentModalVisible(false);
        setInviteToken(undefined);
        setCopySuccess(false);
      }}
    >
      {error ? (
        'We encountered an issue trying to invite this user. Please try again.'
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            We have created an invite for{' '}
            <span className="font-semibold">{email}</span>.
            {inviteToken && (
              <>
                {' '}
                An email has been sent if email service is configured. You can
                also copy the invite link below to share it directly.
              </>
            )}
          </div>
          {inviteToken && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold">Invite Link:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${
                    process.env.REACT_APP_UI_URL ?? window.location.origin
                  }/signup/${inviteToken}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-gray-50"
                  onClick={(e) => e.currentTarget.select()}
                />
                <CoopButton
                  title={copySuccess ? '✓ Copied!' : 'Copy Link'}
                  size="middle"
                  onClick={copyInviteLink}
                  type={copySuccess ? 'primary' : 'secondary'}
                />
              </div>
              <div className="text-xs text-gray-600">
                The link will expire in 2 weeks.
              </div>
            </div>
          )}
        </div>
      )}
    </CoopModal>
  );

  const onInviteUser = () => {
    inviteUser({
      variables: {
        input: { email: email!, role: role! },
      },
    });
  };

  return (
    <div className="flex flex-col items-start mb-8 text-start">
      <FormSectionHeader
        title="Invite Users"
        subtitle="Grant account access to members of your team. Enter their email address and select their Role."
      />
      <div className="w-2/5">
        <CoopInput
          type="email"
          placeholder="Email address"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
        />
      </div>
      <div className="mt-8 mb-4 text-base text-zinc-900">
        Select this new user's role. Roles determine what features they can
        access. Click
        <CoopButton
          title="here"
          type="link"
          onClick={() => setRoleModalVisible(true)}
        />
        to see which permissions each role has.
      </div>
      <div className="ml-4">
        <CoopRadioGroup
          options={Object.values(GQLUserRole)
            // If the org doesn't have NCMEC reporting enabled, don't show the CHILD_SAFETY_MODERATOR role
            .filter((role) =>
              !hasNCMECReportingEnabled
                ? role !== GQLUserRole.ChildSafetyModerator
                : true,
            )
            .map((role) => ({
              label: titleCaseEnumString(role),
              value: role,
            }))}
          onChange={(e) => setRole(e.target.value as GQLUserRole)}
        />
      </div>
      <div className="flex items-start mt-8">
        <CoopButton
          title="Send Invite Link"
          size="middle"
          onClick={onInviteUser}
          loading={loading}
          disabled={!email?.length || !role}
        />
      </div>
      {rolesModal}
      {inviteSentModal}
    </div>
  );
}
