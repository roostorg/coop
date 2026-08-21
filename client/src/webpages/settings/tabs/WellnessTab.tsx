import { Button } from '@/coop-ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { Slider } from '@/coop-ui/Slider';
import { Switch } from '@/coop-ui/Switch';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  namedOperations,
  useGQLOrgDefaultSafetySettingsQuery,
  useGQLSetOrgDefaultSafetySettingsMutation,
} from '@/graphql/generated';
import GoldenRetrieverPuppies from '@/images/GoldenRetrieverPuppies.png';
import {
  colorSchemeClassName,
  colorSchemeFromPreferences,
  MODERATOR_SAFETY_COLOR_SCHEME_LABELS,
  MODERATOR_SAFETY_COLOR_SCHEMES,
  preferencesFromColorScheme,
  type ModeratorSafetyColorScheme,
} from '@/models/safetySettings';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  BLUR_LEVELS,
  type BlurStrength,
} from '../../dashboard/mrt/manual_review_job/v2/ncmec/NCMECMediaViewer';

gql`
  query OrgDefaultSafetySettings {
    me {
      permissions
    }
    myOrg {
      defaultInterfacePreferences {
        moderatorSafetyMuteVideo
        moderatorSafetyGrayscale
        moderatorSafetyBlurLevel
        moderatorSafetySepia
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
  moderatorSafetySepia: boolean;
};

export default function WellnessTab() {
  const [safetySettings, setSafetySettings] = useState<SafetySettings>({
    moderatorSafetyBlurLevel: 2,
    moderatorSafetyGrayscale: true,
    moderatorSafetyMuteVideo: true,
    moderatorSafetySepia: false,
  });

  const { loading, error, data } = useGQLOrgDefaultSafetySettingsQuery({
    errorPolicy: 'all',
  });

  const defaultInterfacePreferences = data?.myOrg?.defaultInterfacePreferences;

  const [saveSafetySettings, { loading: isSaving }] =
    useGQLSetOrgDefaultSafetySettingsMutation({
      // The mutation returns no data, so refetch to update the cached
      // baseline that hasChanges compares against.
      refetchQueries: [namedOperations.Query.OrgDefaultSafetySettings],
      onCompleted: () => {
        toast.success('Default wellness settings saved!');
      },
      onError: () => {
        toast.error(
          "Your organization's wellness settings failed to save. Please try again.",
        );
      },
    });

  useEffect(() => {
    if (!defaultInterfacePreferences) return;
    const {
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel,
      moderatorSafetySepia,
    } = defaultInterfacePreferences;
    setSafetySettings({
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel: moderatorSafetyBlurLevel as BlurStrength,
      moderatorSafetySepia,
    });
  }, [defaultInterfacePreferences]);

  if (loading) return <FullScreenLoading />;
  if (error) return <div>Error loading wellness settings</div>;

  const serverPrefs = defaultInterfacePreferences;
  const hasChanges =
    !serverPrefs ||
    safetySettings.moderatorSafetyBlurLevel !==
      serverPrefs.moderatorSafetyBlurLevel ||
    safetySettings.moderatorSafetyGrayscale !==
      serverPrefs.moderatorSafetyGrayscale ||
    safetySettings.moderatorSafetyMuteVideo !==
      serverPrefs.moderatorSafetyMuteVideo ||
    safetySettings.moderatorSafetySepia !== serverPrefs.moderatorSafetySepia;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="border-b border-gray-200 py-2">
          <Heading weight="semibold" size="2XL">
            Default Wellness Settings
          </Heading>
          <Text size="SM" className="text-gray-500 mt-2">
            Configure your organization's default safety settings. When a new
            user joins your team and needs to use Coop, these settings will be
            applied by default to transform their safety and well-being. If a
            user wants to override these settings, they can do so in their
            personal wellness settings.
          </Text>
        </div>

        <div className="flex gap-12 justify-between mt-8">
          <div className="flex flex-col gap-5 w-80">
            <div className="flex-col gap-3">
              <Text className="text-base" weight="medium">
                Blur Media
              </Text>
              <Slider
                className="w-80 mt-4"
                min={0}
                max={Object.keys(BLUR_LEVELS).length - 1}
                onValueChange={([strength]) => {
                  setSafetySettings((prev) => ({
                    ...prev,
                    moderatorSafetyBlurLevel: strength as BlurStrength,
                  }));
                }}
                value={[safetySettings.moderatorSafetyBlurLevel]}
                step={1}
              />
            </div>
            <div className="flex gap-12 mt-2 items-center">
              <Text className="text-base" weight="medium">
                Color Scheme
              </Text>
              <Select
                value={colorSchemeFromPreferences(safetySettings)}
                onValueChange={(value) =>
                  setSafetySettings({
                    ...safetySettings,
                    ...preferencesFromColorScheme(
                      value as ModeratorSafetyColorScheme,
                    ),
                  })
                }
              >
                <SelectTrigger size="small" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODERATOR_SAFETY_COLOR_SCHEMES.map((scheme) => (
                    <SelectItem value={scheme} key={scheme}>
                      {MODERATOR_SAFETY_COLOR_SCHEME_LABELS[scheme]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-12 mt-2 items-center">
              <Text className="text-base" weight="medium">
                Mute videos
              </Text>
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
            } ${colorSchemeClassName(colorSchemeFromPreferences(safetySettings))}`}
            alt="puppies"
            src={GoldenRetrieverPuppies}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button
          disabled={!hasChanges || isSaving}
          loading={isSaving}
          onClick={() => {
            saveSafetySettings({
              variables: { orgDefaultSafetySettings: safetySettings },
            });
          }}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
