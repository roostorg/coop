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
import { gql } from '@apollo/client';
import { Clipboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  GQLSsoMethod,
  GQLUserPermission,
  useGQLGetSsoCredentialsQuery,
  useGQLGetSsoOidcCallbackUrlQuery,
  useGQLSwitchSsoMethodMutation,
  useGQLUpdateSsoOidcCredentialsMutation,
  useGQLUpdateSsoSamlCredentialsMutation,
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

  query GetSSOOidcCallbackUrl {
    getSSOOidcCallbackUrl
  }

  mutation UpdateSSOSamlCredentials($input: UpdateSSOSamlCredentialsInput!) {
    updateSSOSamlCredentials(input: $input)
  }

  mutation UpdateSSOOidcCredentials($input: UpdateSSOOidcCredentialsInput!) {
    updateSSOOidcCredentials(input: $input)
  }

  mutation SwitchSSOMethod($input: SwitchSSOMethodInput!) {
    switchSSOMethod(input: $input) {
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
  const navigate = useNavigate();

  const { data, loading, error } = useGQLGetSsoCredentialsQuery();
  const { data: callbackData } = useGQLGetSsoOidcCallbackUrlQuery();
  const [updateSSOSamlCredentials, { loading: samlUpdateLoading }] =
    useGQLUpdateSsoSamlCredentialsMutation();
  const [updateSSOOidcCredentials, { loading: oidcUpdateLoading }] =
    useGQLUpdateSsoOidcCredentialsMutation();
  const [switchSSOMethod, { loading: switchLoading }] = useGQLSwitchSsoMethodMutation();

  useEffect(() => {
    if (data?.myOrg == null) return;
    const org = data.myOrg;
    if (org.ssoUrl != null) setSsoUrl(org.ssoUrl);
    if (org.ssoCert != null) setSsoCert(org.ssoCert);
    if (org.issuerUrl != null) setIssuerUrl(org.issuerUrl);
    if (org.clientId != null) setClientId(org.clientId);
    if (org.oidcEnabled) setActiveTab('OIDC');
  }, [data]);

  if (loading) return <FullScreenLoading />;
  if (error) return <div />;

  if (!userHasPermissions(data?.me?.permissions, [GQLUserPermission.ManageOrg])) {
    navigate('/settings');
    return;
  }

  const copyText = async (text: string) => navigator.clipboard.writeText(text);

  const samlEnabled = data?.myOrg?.samlEnabled ?? false;
  const oidcEnabled = data?.myOrg?.oidcEnabled ?? false;
  const currentMethod = samlEnabled ? 'SAML' : oidcEnabled ? 'OIDC' : 'Password';
  const isCurrentTabActive = activeTab === currentMethod;
  const isSwitching = !isCurrentTabActive && currentMethod !== 'Password';

  const samlCallbackUri = `https://getcoop.com/api/v1/saml/login/${data?.myOrg?.id}/callback`;
  const oidcCallbackUri = callbackData?.getSSOOidcCallbackUrl ?? '';

  const stringIsAValidUrl = (s: string) => {
    try {
      // eslint-disable-next-line no-new
      new URL(s);
      return true;
    } catch (_) {
      return false;
    }
  };

  const isValidDomain = (s: string) => {
    try {
      const url = new URL(`https://${s.replace(/^https?:\/\//, '')}`);
      return url.hostname.includes('.') && url.hostname === s.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } catch (_) {
      return false;
    }
  };

  const isSamlFormValid = ssoUrl.length > 0 && ssoCert.length > 0;
  const isOidcFormValid =
    issuerUrl.length > 0 && clientId.length > 0 && (clientSecret.length > 0 || oidcEnabled);
  const isFormValid = activeTab === 'SAML' ? isSamlFormValid : isOidcFormValid;

  const updateLoading = samlUpdateLoading || oidcUpdateLoading || switchLoading;

  const handleSaveSaml = () => {
    if (!stringIsAValidUrl(ssoUrl)) {
      toast.error('SSO URL is not a valid URL');
      return;
    }
    updateSSOSamlCredentials({
      variables: { input: { samlEnabled: true, ssoUrl, ssoCert } },
      refetchQueries: ['GetSSOCredentials'],
      onCompleted: () => toast.success('SAML credentials updated'),
      onError: (e) => toast.error(`Error updating SAML credentials: ${e.message}`),
    });
  };

  const handleSaveOidc = () => {
    if (!isValidDomain(issuerUrl)) {
      toast.error('Domain is not valid (e.g. your-tenant.auth0.com)');
      return;
    }
    updateSSOOidcCredentials({
      variables: { input: { oidcEnabled: true, issuerUrl, clientId, clientSecret } },
      refetchQueries: ['GetSSOCredentials'],
      onCompleted: () => toast.success('OIDC credentials updated'),
      onError: (e) => toast.error(`Error updating OIDC credentials: ${e.message}`),
    });
  };

  const isEnablingFromPassword = currentMethod === 'Password';

  const handleSwitch = () => {
    if (isEnablingFromPassword) {
      if (activeTab === 'SAML') handleSaveSaml();
      else handleSaveOidc();
      setShowSwitchDialog(false);
      return;
    }
    if (activeTab === 'SAML') {
      if (!stringIsAValidUrl(ssoUrl)) {
        toast.error('SSO URL is not a valid URL');
        setShowSwitchDialog(false);
        return;
      }
      switchSSOMethod({
        variables: { input: { method: GQLSsoMethod.Saml, ssoUrl, ssoCert } },
        refetchQueries: ['GetSSOCredentials'],
        onCompleted: () => {
          toast.success('Switched to SAML');
          setShowSwitchDialog(false);
        },
        onError: (e) => {
          toast.error(`Error switching SSO method: ${e.message}`);
          setShowSwitchDialog(false);
        },
      });
    } else {
      if (!isValidDomain(issuerUrl)) {
        toast.error('Domain is not valid (e.g. your-tenant.auth0.com)');
        setShowSwitchDialog(false);
        return;
      }
      switchSSOMethod({
        variables: {
          input: { method: GQLSsoMethod.Oidc, issuerUrl, clientId, clientSecret },
        },
        refetchQueries: ['GetSSOCredentials'],
        onCompleted: () => {
          toast.success('Switched to OIDC');
          setShowSwitchDialog(false);
        },
        onError: (e) => {
          toast.error(`Error switching SSO method: ${e.message}`);
          setShowSwitchDialog(false);
        },
      });
    }
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
        <Text size="SM">Current method:</Text>
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
              value="https://getcoop.com"
              disabled
              endSlot={
                <div className="flex">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="white"
                        size="icon"
                        className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                        onClick={async () => copyText('https://getcoop.com')}
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

      <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEnablingFromPassword
                ? `Enable ${activeTab} authentication?`
                : `Switch SSO method to ${activeTab}?`}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {isEnablingFromPassword
              ? `Enabling ${activeTab} is irreversible. All org users will be required to authenticate through the new provider immediately.`
              : `This will disable ${currentMethod} and enable ${activeTab}. Your ${currentMethod} credentials will be preserved in case you switch back, but users will need to authenticate through the new provider immediately.`}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwitchDialog(false)}>
              Cancel
            </Button>
            <Button loading={isEnablingFromPassword ? updateLoading : switchLoading} onClick={handleSwitch}>
              {isEnablingFromPassword ? `Enable ${activeTab}` : `Switch to ${activeTab}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
