import { gql } from '@apollo/client';
import { Input, notification } from 'antd';
import Link from 'antd/lib/typography/Link';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import FormHeader from '../components/FormHeader';
import FormSectionHeader from '../components/FormSectionHeader';

import {
  useGQLAppealSettingsQuery,
  useGQLUpdateAppealSettingsMutation,
} from '../../../graphql/generated';
import { prettyPrintJsonValue } from '../../../utils/string';

gql`
  query AppealSettings {
    appealSettings {
      appealsCallbackUrl
      appealsCallbackHeaders
      appealsCallbackBody
    }
    me {
      role
    }
  }

  mutation UpdateAppealSettings($input: AppealSettingsInput!) {
    updateAppealSettings(input: $input) {
      appealsCallbackUrl
      appealsCallbackHeaders
      appealsCallbackBody
    }
  }
`;

export default function ManualReviewAppealSettings() {
  const [appealsCallbackUrl, setAppealsCallbackUrl] = useState<
    string | undefined
  >(undefined);
  const [appealsCallbackHeaders, setAppealsCallbackHeaders] = useState<
    string | undefined
  >(undefined);
  const [appealsCallbackBody, setAppealsCallbackBody] = useState<
    string | undefined
  >(undefined);

  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  const { loading, data } = useGQLAppealSettingsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (data?.appealSettings != null) {
      if (data.appealSettings.appealsCallbackUrl != null) {
        setAppealsCallbackUrl(data.appealSettings.appealsCallbackUrl);
      }
      if (data.appealSettings.appealsCallbackHeaders != null) {
        setAppealsCallbackHeaders(
          prettyPrintJsonValue(data.appealSettings.appealsCallbackHeaders),
        );
      }
      if (data.appealSettings.appealsCallbackBody != null) {
        setAppealsCallbackBody(
          prettyPrintJsonValue(data.appealSettings.appealsCallbackBody),
        );
      }
    }
  }, [data]);
  const [updateAppealSettings, { loading: updateLoading }] =
    useGQLUpdateAppealSettingsMutation({
      onCompleted: () =>
        notificationApi.success({ message: 'Settings saved!' }),
      onError() {
        notificationApi.error({
          message: 'Your settings failed to save. Please try again.',
        });
      },
    });

  if (loading) {
    return <FullScreenLoading />;
  }

  const onUpdateAppealSettings = async () =>
    updateAppealSettings({
      variables: {
        input: {
          appealsCallbackUrl,
          appealsCallbackHeaders: JSON.parse(appealsCallbackHeaders ?? '{}'),
          appealsCallbackBody: JSON.parse(appealsCallbackBody ?? '{}'),
        },
      },
    });

  const callbackSectionHeader = (content: string) => (
    <div className="mt-8 mb-1 text-lg font-medium text-gray-900">{content}</div>
  );

  const callbackUrlInput = (
    <div className="flex flex-col justify-start w-1/2 mb-4">
      <FormSectionHeader
        title="Callback URL"
        subtitle="When a moderator reviews a user appeal, we will send a HTTP request to this API endpoint to notify you of the appeal decision and details."
      />
      <Input
        placeholder="https://yourwebsite.com/api/your_action..."
        onChange={(e) => setAppealsCallbackUrl(e.target.value)}
        value={appealsCallbackUrl}
      />
      <div className="my-4 text-base text-zinc-900">
        <span className="font-semibold">Note</span>: For each HTTP request we
        send to that URL, we will include a JSON body with information about the
        appeal. See the{' '}
        <Link href="https://docs.getcoop.com/docs/appeal-api">
          documentation
        </Link>{' '}
        for more information.
      </div>
      {callbackSectionHeader('Headers (Optional)')}
      <div className="mb-4 text-base text-zinc-900">
        If necessary, you can specify HTTP headers that we will attach to every
        request we send to the Callback URL above. For example, if an API key is
        required to access your API, you can add it below, in the normal HTTP
        header JSON format.
      </div>
      <Input.TextArea
        className="mt-3"
        autoSize={{ minRows: 6, maxRows: 24 }}
        placeholder={`{
    "my-header": "SOME_API_KEY",
     ...
          }`}
        onChange={(e) => setAppealsCallbackHeaders(e.target.value)}
        value={appealsCallbackHeaders}
      />
      {callbackSectionHeader('Body (Optional)')}
      <div className="mb-4 text-base text-zinc-900">
        If necessary, you can specify HTTP body parameters that we will attach
        to every request we send to the Callback URL above.
      </div>
      <Input.TextArea
        className="mt-3"
        autoSize={{ minRows: 6, maxRows: 24 }}
        placeholder={`{
    "my-param-1": "SOME_VALUE",
    "my-param-2": "SOME_OTHER_VALUE"
     ...
}`}
        onChange={(e) => setAppealsCallbackBody(e.target.value)}
        value={appealsCallbackBody}
      />
    </div>
  );

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Appeal Settings</title>
      </Helmet>
      <FormHeader title="Configure Your Organization's Appeal Workflow" />
      <div className="divider mb-9" />
      {callbackUrlInput}
      <CoopButton
        title="Save Settings"
        disabled={
          data?.me?.role !== 'ADMIN' ||
          !appealsCallbackUrl ||
          !validateJSON(appealsCallbackHeaders) ||
          !validateJSON(appealsCallbackBody)
        }
        loading={updateLoading}
        disabledTooltipTitle={(() => {
          if (data?.me?.role !== 'ADMIN') {
            return "To edit these settings, ask your organization's admin to upgrade your role to Admin.";
          }
          if (!appealsCallbackUrl) {
            return 'The Callback URL is required.';
          }
          if (!validateJSON(appealsCallbackHeaders)) {
            return 'The Callback Headers must be valid JSON.';
          }
          if (!validateJSON(appealsCallbackBody)) {
            return 'The Callback Body must be valid JSON.';
          }

          return 'Please fill out all required fields correctly.';
        })()}
        disabledTooltipPlacement="top"
        onClick={onUpdateAppealSettings}
      />
      {notificationContextHolder}
    </div>
  );
}

const validateJSON = (value: string | undefined) => {
  // missing is fine.
  if (value == null || value.length === 0) {
    return true;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed != null;
  } catch (e) {
    return false;
  }
};
