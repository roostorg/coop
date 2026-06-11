import { Badge } from '@/coop-ui/Badge';
import { Button } from '@/coop-ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/coop-ui/Dialog';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { Heading, Text } from '@/coop-ui/Typography';
import { userHasPermissions } from '@/routing/permissions';
import { isValidIssuerDomain, normalizeIssuerDomain } from '@/utils/oidc';
import { gql } from '@apollo/client';
import { Clipboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  GQLUserPermission,
  useGQLGetSsoCallbackUrlsQuery,
  useGQLGetSsoCredentialsQuery,
  useGQLUpdateSsoSettingsMutation,
} from '../../graphql/generated';

gql`
  query GetSSOCredentials {
    me {
      permissions
    }
    myOrg {
      id
      samlEnabled
      oidcEnabled
      ssoUrl
      ssoCert
      issuerUrl
      clientId
    }
  }

  query GetSSOCallbackUrls($orgId: String!) {
    getSSOCallbackUrls(orgId: $orgId) {
      samlCallbackUrl
      samlIssuer
      oidcCallbackUrl
    }
  }

  mutation UpdateSSOSettings($input: UpdateSSOSettingsInput!) {
    updateSSOSettings(input: $input) {
      id
      samlEnabled
      oidcEnabled
      ssoUrl
      ssoCert
      issuerUrl
      clientId
    }
  }
`;

type Tab = 'SAML' | 'OIDC';

