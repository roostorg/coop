import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Switch } from '@/coop-ui/Switch';
import { gql } from '@apollo/client';
import { notification } from 'antd';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import FormHeader from '../components/FormHeader';

import {
  useGQLManualReviewSafetySettingsQuery,
  useGQLSetModeratorSafetySettingsMutation,
} from '../../../graphql/generated';
import GoldenRetrieverPuppies from '../../../images/GoldenRetrieverPuppies.png';
import {
  BLUR_LEVELS,
  BlurStrength,
} from './manual_review_job/v2/ncmec/NCMECMediaViewer';

gql`
  query ManualReviewSafetySettings {
    me {
      interfacePreferences {
        moderatorSafetyMuteVideo
        moderatorSafetyGrayscale
        moderatorSafetyBlurLevel
      }
    }
  }

  mutation SetModeratorSafetySettings(
    $moderatorSafetySettings: ModeratorSafetySettingsInput!
  ) {
    setModeratorSafetySettings(
      moderatorSafetySettings: $moderatorSafetySettings
    ) {
      _
    }
  }
`;

export default function ManualReviewSafetySettings() {
  const [settings, setSettings] = useState<{
    moderatorSafetyBlurLevel: BlurStrength;
    moderatorSafetyGrayscale: boolean;
    moderatorSafetyMuteVideo: boolean;
  }>({
    moderatorSafetyBlurLevel: 2,
    moderatorSafetyGrayscale: true,
    moderatorSafetyMuteVideo: true,
  });
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  const { loading, error, data } = useGQLManualReviewSafetySettingsQuery();

  const [saveSafetySettings, { loading: mutationLoading }] =
    useGQLSetModeratorSafetySettingsMutation({
      onCompleted: () =>
        notificationApi.success({ message: 'Safety settings saved!' }),
      onError() {
        notificationApi.error({
          message: 'Your safety settings failed to save. Please try again.',
        });
      },
    });

  useEffect(() => {
    if (!data?.me?.interfacePreferences) {
      return;
    }
    const {
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel,
    } = data.me.interfacePreferences;
    setSettings({
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel: moderatorSafetyBlurLevel as BlurStrength,
    });
  }, [data?.me?.interfacePreferences]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error || !data?.me?.interfacePreferences) {
    throw error ?? new Error('Could not load safety settings');
  }

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Safety Settings</title>
      </Helmet>
      <FormHeader
        title="Personalize Your Safety Settings"
        subtitle="These will be your personal default settings. Every time you view a reported image or video in Coop, these settings will be automatically applied."
      />
      <div className="my-8 divider" />
      <div className="flex gap-8">
        <div className="flex flex-col justify-center">
          <div className="mb-4 text-lg font-medium text-slate-700">
            My Safety Settings
          </div>
          <div className="flex items-center h-10 gap-2">
            <Label htmlFor="blur">Blur</Label>
            <Slider
              id="blur"
              min={0}
              max={Object.keys(BLUR_LEVELS).length - 1}
              onValueChange={([strength]) =>
                setSettings({
                  ...settings,
                  moderatorSafetyBlurLevel: strength as BlurStrength,
                })
              }
              value={[settings.moderatorSafetyBlurLevel]}
              step={1}
            />
          </div>
          <div className="flex items-center h-10">
            <div className="flex items-center space-x-2">
              <Switch
                id="grayscale"
                defaultChecked
                onCheckedChange={(value) =>
                  setSettings({
                    ...settings,
                    moderatorSafetyGrayscale: value,
                  })
                }
                checked={settings.moderatorSafetyGrayscale}
              />
              <Label htmlFor="grayscale">Grayscale</Label>
            </div>
          </div>
          <div className="flex items-center h-10">
            <div className="flex items-center space-x-2">
              <Switch
                id="mute-videos"
                defaultChecked
                onCheckedChange={(value) =>
                  setSettings({
                    ...settings,
                    moderatorSafetyMuteVideo: value,
                  })
                }
                checked={settings.moderatorSafetyMuteVideo}
              />
              <Label htmlFor="mute-videos">Mute Videos</Label>
            </div>
          </div>
        </div>
        <img
          className={`rounded object-scale-down w-96 h-60 ${
            settings.moderatorSafetyBlurLevel != null
              ? BLUR_LEVELS[settings.moderatorSafetyBlurLevel]
              : 'blur-sm'
          } ${settings.moderatorSafetyGrayscale ? 'grayscale' : ''}`}
          alt="puppies"
          src={GoldenRetrieverPuppies}
        />
      </div>
      <div className="my-8 divider" />
      <div className="flex justify-start">
        <CoopButton
          title="Save"
          loading={mutationLoading}
          onClick={() => {
            saveSafetySettings({
              variables: {
                moderatorSafetySettings: settings,
              },
            });
          }}
        />
      </div>
      {notificationContextHolder}
    </div>
  );
}
