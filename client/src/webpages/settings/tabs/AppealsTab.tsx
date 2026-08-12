import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Switch } from '@/coop-ui/Switch';
import { Textarea } from '@/coop-ui/Textarea';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLDeploymentSettingsQuery,
  useGQLUpdateAppealSettingsMutation,
  useGQLUpdateHasAppealsEnabledMutation,
} from '@/graphql/generated';
import { isValidUrl, validateJSON } from '@/lib/utils';
import { prettyPrintJsonValue } from '@/utils/string';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  mutation UpdateAppealSettings($input: AppealSettingsInput!) {
    updateAppealSettings(input: $input) {
      appealsCallbackUrl
      appealsCallbackHeaders
      appealsCallbackBody
    }
  }
`;

export default function AppealsTab() {
  const { data, loading, error, refetch } = useGQLDeploymentSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  const org = data?.myOrg;
  const appealSettings = data?.appealSettings;

  const [appealsEnabled, setAppealsEnabled] = useState(false);
  const [appealsCallbackUrl, setAppealsCallbackUrl] = useState('');
  const [appealsCallbackHeaders, setAppealsCallbackHeaders] = useState('');
  const [appealsCallbackBody, setAppealsCallbackBody] = useState('');

  useEffect(() => {
    if (org) {
      setAppealsEnabled(org.hasAppealsEnabled);
    }
    if (appealSettings) {
      setAppealsCallbackUrl(appealSettings.appealsCallbackUrl ?? '');
      setAppealsCallbackHeaders(
        appealSettings.appealsCallbackHeaders
          ? prettyPrintJsonValue(appealSettings.appealsCallbackHeaders)
          : '',
      );
      setAppealsCallbackBody(
        appealSettings.appealsCallbackBody
          ? prettyPrintJsonValue(appealSettings.appealsCallbackBody)
          : '',
      );
    }
  }, [org, appealSettings]);

  const mutationOpts = {
    onCompleted: () => {
      toast.success('Appeal settings updated');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update appeal settings');
    },
  };

  const [updateAppealsEnabled] =
    useGQLUpdateHasAppealsEnabledMutation(mutationOpts);
  const [updateAppealSettings, { loading: appealSaveLoading }] =
    useGQLUpdateAppealSettingsMutation(mutationOpts);

  if (loading) return <FullScreenLoading />;
  if (error || !org) return <div>Error loading appeal settings</div>;

  const isHeadersValid = validateJSON(appealsCallbackHeaders);
  const isBodyValid = validateJSON(appealsCallbackBody);

  const origHeaders = appealSettings?.appealsCallbackHeaders
    ? prettyPrintJsonValue(appealSettings.appealsCallbackHeaders)
    : '';
  const origBody = appealSettings?.appealsCallbackBody
    ? prettyPrintJsonValue(appealSettings.appealsCallbackBody)
    : '';

  const hasChanges =
    appealsEnabled !== org.hasAppealsEnabled ||
    appealsCallbackUrl !== (appealSettings?.appealsCallbackUrl ?? '') ||
    appealsCallbackHeaders !== origHeaders ||
    appealsCallbackBody !== origBody;

  const handleSave = () => {
    if (appealsEnabled !== org.hasAppealsEnabled) {
      updateAppealsEnabled({ variables: { enabled: appealsEnabled } });
    }
    if (
      appealsCallbackUrl !== (appealSettings?.appealsCallbackUrl ?? '') ||
      appealsCallbackHeaders !== origHeaders ||
      appealsCallbackBody !== origBody
    ) {
      updateAppealSettings({
        variables: {
          input: {
            appealsCallbackUrl: appealsCallbackUrl || null,
            appealsCallbackHeaders: appealsCallbackHeaders
              ? JSON.parse(appealsCallbackHeaders)
              : null,
            appealsCallbackBody: appealsCallbackBody
              ? JSON.parse(appealsCallbackBody)
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
            Appeals
          </Heading>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Enable Appeals
              </Text>
              <Text className="text-[0.8125rem] text-gray-500 mt-[.31rem]">
                Allows users to appeal moderation decisions
              </Text>
            </div>
            <Switch
              checked={appealsEnabled}
              onCheckedChange={setAppealsEnabled}
            />
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Appeal Callback URL
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Webhook URL called when an appeal is submitted
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                placeholder="https://example.com/webhook"
                value={appealsCallbackUrl}
                onChange={(e) => setAppealsCallbackUrl(e.target.value)}
              />
              {appealsCallbackUrl && !isValidUrl(appealsCallbackUrl) && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be a valid URL
                </Text>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Appeal Callback Headers
              </Text>
              <Text className="text-gray-500 text-[0.8125rem] mt-[.31rem]">
                Custom headers sent with appeal webhook requests (JSON format)
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Textarea
                className="h-40 font-mono text-sm"
                placeholder={'{\n  "Authorization": "Bearer YOUR_KEY"\n}'}
                value={appealsCallbackHeaders}
                onChange={(e) => setAppealsCallbackHeaders(e.target.value)}
              />
              {appealsCallbackHeaders && !isHeadersValid && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be valid JSON
                </Text>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Appeal Callback Body
              </Text>
              <Text className="text-[0.8125rem] text-gray-500 mt-[.31rem]">
                Custom body template for appeal webhook requests
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Textarea
                className="h-40 font-mono text-sm"
                placeholder={'{\n  "source": "coop"\n}'}
                value={appealsCallbackBody}
                onChange={(e) => setAppealsCallbackBody(e.target.value)}
              />
              {appealsCallbackBody && !isBodyValid && (
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
            !hasChanges ||
            appealSaveLoading ||
            !isHeadersValid ||
            !isBodyValid ||
            !isValidUrl(appealsCallbackUrl)
          }
          loading={appealSaveLoading}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
