import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Switch } from '@/coop-ui/Switch';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLDeploymentSettingsQuery,
  useGQLUpdateAllowMultiplePoliciesPerActionMutation,
  useGQLUpdateHasReportingRulesEnabledMutation,
  useGQLUpdatePartialItemsSettingsMutation,
  useGQLUpdateUserStrikeTtlMutation,
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

export default function OtherTab() {
  const { data, loading, error, refetch } = useGQLDeploymentSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  const org = data?.myOrg;

  const [reportingEnabled, setReportingEnabled] = useState(false);
  const [multiPolicy, setMultiPolicy] = useState(false);
  const [strikeTTL, setStrikeTTL] = useState('');
  const [partialItemsEndpoint, setPartialItemsEndpoint] = useState('');
  const [partialItemsHeaders, setPartialItemsHeaders] = useState('');

  const origPartialItemsHeaders = org?.partialItemsRequestHeaders
    ? prettyPrintJsonValue(org.partialItemsRequestHeaders)
    : '';

  useEffect(() => {
    if (org) {
      setReportingEnabled(org.hasReportingRulesEnabled);
      setMultiPolicy(org.allowMultiplePoliciesPerAction);
      setStrikeTTL(String(org.userStrikeTTL));
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
      toast.success('Other settings updated');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update settings');
    },
  };

  const [updateReporting] =
    useGQLUpdateHasReportingRulesEnabledMutation(mutationOpts);
  const [updateMultiPolicyMutation] =
    useGQLUpdateAllowMultiplePoliciesPerActionMutation(mutationOpts);
  const [updateStrikeTTL, { loading: strikeSaveLoading }] =
    useGQLUpdateUserStrikeTtlMutation(mutationOpts);
  const [updatePartialItems, { loading: partialItemsSaveLoading }] =
    useGQLUpdatePartialItemsSettingsMutation(mutationOpts);

  if (loading) return <FullScreenLoading />;
  if (error || !org) return <div>Error loading settings</div>;

  const isHeadersValid = validateJSON(partialItemsHeaders);
  const isEndpointValid = isValidUrl(partialItemsEndpoint);
  const saveLoading = strikeSaveLoading || partialItemsSaveLoading;

  const partialItemsChanged =
    partialItemsEndpoint !== (org.partialItemsEndpoint ?? '') ||
    partialItemsHeaders !== origPartialItemsHeaders;

  const hasChanges =
    reportingEnabled !== org.hasReportingRulesEnabled ||
    multiPolicy !== org.allowMultiplePoliciesPerAction ||
    strikeTTL !== String(org.userStrikeTTL) ||
    partialItemsChanged;

  const handleSave = () => {
    if (reportingEnabled !== org.hasReportingRulesEnabled) {
      updateReporting({ variables: { enabled: reportingEnabled } });
    }
    if (multiPolicy !== org.allowMultiplePoliciesPerAction) {
      updateMultiPolicyMutation({ variables: { enabled: multiPolicy } });
    }
    if (strikeTTL !== String(org.userStrikeTTL)) {
      updateStrikeTTL({
        variables: {
          input: { ttlDays: strikeTTL ? Number(strikeTTL) : 0 },
        },
      });
    }
    if (partialItemsChanged) {
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

      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Other Settings
          </Heading>
        </div>

        <div className="flex flex-col gap-5">
          {/*
            Reporting Rules are temporarily hidden from the UI while the
            feature is being reworked. Restore this toggle to re-enable.
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Enable Reporting Rules
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Activates Report Rules for proactive responses to user reports
              </Text>
            </div>
            <Switch
              checked={reportingEnabled}
              onCheckedChange={setReportingEnabled}
            />
          </div>
          */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Multiple Policies Per Action
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Allows job decisions to reference multiple policies
              </Text>
            </div>
            <Switch checked={multiPolicy} onCheckedChange={setMultiPolicy} />
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                User Strike TTL (Days)
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Number of days before user strikes expire
              </Text>
            </div>
            <div className="w-32 shrink-0">
              <Input
                type="number"
                min={1}
                value={strikeTTL}
                onChange={(e) => setStrikeTTL(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          disabled={
            !hasChanges ||
            saveLoading ||
            (Boolean(strikeTTL) && Number(strikeTTL) < 1) ||
            !isHeadersValid ||
            !isEndpointValid
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