export default function SSOSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('SAML');
  const [ssoUrl, setSsoUrl] = useState('');
  const [ssoCert, setSsoCert] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);

  const { data, loading, error } = useGQLGetSsoCredentialsQuery({
    errorPolicy: 'all',
  });
  const orgId = data?.myOrg?.id;
  const { data: callbackData } = useGQLGetSsoCallbackUrlsQuery({
    variables: { orgId: orgId ?? '' },
    skip: !orgId,
  });
  const [updateSSOSettings, { loading: updateLoading }] = useGQLUpdateSsoSettingsMutation();

  useEffect(() => {
    if (data?.myOrg == null) return;
    const org = data.myOrg;
    if (org.ssoUrl != null) setSsoUrl(org.ssoUrl);
    if (org.ssoCert != null) setSsoCert(org.ssoCert);
    if (org.issuerUrl != null) setIssuerUrl(normalizeIssuerDomain(org.issuerUrl));
    if (org.clientId != null) setClientId(org.clientId);
    if (org.oidcEnabled) setActiveTab('OIDC');
  }, [data]);

  if (loading) return <FullScreenLoading />;

  const permissions = data?.me?.permissions;
  if (
    !permissions ||
    !userHasPermissions(permissions, [GQLUserPermission.ManageOrg])
  ) {
    return <Navigate to="/dashboard/settings" replace />;
  }

  if (error) return <div />;

  const copyText = async (text: string) => navigator.clipboard.writeText(text);

  const samlEnabled = data?.myOrg?.samlEnabled ?? false;
  const oidcEnabled = data?.myOrg?.oidcEnabled ?? false;
  const currentMethod = samlEnabled ? 'SAML' : oidcEnabled ? 'OIDC' : 'Password';
  const isCurrentTabActive = activeTab === currentMethod;
  const isSwitching = !isCurrentTabActive && currentMethod !== 'Password';

  const samlCallbackUri = callbackData?.getSSOCallbackUrls.samlCallbackUrl ?? '';
  const samlIssuer = callbackData?.getSSOCallbackUrls.samlIssuer ?? '';
  const oidcCallbackUri = callbackData?.getSSOCallbackUrls.oidcCallbackUrl ?? '';

  const stringIsAValidUrl = (s: string) => {
    try {
      // eslint-disable-next-line no-new
      new URL(s);
      return true;
    } catch (_) {
      return false;
    }
  };

  const isSamlFormValid = ssoUrl.length > 0 && ssoCert.length > 0;
  const isOidcFormValid =
    issuerUrl.length > 0 && clientId.length > 0 && clientSecret.length > 0;
  const isFormValid = activeTab === 'SAML' ? isSamlFormValid : isOidcFormValid;

  const handleSaveSaml = (closeDialog = false) => {
    if (!stringIsAValidUrl(ssoUrl)) {
      toast.error('SSO URL is not a valid URL');
      return;
    }
    updateSSOSettings({
      variables: { input: { saml: { ssoUrl, ssoCert } } },
      refetchQueries: ['GetSSOCredentials'],
      onCompleted: () => {
        toast.success(isSwitching ? 'Switched to SAML' : 'SAML credentials updated');
        if (closeDialog) setShowSwitchDialog(false);
      },
      onError: (e) => {
        toast.error(`Error saving SAML settings: ${e.message}`);
        if (closeDialog) setShowSwitchDialog(false);
      },
    });
  };

  const handleSaveOidc = (closeDialog = false) => {
    const normalizedIssuerUrl = normalizeIssuerDomain(issuerUrl);
    if (!isValidIssuerDomain(normalizedIssuerUrl)) {
      toast.error('Domain is not valid (e.g. your-tenant.auth0.com)');
      return;
    }
    updateSSOSettings({
      variables: {
        input: {
          oidc: {
            issuerUrl: normalizedIssuerUrl,
            clientId,
            clientSecret,
          },
        },
      },
      refetchQueries: ['GetSSOCredentials'],
      onCompleted: () => {
        toast.success(isSwitching ? 'Switched to OIDC' : 'OIDC credentials updated');
        if (closeDialog) setShowSwitchDialog(false);
      },
      onError: (e) => {
        toast.error(`Error saving OIDC settings: ${e.message}`);
        if (closeDialog) setShowSwitchDialog(false);
      },
    });
  };

  const isEnablingFromPassword = currentMethod === 'Password';

  const handleSwitch = () => {
    if (activeTab === 'SAML') handleSaveSaml(true);
    else handleSaveOidc(true);
  };

  const handleSave = () => {
    if (isSwitching || isEnablingFromPassword) {
      setShowSwitchDialog(true);
      return;
    }
    if (activeTab === 'SAML') handleSaveSaml();
    else handleSaveOidc();
  };

  return (
    <div className="flex flex-col w-3/5 gap-4 text-start">
      <Helmet>
        <title>SSO Settings</title>
      </Helmet>
      <Heading size="2XL" className="mb-2">
        SSO Settings
      </Heading>

      <div className="flex items-center gap-2">
        <Text as="span" size="SM">Current method:</Text>
        <Badge variant={currentMethod === 'Password' ? 'secondary' : 'default'}>
          {currentMethod}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['SAML', 'OIDC'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {currentMethod === tab && (
              <span className="ml-2 text-xs text-green-600 font-semibold">Active</span>
            )}
          </button>
        ))}
      </div>

      {/* SAML tab */}
      {activeTab === 'SAML' && (
        <>
          <Heading>SSO Configuration</Heading>
          <Text size="SM">
            Enter this information into your identity provider's "Service Provider Details" setup.
          </Text>
          <div className="flex flex-col gap-2 mb-8">
            <Label htmlFor="AcsUrl">ACS URL</Label>
            <Input
              id="AcsUrl"
              type="text"
              className="tracking-widest"
              value={samlCallbackUri}
              disabled
              endSlot={
                <div className="flex">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="white"
                        size="icon"
                        className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                        onClick={async () => copyText(samlCallbackUri)}
                      >
                        <Clipboard />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Copy to clipboard</TooltipContent>
                  </Tooltip>
                </div>
              }
            />
            <Label htmlFor="SpEntityId">Entity ID / Issuer</Label>
            <Input
              id="SpEntityId"
              type="text"
              className="tracking-widest"
              value={samlIssuer}
              disabled
              endSlot={
                <div className="flex">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="white"
                        size="icon"
                        className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                        onClick={async () => copyText(samlIssuer)}
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
            <Input id="ssoUrl" value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="SsoCert">SSO Certificate</Label>
            <Text id="SsoCert" size="SM">
              This is the certificate used to verify the identity of your organization when users
              attempt to log in via SSO. Please ensure this certificate matches the one provided by
              your identity provider.
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
                    onClick={async () => copyText(ssoCert)}
                  >
                    <Clipboard />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy to clipboard</TooltipContent>
              </Tooltip>
            }
          />
        </>
      )}

      {/* OIDC tab */}
      {activeTab === 'OIDC' && (
        <>
          <Heading>SSO Configuration</Heading>
          <Text size="SM">
            Enter this information into your identity provider's application setup.
          </Text>
          <div className="flex flex-col gap-2 mb-8">
            <Label htmlFor="RedirectUri">Redirect URI</Label>
            <Input
              id="RedirectUri"
              type="text"
              className="tracking-widest"
              value={oidcCallbackUri}
              disabled
              endSlot={
                <div className="flex">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="white"
                        size="icon"
                        className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                        onClick={async () => copyText(oidcCallbackUri)}
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
          <Heading>Identity Provider Configuration</Heading>
          <div className="flex flex-col gap-2">
            <Label htmlFor="issuerUrl">Domain</Label>
            <Input
              id="issuerUrl"
              placeholder="your-tenant.auth0.com"
              value={issuerUrl}
              onChange={(e) => setIssuerUrl(e.target.value)}
              onBlur={() => setIssuerUrl(normalizeIssuerDomain(issuerUrl))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={clientSecret}
              placeholder={oidcEnabled ? '••••••••  (enter new value to change)' : ''}
              onChange={(e) => setClientSecret(e.target.value)}

            />
          </div>
        </>
      )}


      <Button
        className="w-fit"
        loading={updateLoading}
        disabled={updateLoading || !isFormValid}
        onClick={handleSave}
      >
        {isSwitching
          ? `Switch to ${activeTab}`
          : isCurrentTabActive
            ? 'Save Changes'
            : `Enable ${activeTab}`}
      </Button>

      {showSwitchDialog && <Dialog open onOpenChange={setShowSwitchDialog}>
        <DialogContent className="z-[51]">
          <DialogHeader>
            <DialogTitle>
              {isEnablingFromPassword
                ? `Enable ${activeTab} authentication?`
                : `Switch SSO method to ${activeTab}?`}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {isEnablingFromPassword
              ? `Enabling ${activeTab} will disable password login for all org users immediately. You can switch SSO methods later, but users will not be able to log in with a password while SSO is active.`
              : `This will disable ${currentMethod} and enable ${activeTab}. Your ${currentMethod} credentials will be preserved in case you switch back, but users will need to authenticate through the new provider immediately.`}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwitchDialog(false)}>
              Cancel
            </Button>
            <Button loading={updateLoading} onClick={handleSwitch}>
              {isEnablingFromPassword ? `Enable ${activeTab}` : `Switch to ${activeTab}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
