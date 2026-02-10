import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { Heading, Text } from '@/coop-ui/Typography';
import { userHasPermissions } from '@/routing/permissions';
import { gql } from '@apollo/client';
import { Clipboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  GQLUserPermission,
  useGQLGetSsoCredentialsQuery,
  useGQLUpdateSsoCredentialsMutation,
} from '../../graphql/generated';

gql`
  query GetSSOCredentials {
    me {
      permissions
    }
    myOrg {
      id
      ssoUrl
      ssoCert
    }
  }

  mutation UpdateSSOCredentials($input: UpdateSSOCredentialsInput!) {
    updateSSOCredentials(input: $input)
  }
`;

export default function SSOSettings() {
  const [ssoUrl, setSsoUrl] = useState<string | undefined>(undefined);
  const [ssoCert, setSsoCert] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  const { data, loading, error } = useGQLGetSsoCredentialsQuery();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [updateSSOCredentials, { loading: updateLoading, error: updateError }] =
    useGQLUpdateSsoCredentialsMutation();

  useEffect(() => {
    if (data?.myOrg == null) {
      return;
    }

    if (data.myOrg.ssoUrl != null) {
      setSsoUrl(data.myOrg.ssoUrl);
    }

    if (data.myOrg.ssoCert != null) {
      setSsoCert(data.myOrg.ssoCert);
    }
  }, [data]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    return <div />;
  }

  const requiredPermissions = [GQLUserPermission.ManageOrg];
  const permissions = data?.me?.permissions;
  if (!userHasPermissions(permissions, requiredPermissions)) {
    navigate('/settings');
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  const callbackUri = `https://getcoop.com/api/v1/saml/login/${data?.myOrg?.id}/callback`;

  return (
    <div className="flex flex-col w-3/5 gap-4 text-start">
      <Helmet>
        <title>SSO Settings</title>
      </Helmet>
      <Heading size="2XL" className="mb-2">
        SSO Settings
      </Heading>
      <Heading>SSO Configuration</Heading>
      <Text size="SM">
        Enter this information into your identity provider's "Service Provider
        Details" setup.
      </Text>
      <div className="flex flex-col	gap-2 mb-8">
        <Label htmlFor="AcsUrl">ACS URL</Label>
        <Input
          id="AcsUrl"
          type={'text'}
          className={'tracking-widest'}
          value={callbackUri}
          disabled
          endSlot={
            <div className="flex">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="white"
                    size="icon"
                    className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                    onClick={() => copyText(callbackUri)}
                  >
                    <Clipboard />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy to clipboard</TooltipContent>
              </Tooltip>
            </div>
          }
        />
        <Label htmlFor="SpEntityId">Entity ID / Issuer </Label>
        <Input
          id="SpEntityId"
          type={'text'}
          className={'tracking-widest'}
          value={'https://getcoop.com'}
          disabled
          endSlot={
            <div className="flex">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="white"
                    size="icon"
                    className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                    onClick={() => copyText('https://getcoop.com')}
                  >
                    <Clipboard />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy to clipboard</TooltipContent>
              </Tooltip>
            </div>
          }
        />
      </div>
      <Heading>Identity Provider Metadata</Heading>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ssoUrl">SSO URL</Label>
        <Input
          id="ssoUrl"
          value={ssoUrl}
          onChange={(e) => setSsoUrl(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="SsoCert">SSO Certificate</Label>
        <Text id="SsoCert" size="SM">
          This is the certificate used to verify the identity of your
          organization when users attempt to log in via SSO. Please ensure this
          certificate matches the one provided by your identity provider.
        </Text>
      </div>
      <Textarea
        id="ssoCert"
        className="h-44"
        value={ssoCert}
        onChange={(e) => setSsoCert(e.target.value)}
        endSlot={
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="white"
                size="icon"
                className="border-l-0 rounded-none rounded-r-lg"
                onClick={() => copyText(ssoCert ?? '')}
              >
                <Clipboard />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Copy to clipboard</TooltipContent>
          </Tooltip>
        }
      />
      <Button
        className="w-fit"
        loading={updateLoading}
        disabled={
          updateLoading ||
          ssoUrl == null ||
          ssoCert == null ||
          ssoUrl.length === 0 ||
          ssoCert.length === 0
        }
        onClick={() => {
          const stringIsAValidUrl = (s: string) => {
            try {
              // eslint-disable-next-line no-new
              new URL(s);
              return true;
            } catch (_) {
              return false;
            }
          };

          if (!stringIsAValidUrl(ssoUrl!)) {
            toast.error('SSO URL is not a valid URL');
            return;
          }

          updateSSOCredentials({
            // Assertion is safe because of disabled check above
            variables: { input: { ssoUrl: ssoUrl!, ssoCert: ssoCert! } },
            onCompleted: () => toast.success('SSO credentials updated'),
            onError: (error) =>
              toast.error(`Error updating SSO credentials: ${error.message}`),
          });
        }}
      >
        Save Changes
      </Button>
    </div>
  );
}
