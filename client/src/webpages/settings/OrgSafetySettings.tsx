import { Button } from '@/coop-ui/Button';
import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Switch } from '@/coop-ui/Switch';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  useGQLOrgDefaultSafetySettingsQuery,
  useGQLSetOrgDefaultSafetySettingsMutation,
} from '@/graphql/generated';
import GoldenRetrieverPuppies from '@/images/GoldenRetrieverPuppies.png';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  BLUR_LEVELS,
  type BlurStrength,
} from '../dashboard/mrt/manual_review_job/v2/ncmec/NCMECMediaViewer';

gql`
  query OrgDefaultSafetySettings {
    myOrg {
      defaultInterfacePreferences {
        moderatorSafetyMuteVideo
        moderatorSafetyGrayscale
        moderatorSafetyBlurLevel
      }
    }
  }

  mutation SetOrgDefaultSafetySettings(
    $orgDefaultSafetySettings: ModeratorSafetySettingsInput!
  ) {
    setOrgDefaultSafetySettings(
      orgDefaultSafetySettings: $orgDefaultSafetySettings
    ) {
      _
    }
  }
`;

type SafetySettings = {
  moderatorSafetyBlurLevel: BlurStrength;
  moderatorSafetyGrayscale: boolean;
  moderatorSafetyMuteVideo: boolean;
};

export default function ManualReviewSafetySettings() {
  const [safetySettings, setSafetySettings] = useState<SafetySettings>({
    moderatorSafetyBlurLevel: 2,
    moderatorSafetyGrayscale: true,
    moderatorSafetyMuteVideo: true,
  });

  const { loading, error, data } = useGQLOrgDefaultSafetySettingsQuery();

  const [saveSafetySettings, { loading: isSafetySettingsMutationLoading }] =
    useGQLSetOrgDefaultSafetySettingsMutation({
      onCompleted: () => {
        toast.success('Default safety settings saved!');
      },
      onError: () => {
        toast.error(
          "Your organization's safety settings failed to save. Please try again.",
        );
      },
    });

  useEffect(() => {
    if (!data?.myOrg?.defaultInterfacePreferences) {
      return;
    }
    const {
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel,
    } = data.myOrg.defaultInterfacePreferences;
    setSafetySettings({
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel: moderatorSafetyBlurLevel as BlurStrength,
    });
  }, [data?.myOrg?.defaultInterfacePreferences]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error || !data?.myOrg?.defaultInterfacePreferences) {
    throw error ?? new Error('Could not load safety settings');
  }

  return (
    <>
      <Helmet>
        <title>Default Organization Safety Settings</title>
      </Helmet>

      <div className="w-[700px]">
        <Heading size="2XL" className="mb-2">
          Standardize Your Organization's Safety Settings
        </Heading>
        <Text size="SM" className="mb-12">
        Configure your organization's default safety settings. When a new 
        employee joins your team and needs to use Coop, these settings 
        will be applied by default to maintain their safety and well-being. 
        If an employee wants to override these settings, they can do so in 
        their personal Safety Settings.
        </Text>
        <div className="flex gap-12 mb-8">
          <div className="flex flex-col gap-5 w-64 pt-10">
            <div className="flex gap-3 items-center justify-between">
              <Label className="text-sm font-medium leading-none">Blur</Label>
              <Slider
                className="w-32"
                min={0}
                max={Object.keys(BLUR_LEVELS).length - 1}
                onValueChange={([strength]) => {
                  setSafetySettings((prevSettings) => ({
                    ...prevSettings,
                    moderatorSafetyBlurLevel: strength as BlurStrength,
                  }));
                }}
                value={[safetySettings.moderatorSafetyBlurLevel]}
                step={1}
              />
            </div>

            <div className="flex gap-1 items-center justify-between">
              <Label className="text-sm font-medium leading-none">
                Grayscale
              </Label>
              <Switch
                checked={safetySettings.moderatorSafetyGrayscale}
                onCheckedChange={(value) =>
                  setSafetySettings({
                    ...safetySettings,
                    moderatorSafetyGrayscale: value,
                  })
                }
              />
            </div>

            <div className="flex gap-1 items-center justify-between">
              <Label className="text-sm font-medium leading-none">
                Mute Videos
              </Label>
              <Switch
                checked={safetySettings.moderatorSafetyMuteVideo}
                onCheckedChange={(value) =>
                  setSafetySettings({
                    ...safetySettings,
                    moderatorSafetyMuteVideo: value,
                  })
                }
              />
            </div>
          </div>

          <img
            className={`rounded object-scale-down w-72 h-44 ${
              BLUR_LEVELS[safetySettings.moderatorSafetyBlurLevel] ?? 'blur-sm'
            } ${safetySettings.moderatorSafetyGrayscale ? 'grayscale' : ''}`}
            alt="puppies"
            src={GoldenRetrieverPuppies}
          />
        </div>

        <div className="flex gap-2">
          <Button
            loading={isSafetySettingsMutationLoading}
            onClick={() => {
              saveSafetySettings({
                variables: {
                  orgDefaultSafetySettings: safetySettings,
                },
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
