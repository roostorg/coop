import { Button } from '@/coop-ui/Button';
import { Label } from '@/coop-ui/Label';
import { Link } from '@/coop-ui/Link';
import { Textarea } from '@/coop-ui/Textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { Heading, Text } from '@/coop-ui/Typography';
import { Clipboard, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router';

import FullScreenLoading from '../../components/common/FullScreenLoading';

import {
  GQLUserPermission,
  useGQLApiAuthQuery,
  useGQLRotateWebhookSigningKeyMutation,
} from '../../graphql/generated';
import { userHasPermissions } from '../../routing/permissions';
import ApiKeyManagement from './ApiKeyManagement';

const ApiAuthenticationSettings = () => {
  const { data, loading, error, refetch } = useGQLApiAuthQuery();
  const [rotateWebhookSigningKey] = useGQLRotateWebhookSigningKeyMutation();
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
            onClick={async () => {
              await refetch();
            }}
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
    navigate('/dashboard/settings');
    return null;
  }

  const org = data?.myOrg;
  if (!org) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Text size="SM">Unable to load organization. Please try again.</Text>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={async () => {
            await refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const { publicSigningKey } = org;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
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
    <div className="flex flex-col w-full max-w-4xl text-start">
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

      <ApiKeyManagement />
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

      {/* Webhook signing key rotation confirmation dialog */}
      {showWebhookDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <Heading size="LG" className="mb-4">
              Generate new webhook verification key
            </Heading>
            <Text size="SM" className="mb-6">
              This will generate a new webhook signature verification key. The
              current key will stop working for verifying new webhook requests.
              Update your systems with the new key after generating it.
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
