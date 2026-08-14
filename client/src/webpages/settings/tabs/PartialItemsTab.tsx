import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLDeploymentSettingsQuery,
  useGQLUpdatePartialItemsSettingsMutation,
} from '@/graphql/generated';
import { isValidUrl, validateJSON } from '@/lib/utils';
import { prettyPrintJsonValue } from '@/utils/string';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  mutation UpdatePartialItemsSettings(
    $input: UpdatePartialItemsSettingsInput!
  ) {
    updatePartialItemsSettings(input: $input)
  }
`;

export default function PartialItemsTab() {
  const { data, loading, error, refetch } = useGQLDeploymentSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  const org = data?.myOrg;

  const [partialItemsEndpoint, setPartialItemsEndpoint] = useState('');
  const [partialItemsHeaders, setPartialItemsHeaders] = useState('');

  const origPartialItemsHeaders = org?.partialItemsRequestHeaders
    ? prettyPrintJsonValue(org.partialItemsRequestHeaders)
    : '';

  useEffect(() => {
    if (org) {
      setPartialItemsEndpoint(org.partialItemsEndpoint ?? '');
      setPartialItemsHeaders(
        org.partialItemsRequestHeaders
          ? prettyPrintJsonValue(org.partialItemsRequestHeaders)
          : '',
      );
    }
  }, [org]);

  const mutationOpts = {
    onCompleted: () => {
      toast.success('Partial items settings updated');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update settings');
    },
  };

  const [updatePartialItems, { loading: saveLoading }] =
    useGQLUpdatePartialItemsSettingsMutation(mutationOpts);

  if (loading) return <FullScreenLoading />;
  if (error || !org) return <div>Error loading settings</div>;

  const isHeadersValid = validateJSON(partialItemsHeaders);
  const isEndpointValid = isValidUrl(partialItemsEndpoint);

  const hasChanges =
    partialItemsEndpoint !== (org.partialItemsEndpoint ?? '') ||
    partialItemsHeaders !== origPartialItemsHeaders;

  const handleSave = () => {
    if (hasChanges) {
      updatePartialItems({
        variables: {
          input: {
            partialItemsEndpoint: partialItemsEndpoint || null,
            partialItemsRequestHeaders: partialItemsHeaders
              ? JSON.parse(partialItemsHeaders)
              : null,
          },
        },
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Partial Items
          </Heading>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Partial Items Endpoint
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Endpoint for fetching additional item data
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                type="url"
                placeholder="https://api.example.com/items"
                value={partialItemsEndpoint}
                onChange={(e) => setPartialItemsEndpoint(e.target.value)}
              />
              {partialItemsEndpoint && !isEndpointValid && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be a valid URL
                </Text>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Partial Items Request Headers
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Custom headers for partial items requests (JSON format)
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Textarea
                className="h-24 font-mono text-sm"
                placeholder={'{\n  "Authorization": "Bearer YOUR_KEY"\n}'}
                value={partialItemsHeaders}
                onChange={(e) => setPartialItemsHeaders(e.target.value)}
              />
              {partialItemsHeaders && !isHeadersValid && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be valid JSON
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          disabled={
            !hasChanges || saveLoading || !isHeadersValid || !isEndpointValid
          }
          loading={saveLoading}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
