import { Button } from '@/coop-ui/Button';
import { Checkbox } from '@/coop-ui/Checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/coop-ui/Dialog';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Switch } from '@/coop-ui/Switch';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLDeploymentSettingsQuery,
  useGQLUpdateSamlEnabledMutation,
  useGQLUpdateSsoCredentialsMutation,
} from '@/graphql/generated';
import { isValidUrl } from '@/lib/utils';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  mutation UpdateSSOCredentials($input: UpdateSSOCredentialsInput!) {
    updateSSOCredentials(input: $input)
  }
`;

export default function SSOTab() {
  const { data, loading, error, refetch } = useGQLDeploymentSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  const org = data?.myOrg;

  const [samlEnabled, setSamlEnabled] = useState(false);
  const [ssoUrl, setSsoUrl] = useState('');
  const [ssoCert, setSsoCert] = useState('');
  const [showEnforceDialog, setShowEnforceDialog] = useState(false);
  const [ssoConfirmed, setSsoConfirmed] = useState(false);

  useEffect(() => {
    if (org) {
      setSamlEnabled(org.samlEnabled);
      setSsoUrl(org.ssoUrl ?? '');
      setSsoCert(org.ssoCert ?? '');
    }
  }, [org]);

  const mutationOpts = {
    onCompleted: () => {
      toast.success('SSO settings updated');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update SSO settings');
    },
  };

  const [updateSamlEnabled] = useGQLUpdateSamlEnabledMutation(mutationOpts);
  const [updateSSOCredentials, { loading: ssoSaveLoading }] =
    useGQLUpdateSsoCredentialsMutation(mutationOpts);

  if (loading) return <FullScreenLoading />;
  if (error || !org) return <div>Error loading SSO settings</div>;

  const hasSsoCredentials = Boolean(org.ssoUrl && org.ssoCert);

  const credentialsChanged =
    ssoUrl !== (org.ssoUrl ?? '') || ssoCert !== (org.ssoCert ?? '');

  const hasChanges = samlEnabled !== org.samlEnabled || credentialsChanged;

  // Credentials only need to be present/valid when they're actually being
  // changed; toggling SAML off (or other non-credential saves) must not be
  // blocked by blank credentials.
  const credentialsInvalid =
    credentialsChanged && (!ssoUrl || !ssoCert || !isValidUrl(ssoUrl));

  const handleSave = () => {
    if (samlEnabled !== org.samlEnabled) {
      updateSamlEnabled({ variables: { enabled: samlEnabled } });
    }
    if (credentialsChanged) {
      updateSSOCredentials({
        variables: { input: { ssoUrl, ssoCert } },
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Single Sign-On (SSO)
          </Heading>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Enable SAML/SSO
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Activates SAML authentication for the organization
              </Text>
            </div>
            {/* This tooltip appears when the SSO toggle is off and disabled. Indicates to the user to enter a SSO URL and Cert */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Switch
                    checked={samlEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setShowEnforceDialog(true);
                      } else {
                        setSamlEnabled(false);
                      }
                    }}
                    disabled={!hasSsoCredentials && !samlEnabled}
                  />
                </span>
              </TooltipTrigger>
              {!hasSsoCredentials && !samlEnabled && (
                <TooltipContent>
                  Save an SSO URL and certificate first
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                SSO URL
              </Text>
              <Text className="text-[0.8125rem] text-gray-500 mt-[.31rem]">
                The SAML identity provider endpoint
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                placeholder="https://idp.example.com/saml"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
              />
              {ssoUrl && !isValidUrl(ssoUrl) && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be a valid URL
                </Text>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                SAML Certificate
              </Text>
              <Text className="text-[0.8125rem] text-gray-500 mt-[.31rem]">
                The SAML identity provider signing certificate
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Textarea
                className="h-44"
                placeholder="-----BEGIN CERTIFICATE-----"
                value={ssoCert}
                onChange={(e) => setSsoCert(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          disabled={!hasChanges || ssoSaveLoading || credentialsInvalid}
          loading={ssoSaveLoading}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>

      <Dialog
        open={showEnforceDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowEnforceDialog(false);
            setSsoConfirmed(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enforce SSO</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="flex flex-col gap-4">
              <Text size="SM">
                Requiring single sign-on will disable logging in with a password
                for all users, including admins. Confirm that SSO works
                correctly before enabling.
              </Text>
              <Text size="SM" weight={'bold'}>
                If SSO is misconfigured, it will require direct database access
                to disable SSO and restore access to your admin account.
              </Text>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sso-confirm"
                  checked={ssoConfirmed}
                  onCheckedChange={(checked) =>
                    setSsoConfirmed(checked === true)
                  }
                />
                <Label htmlFor="sso-confirm" className="text-sm">
                  I&apos;ve confirmed SSO works for passwordless login
                </Label>
              </div>
            </div>
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!ssoConfirmed}
              onClick={() => {
                setSamlEnabled(true);
                setShowEnforceDialog(false);
                setSsoConfirmed(false);
              }}
            >
              Enforce SSO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
