import { Button } from '@/coop-ui/Button';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import type { GQLNcmecInternetDetailType } from '@/graphql/generated';
import {
  useGQLNcmecOrgSettingsQuery,
  useGQLUpdateNcmecOrgSettingsMutation,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  query NcmecOrgSettings {
    ncmecOrgSettings {
      username
      password
      contactEmail
      moreInfoUrl
      companyTemplate
      legalUrl
      ncmecPreservationEndpoint
      ncmecAdditionalInfoEndpoint
      defaultNcmecQueueId
      defaultInternetDetailType
      termsOfService
      contactPersonEmail
      contactPersonFirstName
      contactPersonLastName
      contactPersonPhone
    }
    myOrg {
      hasNCMECReportingEnabled
      mrtQueues {
        id
        name
      }
    }
  }

  mutation UpdateNcmecOrgSettings($input: NcmecOrgSettingsInput!) {
    updateNcmecOrgSettings(input: $input) {
      success
    }
  }
`;

type NcmecSettings = {
  username: string;
  password: string;
  contactEmail: string;
  moreInfoUrl: string;
  companyTemplate: string;
  legalUrl: string;
  ncmecPreservationEndpoint: string;
  ncmecAdditionalInfoEndpoint: string;
  defaultNcmecQueueId: string;
  defaultInternetDetailType: string;
  termsOfService: string;
  contactPersonEmail: string;
  contactPersonFirstName: string;
  contactPersonLastName: string;
  contactPersonPhone: string;
};

export default function NCMECSettings() {
  const [settings, setSettings] = useState<NcmecSettings>({
    username: '',
    password: '',
    contactEmail: '',
    moreInfoUrl: '',
    companyTemplate: '',
    legalUrl: '',
    ncmecPreservationEndpoint: '',
    ncmecAdditionalInfoEndpoint: '',
    defaultNcmecQueueId: '',
    defaultInternetDetailType: '',
    termsOfService: '',
    contactPersonEmail: '',
    contactPersonFirstName: '',
    contactPersonLastName: '',
    contactPersonPhone: '',
  });

  const { loading, error, data } = useGQLNcmecOrgSettingsQuery();

  const [updateSettings, { loading: isUpdateLoading }] =
    useGQLUpdateNcmecOrgSettingsMutation({
      onCompleted: () => {
        toast.success('NCMEC settings saved successfully!');
      },
      onError: (err) => {
        toast.error(
          `Failed to save NCMEC settings: ${err.message}. Please try again.`,
        );
      },
    });

  useEffect(() => {
    if (data?.ncmecOrgSettings) {
      setSettings({
        username: data.ncmecOrgSettings.username ?? '',
        password: data.ncmecOrgSettings.password ?? '',
        contactEmail: data.ncmecOrgSettings.contactEmail ?? '',
        moreInfoUrl: data.ncmecOrgSettings.moreInfoUrl ?? '',
        companyTemplate: data.ncmecOrgSettings.companyTemplate ?? '',
        legalUrl: data.ncmecOrgSettings.legalUrl ?? '',
        ncmecPreservationEndpoint:
          data.ncmecOrgSettings.ncmecPreservationEndpoint ?? '',
        ncmecAdditionalInfoEndpoint:
          data.ncmecOrgSettings.ncmecAdditionalInfoEndpoint ?? '',
        defaultNcmecQueueId:
          data.ncmecOrgSettings.defaultNcmecQueueId ?? '',
        defaultInternetDetailType:
          data.ncmecOrgSettings.defaultInternetDetailType ?? '',
        termsOfService: data.ncmecOrgSettings.termsOfService ?? '',
        contactPersonEmail: data.ncmecOrgSettings.contactPersonEmail ?? '',
        contactPersonFirstName:
          data.ncmecOrgSettings.contactPersonFirstName ?? '',
        contactPersonLastName: data.ncmecOrgSettings.contactPersonLastName ?? '',
        contactPersonPhone: data.ncmecOrgSettings.contactPersonPhone ?? '',
      });
    }
  }, [data?.ncmecOrgSettings]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    throw error;
  }

  const isNCMECEnabled = data?.myOrg?.hasNCMECReportingEnabled ?? false;

  const handleSave = () => {
    // Validate required fields
    if (!settings.username || !settings.password) {
      toast.error('Username and Password are required.');
      return;
    }
    
    if (!settings.companyTemplate || !settings.legalUrl) {
      toast.error('Company Template and Legal URL are required for NCMEC reporting.');
      return;
    }
    
    updateSettings({
      variables: {
        input: {
          username: settings.username,
          password: settings.password,
          contactEmail: settings.contactEmail || null,
          moreInfoUrl: settings.moreInfoUrl || null,
          companyTemplate: settings.companyTemplate || null,
          legalUrl: settings.legalUrl || null,
          ncmecPreservationEndpoint:
            settings.ncmecPreservationEndpoint || null,
          ncmecAdditionalInfoEndpoint:
            settings.ncmecAdditionalInfoEndpoint || null,
          defaultNcmecQueueId: settings.defaultNcmecQueueId || null,
          defaultInternetDetailType: settings.defaultInternetDetailType
            ? (settings.defaultInternetDetailType as GQLNcmecInternetDetailType)
            : null,
          termsOfService: settings.termsOfService || null,
          contactPersonEmail: settings.contactPersonEmail || null,
          contactPersonFirstName: settings.contactPersonFirstName || null,
          contactPersonLastName: settings.contactPersonLastName || null,
          contactPersonPhone: settings.contactPersonPhone || null,
        },
      },
    });
  };

  return (
    <>
      <Helmet>
        <title>NCMEC Settings</title>
      </Helmet>

      <div className="w-[700px]">
        <Heading size="2XL" className="mb-2">
          NCMEC Reporting Settings
        </Heading>
        <Text size="SM" className="mb-4">
          Configure your organization's NCMEC (National Center for Missing &
          Exploited Children) reporting settings. These credentials will be used
          when submitting reports to NCMEC CyberTipline.
        </Text>
        
        {!isNCMECEnabled && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <Text size="SM" className="text-blue-800">
              <strong>NCMEC reporting is not yet enabled.</strong> Fill in the
              required credentials below and click "Save Settings" to enable
              NCMEC reporting for your organization.
            </Text>
          </div>
        )}
        
        {isNCMECEnabled && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
            <Text size="SM" className="text-green-800">
              <strong>✓ NCMEC reporting is enabled</strong> for your
              organization.
            </Text>
          </div>
        )}

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              type="text"
              value={settings.username}
              onChange={(e) =>
                setSettings({ ...settings, username: e.target.value })
              }
              placeholder="NCMEC CyberTipline username"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={settings.password}
              onChange={(e) =>
                setSettings({ ...settings, password: e.target.value })
              }
              placeholder="NCMEC CyberTipline password"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="companyTemplate" className="text-sm font-medium">
              Company Report Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyTemplate"
              type="text"
              value={settings.companyTemplate}
              onChange={(e) =>
                setSettings({ ...settings, companyTemplate: e.target.value })
              }
              placeholder="Your company name (e.g., 'Acme Corp')"
              required
            />
            <Text size="XS" className="text-gray-500">
              Your organization name as it will appear in NCMEC reports
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="legalUrl" className="text-sm font-medium">
              Legal URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="legalUrl"
              type="url"
              value={settings.legalUrl}
              onChange={(e) =>
                setSettings({ ...settings, legalUrl: e.target.value })
              }
              placeholder="https://yourcompany.com/terms"
              required
            />
            <Text size="XS" className="text-gray-500">
              URL to your Terms of Service or legal policies
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium">
              Contact Email
            </Label>
            <Input
              id="contactEmail"
              type="email"
              value={settings.contactEmail}
              onChange={(e) =>
                setSettings({ ...settings, contactEmail: e.target.value })
              }
              placeholder="contact@yourcompany.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="termsOfService" className="text-sm font-medium">
              Terms of Service
            </Label>
            <textarea
              id="termsOfService"
              maxLength={3000}
              value={settings.termsOfService}
              onChange={(e) =>
                setSettings({ ...settings, termsOfService: e.target.value })
              }
              placeholder="e.g. Child abuse and CSAM are not allowed on our platform."
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
            />
            <Text size="XS" className="text-gray-500">
              Optional TOS line included in the CyberTip reporter. {settings.termsOfService.length}/3000 characters.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">
              Contact person (for law enforcement)
            </Label>
            <Text size="XS" className="text-gray-500 mb-1">
              Person law enforcement can contact other than the reporting person. All fields optional.
            </Text>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="contactPersonFirstName"
                type="text"
                value={settings.contactPersonFirstName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    contactPersonFirstName: e.target.value,
                  })
                }
                placeholder="First name"
              />
              <Input
                id="contactPersonLastName"
                type="text"
                value={settings.contactPersonLastName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    contactPersonLastName: e.target.value,
                  })
                }
                placeholder="Last name"
              />
            </div>
            <Input
              id="contactPersonEmail"
              type="email"
              value={settings.contactPersonEmail}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  contactPersonEmail: e.target.value,
                })
              }
              placeholder="Email"
            />
            <Input
              id="contactPersonPhone"
              type="tel"
              value={settings.contactPersonPhone}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  contactPersonPhone: e.target.value,
                })
              }
              placeholder="Phone"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="moreInfoUrl" className="text-sm font-medium">
              More Info URL
            </Label>
            <Input
              id="moreInfoUrl"
              type="url"
              value={settings.moreInfoUrl}
              onChange={(e) =>
                setSettings({ ...settings, moreInfoUrl: e.target.value })
              }
              placeholder="https://yourcompany.com/ncmec-info"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="defaultNcmecQueueId"
              className="text-sm font-medium"
            >
              Default NCMEC queue
            </Label>
            <Select
              value={settings.defaultNcmecQueueId || '__default__'}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  defaultNcmecQueueId:
                    value === '__default__' ? '' : value,
                })
              }
            >
              <SelectTrigger id="defaultNcmecQueueId">
                <SelectValue placeholder="Use org default queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">
                  Use org default queue
                </SelectItem>
                {(data?.myOrg?.mrtQueues ?? []).map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Text size="XS" className="text-gray-500">
              When reviewers choose &quot;Enqueue to NCMEC&quot;, jobs will be
              sent to this queue. Leave as &quot;Use org default queue&quot; to
              use the organization&apos;s default manual review queue.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="defaultInternetDetailType"
              className="text-sm font-medium"
            >
              Default internet detail type
            </Label>
            <Select
              value={settings.defaultInternetDetailType || '__none__'}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  defaultInternetDetailType:
                    value === '__none__' ? '' : value,
                })
              }
            >
              <SelectTrigger id="defaultInternetDetailType">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No default</SelectItem>
                <SelectItem value="WEB_PAGE">Web page</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="NEWSGROUP">Newsgroup</SelectItem>
                <SelectItem value="CHAT_IM">Chat / IM</SelectItem>
                <SelectItem value="ONLINE_GAMING">Online gaming</SelectItem>
                <SelectItem value="CELL_PHONE">Cell phone</SelectItem>
                <SelectItem value="NON_INTERNET">Non-internet</SelectItem>
                <SelectItem value="PEER_TO_PEER">Peer-to-peer</SelectItem>
              </SelectContent>
            </Select>
            <Text size="XS" className="text-gray-500">
              Incident context (channel/medium) for CyberTip reports. When set,
              each report will include this in internetDetails. For &quot;Web
              page&quot;, the More Info URL above is used if set.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="ncmecPreservationEndpoint"
              className="text-sm font-medium"
            >
              NCMEC Preservation Endpoint
            </Label>
            <Input
              id="ncmecPreservationEndpoint"
              type="url"
              value={settings.ncmecPreservationEndpoint}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ncmecPreservationEndpoint: e.target.value,
                })
              }
              placeholder="https://api.yourcompany.com/ncmec/preservation"
            />
            <Text size="XS" className="text-gray-500">
              Optional: Webhook endpoint for NCMEC preservation requests after reporting
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="ncmecAdditionalInfoEndpoint"
              className="text-sm font-medium"
            >
              NCMEC Additional Info Endpoint
            </Label>
            <Input
              id="ncmecAdditionalInfoEndpoint"
              type="url"
              value={settings.ncmecAdditionalInfoEndpoint}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ncmecAdditionalInfoEndpoint: e.target.value,
                })
              }
              placeholder="https://api.yourcompany.com/ncmec/additional-info"
            />
            <Text size="XS" className="text-gray-500">
              Optional: Webhook endpoint for NCMEC additional information
              requests for the users and media in the report.
            </Text>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            loading={isUpdateLoading}
            onClick={handleSave}
            disabled={!settings.username || !settings.password}
          >
            {isNCMECEnabled ? 'Update Settings' : 'Enable NCMEC & Save Settings'}
          </Button>
        </div>
        
        {!isNCMECEnabled && (
          <Text size="XS" className="mt-4 text-gray-600">
            Note: Saving these settings will enable NCMEC reporting for your
            organization. Reporting will only work if the organization has a manual review queue and content is only reported if it is flagged during review.
          </Text>
        )}
      </div>
    </>
  );
}

