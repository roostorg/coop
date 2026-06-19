import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Switch } from '@/coop-ui/Switch';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLDeploymentSettingsQuery,
  useGQLUpdateHideSkipButtonForNonAdminsMutation,
  useGQLUpdateIgnoreCallbackUrlMutation,
  useGQLUpdatePreviewJobsViewEnabledMutation,
  useGQLUpdateRequiresDecisionReasonMutation,
  useGQLUpdateRequiresPolicyForDecisionsMutation,
} from '@/graphql/generated';
import { isValidUrl } from '@/lib/utils';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

export default function ReviewConsoleTab() {
  const { data, loading, error, refetch } = useGQLDeploymentSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  const org = data?.myOrg;

  const [requirePolicy, setRequirePolicy] = useState(false);
  const [requireReason, setRequireReason] = useState(false);
  const [hideSkip, setHideSkip] = useState(false);
  const [previewJobs, setPreviewJobs] = useState(false);
  const [ignoreCallbackUrl, setIgnoreCallbackUrl] = useState('');

  useEffect(() => {
    if (org) {
      setRequirePolicy(org.requiresPolicyForDecisionsInMrt);
      setRequireReason(org.requiresDecisionReasonInMrt);
      setHideSkip(org.hideSkipButtonForNonAdmins);
      setPreviewJobs(org.previewJobsViewEnabled);
      setIgnoreCallbackUrl(org.ignoreCallbackUrl ?? '');
    }
  }, [org]);

  const mutationOpts = {
    onCompleted: () => {
      toast.success('Review console settings updated');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update review console settings');
    },
  };

  const [updateRequirePolicy, { loading: requirePolicyLoading }] =
    useGQLUpdateRequiresPolicyForDecisionsMutation(mutationOpts);
  const [updateRequireReason, { loading: requireReasonLoading }] =
    useGQLUpdateRequiresDecisionReasonMutation(mutationOpts);
  const [updateHideSkipMutation, { loading: hideSkipLoading }] =
    useGQLUpdateHideSkipButtonForNonAdminsMutation(mutationOpts);
  const [updatePreviewJobsMutation, { loading: previewJobsLoading }] =
    useGQLUpdatePreviewJobsViewEnabledMutation(mutationOpts);
  const [updateIgnoreUrl, { loading: ignoreUrlLoading }] =
    useGQLUpdateIgnoreCallbackUrlMutation(mutationOpts);
  if (loading) return <FullScreenLoading />;
  if (error || !org) return <div>Error loading review console settings</div>;

  const saveLoading =
    requirePolicyLoading ||
    requireReasonLoading ||
    hideSkipLoading ||
    previewJobsLoading ||
    ignoreUrlLoading;

  const hasChanges =
    requirePolicy !== org.requiresPolicyForDecisionsInMrt ||
    requireReason !== org.requiresDecisionReasonInMrt ||
    hideSkip !== org.hideSkipButtonForNonAdmins ||
    previewJobs !== org.previewJobsViewEnabled ||
    ignoreCallbackUrl !== (org.ignoreCallbackUrl ?? '');

  const handleSave = () => {
    if (requirePolicy !== org.requiresPolicyForDecisionsInMrt) {
      updateRequirePolicy({ variables: { enabled: requirePolicy } });
    }
    if (requireReason !== org.requiresDecisionReasonInMrt) {
      updateRequireReason({ variables: { enabled: requireReason } });
    }
    if (hideSkip !== org.hideSkipButtonForNonAdmins) {
      updateHideSkipMutation({ variables: { enabled: hideSkip } });
    }
    if (previewJobs !== org.previewJobsViewEnabled) {
      updatePreviewJobsMutation({ variables: { enabled: previewJobs } });
    }
    if (ignoreCallbackUrl !== (org.ignoreCallbackUrl ?? '')) {
      updateIgnoreUrl({
        variables: { url: ignoreCallbackUrl || null },
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Moderator Requirements
          </Heading>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Require Policy for Decisions
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Moderators must choose a policy when performing a job action
              </Text>
            </div>
            <Switch
              checked={requirePolicy}
              onCheckedChange={setRequirePolicy}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Require Decision Reason
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Moderators must provide a written decision when completing a job
              </Text>
            </div>
            <Switch
              checked={requireReason}
              onCheckedChange={setRequireReason}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Queue Management
          </Heading>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Hide Skip Button for Non-Admins
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Non-admins must work jobs in order and may not skip a job
              </Text>
            </div>
            <Switch checked={hideSkip} onCheckedChange={setHideSkip} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Enable Preview Jobs View
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Anyone who can edit queues may preview a queue without claiming
                a job
              </Text>
            </div>
            <Switch checked={previewJobs} onCheckedChange={setPreviewJobs} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading size="2XL" weight="semibold">
            Webhooks
          </Heading>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Text size="SM" weight="medium">
                Ignore Callback URL
              </Text>
              <Text className="text-gray-500 mt-[.31rem] text-[0.8125rem]">
                Where to send a webhook with item data when a job is ignored
              </Text>
            </div>
            <div className="w-80 shrink-0">
              <Input
                placeholder="https://example.com/webhook/ignore"
                value={ignoreCallbackUrl}
                onChange={(e) => setIgnoreCallbackUrl(e.target.value)}
              />
              {ignoreCallbackUrl && !isValidUrl(ignoreCallbackUrl) && (
                <Text size="SM" className="text-red-500 mt-1">
                  Must be a valid URL
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          disabled={
            !hasChanges || saveLoading || !isValidUrl(ignoreCallbackUrl)
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
