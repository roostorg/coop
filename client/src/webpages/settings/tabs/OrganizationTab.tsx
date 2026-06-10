import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLOrgSettingsQuery,
  useGQLUpdateOrgInfoMutation,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

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

export default function OrganizationTab() {
  const { data, loading, error } = useGQLOrgSettingsQuery();
  const [updateOrgInfo, { loading: isUpdating }] = useGQLUpdateOrgInfoMutation({
    onCompleted: () => {
      toast.success('Organization information updated successfully');
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to update organization information');
    },
  });

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

  if (loading) return <FullScreenLoading />;
  if (error) return <div>Error loading organization settings</div>;

  const isEmailValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isWebsiteValid = websiteUrl && /^https?:\/\/.+\..+/.test(websiteUrl);
  const isOnCallEmailValid =
    !onCallAlertEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(onCallAlertEmail);
  const isSaveButtonDisabled =
    !name?.trim() ||
    !isEmailValid ||
    !isWebsiteValid ||
    !isOnCallEmailValid ||
    !hasChanges;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Organization Profile
          </Heading>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Organization Name
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                The display name for your organization
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                required
                placeholder="Demo Org"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Organization Email
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Primary contact email for your organization
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                type="email"
                required
                placeholder="demo@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Website URL
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Your organization's website address
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                type="url"
                required
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                On-Call Alert Email
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Optional email for receiving urgent alerts
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                type="email"
                placeholder="Enter on-call alert email (optional)"
                value={onCallAlertEmail}
                onChange={(e) => setOnCallAlertEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          onClick={async () => {
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
          }}
          disabled={isSaveButtonDisabled}
          loading={isUpdating}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
