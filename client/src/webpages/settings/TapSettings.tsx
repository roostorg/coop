import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Heading, Text } from '@/coop-ui/Typography';
import { useMutation, useQuery } from '@apollo/client';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../components/common/FullScreenLoading';
import { GQLUserPermission } from '../../graphql/generated';
import {
  TAP_ADD_REPOS_MUTATION,
  TAP_REMOVE_REPOS_MUTATION,
  TAP_STATS_QUERY,
} from '../../graphql/operations/tap';
import { userHasPermissions } from '../../routing/permissions';

interface TapStatsData {
  tapStats: {
    repoCount: number;
    recordCount: number;
    outboxBuffer: number;
    isConnected: boolean;
  } | null;
}

export default function TapSettings() {
  const { data, loading, error, refetch } = useQuery<TapStatsData>(
    TAP_STATS_QUERY,
  );
  const [addRepos] = useMutation(TAP_ADD_REPOS_MUTATION);
  const [removeRepos] = useMutation(TAP_REMOVE_REPOS_MUTATION);

  const [didInput, setDidInput] = useState('');
  const [removeDidInput, setRemoveDidInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 max-w-xl">
        <Heading size="2XL">AT Protocol Firehose (Tap)</Heading>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text size="SM" className="text-red-800">
            {error.message ?? 'Failed to load Tap settings'}
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

  const stats = data?.tapStats;

  const handleAddRepos = async () => {
    const dids = didInput
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (dids.length === 0) return;

    setActionLoading(true);
    setActionMessage(null);
    try {
      const result = await addRepos({ variables: { dids } });
      if (result.data?.tapAddRepos) {
        setActionMessage(`Added ${dids.length} repo(s) to tracking.`);
        setDidInput('');
        await refetch();
      } else {
        setActionMessage('Failed to add repos. Tap may not be running.');
      }
    } catch (err) {
      setActionMessage(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRepos = async () => {
    const dids = removeDidInput
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (dids.length === 0) return;

    setActionLoading(true);
    setActionMessage(null);
    try {
      const result = await removeRepos({ variables: { dids } });
      if (result.data?.tapRemoveRepos) {
        setActionMessage(
          `Removed ${dids.length} repo(s) from tracking.`,
        );
        setRemoveDidInput('');
        await refetch();
      } else {
        setActionMessage(
          'Failed to remove repos. Tap may not be running.',
        );
      }
    } catch (err) {
      setActionMessage(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>AT Protocol Firehose | Coop</title>
      </Helmet>

      <div className="flex flex-col gap-8 max-w-2xl">
        <div>
          <Heading size="2XL">AT Protocol Firehose (Tap)</Heading>
          <Text size="SM" className="mt-1 text-gray-500">
            Manage the AT Protocol firehose connection for ingesting Bluesky
            content.
          </Text>
        </div>

        {/* Status Card */}
        <div className="rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <Heading size="LG">Connection Status</Heading>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refetch();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          {stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md bg-gray-50 p-4">
                <Text size="XS" className="text-gray-500 uppercase">
                  Status
                </Text>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      stats.isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <Text size="LG" weight="medium">
                    {stats.isConnected ? 'Connected' : 'Disconnected'}
                  </Text>
                </div>
              </div>

              <div className="rounded-md bg-gray-50 p-4">
                <Text size="XS" className="text-gray-500 uppercase">
                  Tracked Repos
                </Text>
                <Text size="LG" weight="medium" className="mt-1">
                  {stats.repoCount.toLocaleString()}
                </Text>
              </div>

              <div className="rounded-md bg-gray-50 p-4">
                <Text size="XS" className="text-gray-500 uppercase">
                  Records Processed
                </Text>
                <Text size="LG" weight="medium" className="mt-1">
                  {stats.recordCount.toLocaleString()}
                </Text>
              </div>

              <div className="rounded-md bg-gray-50 p-4">
                <Text size="XS" className="text-gray-500 uppercase">
                  Outbox Buffer
                </Text>
                <Text size="LG" weight="medium" className="mt-1">
                  {stats.outboxBuffer.toLocaleString()}
                </Text>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <Text size="SM" className="text-yellow-800">
                Tap connector is not running. Set TAP_ENABLED=true and
                configure TAP_ORG_ID to enable.
              </Text>
            </div>
          )}
        </div>

        {/* Add Repos */}
        <div className="rounded-lg border border-gray-200 p-6">
          <Heading size="LG" className="mb-4">
            Add Tracked Repos
          </Heading>
          <Text size="SM" className="text-gray-500 mb-4">
            Enter AT Protocol DIDs (one per line or comma-separated) to start
            tracking their content.
          </Text>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="add-dids">DIDs</Label>
              <Input
                id="add-dids"
                placeholder="did:plc:abc123, did:plc:def456"
                value={didInput}
                onChange={(e) => setDidInput(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddRepos}
              disabled={actionLoading || !didInput.trim()}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Repos
            </Button>
          </div>
        </div>

        {/* Remove Repos */}
        <div className="rounded-lg border border-gray-200 p-6">
          <Heading size="LG" className="mb-4">
            Remove Tracked Repos
          </Heading>
          <Text size="SM" className="text-gray-500 mb-4">
            Enter DIDs to stop tracking.
          </Text>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="remove-dids">DIDs</Label>
              <Input
                id="remove-dids"
                placeholder="did:plc:abc123"
                value={removeDidInput}
                onChange={(e) => setRemoveDidInput(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleRemoveRepos}
              disabled={actionLoading || !removeDidInput.trim()}
              size="sm"
            >
              <Minus className="h-4 w-4 mr-1" />
              Remove Repos
            </Button>
          </div>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div
            className={`p-3 rounded-md text-sm ${
              actionMessage.startsWith('Error')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}
          >
            {actionMessage}
          </div>
        )}
      </div>
    </>
  );
}
