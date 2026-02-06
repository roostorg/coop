import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import { gql } from '@apollo/client';
import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';

import {
  GQLUserPermission,
  useGQLOrgSettingsQuery,
  useGQLUpdateOrgInfoMutation,
} from '../../graphql/generated';
import { userHasPermissions } from '../../routing/permissions';

gql`
  query OrgSettings {
    myOrg {
      id
      name
      email
      websiteUrl
      onCallAlertEmail
    }
    me {
      id
      permissions
    }
  }

  mutation UpdateOrgInfo($input: UpdateOrgInfoInput!) {
    updateOrgInfo(input: $input) {
      _
    }
  }
`;

export default function OrgSettings() {
  const navigate = useNavigate();
  const { data, loading, error } = useGQLOrgSettingsQuery();
  const [updateOrgInfo, { loading: isUpdating }] = useGQLUpdateOrgInfoMutation(
    {
      onCompleted: () => {
        toast.success('Organization information updated successfully');
      },
      onError: (err) => {
        const errorMessage =
          err.message ?? 'Failed to update organization information';
        toast.error(errorMessage);
      },
    },
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [onCallAlertEmail, setOnCallAlertEmail] = useState('');

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.myOrg) {
      setName(data.myOrg.name);
      setEmail(data.myOrg.email);
      setWebsiteUrl(data.myOrg.websiteUrl);
      setOnCallAlertEmail(data.myOrg.onCallAlertEmail ?? '');
    }
  }, [data]);

  useEffect(() => {
    if (data?.myOrg) {
      const changed =
        name !== data.myOrg.name ||
        email !== data.myOrg.email ||
        websiteUrl !== data.myOrg.websiteUrl ||
        onCallAlertEmail !== (data.myOrg.onCallAlertEmail ?? '');
      setHasChanges(changed);
    }
  }, [name, email, websiteUrl, onCallAlertEmail, data]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
    },
    [],
  );

  const handleWebsiteUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWebsiteUrl(e.target.value);
    },
    [],
  );

  const handleOnCallAlertEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOnCallAlertEmail(e.target.value);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    await updateOrgInfo({
      variables: {
        input: {
          name,
          email,
          websiteUrl,
          onCallAlertEmail: onCallAlertEmail || null,
        },
      },
      refetchQueries: ['OrgSettings'],
    });
  }, [name, email, websiteUrl, onCallAlertEmail, updateOrgInfo]);

  const handleCancel = useCallback(() => {
    if (data?.myOrg) {
      setName(data.myOrg.name);
      setEmail(data.myOrg.email);
      setWebsiteUrl(data.myOrg.websiteUrl);
      setOnCallAlertEmail(data.myOrg.onCallAlertEmail ?? '');
    }
  }, [data]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    return <div>Error loading organization settings</div>;
  }

  const requiredPermissions = [GQLUserPermission.ManageOrg];
  const permissions = data?.me?.permissions;
  if (!userHasPermissions(permissions, requiredPermissions)) {
    navigate('/settings');
    return null;
  }

  const isEmailValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isWebsiteValid =
    websiteUrl && /^https?:\/\/.+\..+/.test(websiteUrl);
  const isOnCallEmailValid =
    !onCallAlertEmail ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(onCallAlertEmail);
  const isSaveButtonDisabled =
    !name?.trim() ||
    !isEmailValid ||
    !isWebsiteValid ||
    !isOnCallEmailValid ||
    !hasChanges;

  return (
    <>
      <Helmet>
        <title>Organization Settings</title>
      </Helmet>

      <div className="w-[700px]">
        <Heading size="2XL" className="mb-2">
          Organization Settings
        </Heading>
        <Text size="SM" className="mb-8">
          Manage your organization's information. Only administrators can edit
          these settings.
        </Text>

        <div className="space-y-6">
          <div>
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              required
              placeholder="Enter organization name"
              value={name}
              onChange={handleNameChange}
            />
            {!name?.trim() && (
              <Text size="SM" className="text-red-500 mt-1">
                Organization name is required
              </Text>
            )}
          </div>

          <div>
            <Label htmlFor="orgEmail">Organization Email</Label>
            <Input
              id="orgEmail"
              type="email"
              required
              placeholder="Enter organization email"
              value={email}
              onChange={handleEmailChange}
            />
            {email && !isEmailValid && (
              <Text size="SM" className="text-red-500 mt-1">
                Please enter a valid email address
              </Text>
            )}
          </div>

          <div>
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              type="url"
              required
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={handleWebsiteUrlChange}
            />
            {websiteUrl && !isWebsiteValid && (
              <Text size="SM" className="text-red-500 mt-1">
                Please enter a valid URL (must start with http:// or https://)
              </Text>
            )}
          </div>

          <div>
            <Label htmlFor="onCallAlertEmail">On-Call Alert Email</Label>
            <Input
              id="onCallAlertEmail"
              type="email"
              placeholder="Enter on-call alert email (optional)"
              value={onCallAlertEmail}
              onChange={handleOnCallAlertEmailChange}
            />
            <Text size="SM" className="text-gray-500 mt-1">
              Optional email for receiving urgent alerts
            </Text>
            {onCallAlertEmail && !isOnCallEmailValid && (
              <Text size="SM" className="text-red-500 mt-1">
                Please enter a valid email address
              </Text>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaveButtonDisabled}
              loading={isUpdating}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!hasChanges || isUpdating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

