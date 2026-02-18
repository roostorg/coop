import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Link } from '@/coop-ui/Link';
import { Textarea } from '@/coop-ui/Textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLApiAuthQuery,
  useGQLRotateApiKeyMutation,
  useGQLRotateWebhookSigningKeyMutation,
} from '../../graphql/generated';
import { Clipboard, Eye, EyeClosed, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';

import { GQLUserPermission } from '../../graphql/generated';
import { userHasPermissions } from '../../routing/permissions';


const ApiAuthenticationSettings = () => {
  const { data, loading, error, refetch } = useGQLApiAuthQuery();
  const [rotateApiKey] = useGQLRotateApiKeyMutation();
  const [rotateWebhookSigningKey] = useGQLRotateWebhookSigningKeyMutation();
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [showRotationDialog, setShowRotationDialog] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [showWebhookKeyRotationDialog, setShowWebhookKeyRotationDialog] =
    useState(false);
  const [isRotatingWebhookKey, setIsRotatingWebhookKey] = useState(false);
  const [newWebhookSigningKey, setNewWebhookSigningKey] = useState<
    string | null
  >(null);
  const [webhookKeyRotationError, setWebhookKeyRotationError] = useState<
    string | null
  >(null);
  const [webhookKeyCopied, setWebhookKeyCopied] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    const message =
      error.graphQLErrors?.[0]?.message ??
      error.message ??
      'Failed to load API key settings';
    return (
      <div className="flex flex-col gap-4 max-w-xl">
        <Heading size="2XL">API Keys</Heading>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text size="SM" className="text-red-800">
            {message}
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={async () => { await refetch(); }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const requiredPermissions = [GQLUserPermission.ManageOrg];
  const permissions = data?.me?.permissions;
  if (!userHasPermissions(permissions, requiredPermissions)) {
    navigate('/settings');
    return null;
  }

  const org = data?.myOrg;
  if (!org) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Text size="SM">Unable to load organization. Please try again.</Text>
        <Button variant="outline" size="sm" className="mt-3" onClick={async () => { await refetch(); }}>
          Retry
        </Button>
      </div>
    );
  }

  const apiKey = data?.apiKey;
  const { publicSigningKey } = org;
  
  // Show the new API key if we have one, otherwise show a message about the existing key
  const displayApiKey = newApiKey ?? (apiKey === 'API key exists (hidden for security)' ? 'API key exists (hidden for security)' : 'No API key available');
  const isNewKey = Boolean(newApiKey);
  const isKeyHidden = !newApiKey && apiKey === 'API key exists (hidden for security)';

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleRotateApiKey = async () => {
    setIsRotating(true);
    setRotationError(null);
    
    try {
      const result = await rotateApiKey({
        variables: {
          input: {
            name: 'Main API Key',
            description: 'Primary API key for organization',
          },
        },
      });

      if (result.data?.rotateApiKey.__typename === 'RotateApiKeySuccessResponse') {
        setNewApiKey(result.data.rotateApiKey.apiKey);
        await refetch();
      } else if (result.data?.rotateApiKey.__typename === 'RotateApiKeyError') {
        setRotationError(result.data.rotateApiKey.detail ?? 'Failed to rotate API key');
      }
    } catch (err) {
      setRotationError('An error occurred while rotating the API key');
    } finally {
      setIsRotating(false);
      setShowRotationDialog(false);
    }
  };

  const confirmRotation = () => {
    setShowRotationDialog(true);
  };

  const handleRotateWebhookSigningKey = async () => {
    setIsRotatingWebhookKey(true);
    setWebhookKeyRotationError(null);

    try {
      const result = await rotateWebhookSigningKey();

      if (
        result.data?.rotateWebhookSigningKey.__typename ===
        'RotateWebhookSigningKeySuccessResponse'
      ) {
        setNewWebhookSigningKey(
          result.data.rotateWebhookSigningKey.publicSigningKey,
        );
        await refetch();
      } else if (
        result.data?.rotateWebhookSigningKey.__typename ===
        'RotateWebhookSigningKeyError'
      ) {
        setWebhookKeyRotationError(
          result.data.rotateWebhookSigningKey.detail ??
            'Failed to generate new webhook signing key',
        );
      }
    } catch {
      setWebhookKeyRotationError(
        'An error occurred while generating the new webhook signing key',
      );
    } finally {
      setIsRotatingWebhookKey(false);
      setShowWebhookKeyRotationDialog(false);
    }
  };

  const confirmWebhookKeyRotation = () => {
    setShowWebhookKeyRotationDialog(true);
  };

  const showWebhookDialog = showWebhookKeyRotationDialog;
  const onConfirmWebhookRotation = handleRotateWebhookSigningKey;

  return (
    <div className="flex flex-col w-3/5 text-start">
      <Helmet>
        <title>API Keys</title>
      </Helmet>
      <div className="mb-4">
        <Heading size="2XL" className="mb-2">
          API Keys
        </Heading>
        <Text size="SM">
          Your authentication keys and secret are below. Never share these with
          anyone outside your organization.
        </Text>
      </div>

      <div className="mb-8">
        <Heading className="mb-2">API Key</Heading>
        <Text size="SM">
          This is your API key. Every HTTP request you send to Coop must have
          this API key attached so we can authenticate the request. To attach it
          to a request, simply add the following parameter to your request
          headers:
        </Text>
      </div>

      <div className="flex flex-col	gap-2 mb-8">
        <div className="flex justify-between items-center">
          <Label htmlFor="apiKey">API Key</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={confirmRotation}
            disabled={isRotating}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {isRotating ? 'Rotating...' : 'Rotate Key'}
          </Button>
        </div>
        
        {newApiKey && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Text size="SM" className="text-green-800 mb-2">
              New API key generated successfully! Please copy and store it securely.
            </Text>
            <Input
              type="text"
              value={newApiKey}
              readOnly
              className="tracking-widest font-mono"
              endSlot={
                <Button
                  variant="white"
                  size="icon"
                  className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                  onClick={() => copyText(newApiKey)}
                >
                  <Clipboard />
                </Button>
              }
            />
          </div>
        )}
        
        {rotationError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <Text size="SM" className="text-red-800">
              {rotationError}
            </Text>
          </div>
        )}
        
        <Input
          id="apiKey"
          type={apiKeyVisible && isNewKey ? 'text' : 'password'}
          className={apiKeyVisible && isNewKey ? 'tracking-widest' : undefined}
          value={
            isNewKey && apiKeyVisible 
              ? displayApiKey 
              : isKeyHidden 
                ? '••••••••••••••••••••••••••••••••••••••••'
                : displayApiKey
          }
          disabled
          endSlot={
            <div className="flex">
              <Button
                variant="white"
                size="icon"
                className="h-[2.875rem] rounded-none rounded-l-none border-l-0"
                disabled={!isNewKey}
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
              >
                {apiKeyVisible ? <Eye /> : <EyeClosed />}
              </Button>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="white"
                    size="icon"
                    className="h-[2.875rem] rounded-none rounded-r-lg border-l-0"
                    disabled={!isNewKey}
                    onClick={() => copyText(displayApiKey)}
                  >
                    <Clipboard />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isNewKey ? 'Copy to clipboard' : 'Key is hidden for security'}
                </TooltipContent>
              </Tooltip>
            </div>
          }
        />
        
        {isNewKey && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Important: Save your API key now
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    This is the only time you'll see your API key in plain text. 
                    We only store a hash value for security. Please copy and save this key securely.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <Heading>Webhook Signature Verification Key</Heading>
          <Button
            variant="outline"
            size="sm"
            onClick={confirmWebhookKeyRotation}
            disabled={isRotatingWebhookKey}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {isRotatingWebhookKey ? 'Generating...' : 'Generate new key'}
          </Button>
        </div>
        <Text size="SM">
          This is your webhook signature verification key. We will include a
          signature in every HTTP request we send to you in case you'd like to
          verify that the request is valid and came from Coop. To learn how to
          verify requests with this secret, see our{' '}
          <Link
            href="https://roostorg.github.io/coop/api_authentication.html#verifying-incoming-requests-from-coop"
            target="_blank"
          >
            API Keys and Authentication
          </Link>
          .
        </Text>
      </div>

      {newWebhookSigningKey && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <Text size="SM" className="text-green-800 mb-2">
            New webhook signature verification key generated. Copy and store it
            securely; future webhook requests will be signed with the new key.
          </Text>
          <Textarea
            className="h-44 font-mono text-sm mb-2"
            value={newWebhookSigningKey}
            readOnly
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              copyText(newWebhookSigningKey);
              setWebhookKeyCopied(true);
              setTimeout(() => setWebhookKeyCopied(false), 2000);
            }}
            className="flex items-center gap-2"
          >
            <Clipboard className="h-4 w-4" />
            {webhookKeyCopied ? 'Copied!' : 'Copy to clipboard'}
          </Button>
        </div>
      )}

      {webhookKeyRotationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text size="SM" className="text-red-800">
            {webhookKeyRotationError}
          </Text>
        </div>
      )}

      <div className="flex flex-col	gap-2">
        <Label htmlFor="publicSigningKey">Key</Label>
        <Textarea
          id="publicSigningKey"
          className="h-44"
          value={publicSigningKey}
          disabled
          endSlot={
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="white"
                  size="icon"
                  className="rounded-none rounded-r-lg border-l-0"
                  onClick={() => copyText(publicSigningKey)}
                >
                  <Clipboard />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy to clipboard</TooltipContent>
            </Tooltip>
          }
        />
      </div>
      
      {/* API Key rotation confirmation dialog */}
      {showRotationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <Heading size="LG" className="mb-4">
              Rotate API Key
            </Heading>
            <Text size="SM" className="mb-6">
              Are you sure you want to rotate your API key? This will generate a new key and 
              deactivate the current one. Make sure to update any applications using the current key.
            </Text>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRotationDialog(false)}
                disabled={isRotating}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleRotateApiKey}
                disabled={isRotating}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isRotating ? 'Rotating...' : 'Rotate Key'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook signing key rotation confirmation dialog */}
      {showWebhookDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <Heading size="LG" className="mb-4">
              Generate new webhook verification key
            </Heading>
            <Text size="SM" className="mb-6">
              This will generate a new webhook signature verification key. The current key will stop
              working for verifying new webhook requests. Update your systems with the new key after
              generating it.
            </Text>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowWebhookKeyRotationDialog(false)}
                disabled={isRotatingWebhookKey}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={onConfirmWebhookRotation}
                disabled={isRotatingWebhookKey}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isRotatingWebhookKey ? 'Generating...' : 'Generate new key'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiAuthenticationSettings;
