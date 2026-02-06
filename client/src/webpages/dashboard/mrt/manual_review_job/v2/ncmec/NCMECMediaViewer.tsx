import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Switch } from '@/coop-ui/Switch';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import {
  GQLNcmecFileAnnotation,
  useGQLPersonalSafetySettingsQuery,
} from '../../../../../../graphql/generated';
import ManualReviewJobContentBlurableVideo from '../../ManualReviewJobContentBlurableVideo';
import NCMECLabelSelector from './NCMECLabelSelector';
import {
  NCMECCategory,
  NCMECMediaIdentifier,
  NCMECMediaState,
} from './NCMECReviewUser';
import NCMECSelectCategory from './NCMECSelectCategory';

export const BLUR_LEVELS = {
  0: 'blur-none',
  1: 'blur-sm',
  2: 'blur',
  3: 'blur-md',
  4: 'blur-lg',
  5: 'blur-xl',
  6: 'blur-2xl',
};
export type BlurStrength = keyof typeof BLUR_LEVELS;

type NCMECMediaViewerOptions = {
  isInInspectedView: boolean;
  grayOutThumbnail: boolean;
  isSelected: boolean;
  isConfirmedCsam: boolean;
};

export function safetySetting(text: string, component: React.ReactNode) {
  return (
    <div className="flex items-center mr-3">
      {text}
      <div className="ml-3 text-start">{component}</div>
    </div>
  );
}

export default function NCMECMediaViewer(props: {
  mediaId: NCMECMediaIdentifier;
  index: number;
  state: NCMECMediaState | undefined;
  options: NCMECMediaViewerOptions;
  addLabel: (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => void;
  removeLabel: (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => void;
  updateSelectedCategory: (
    mediaId: NCMECMediaIdentifier,
    category: NCMECCategory | undefined,
  ) => void;
  onClickToInspect?: (mediaId: NCMECMediaIdentifier) => void;
  shouldBlur?: boolean;
  onMediaError: (mediaId: NCMECMediaIdentifier) => void;
}) {
  const {
    mediaId,
    index,
    state,
    options,
    addLabel,
    removeLabel,
    updateSelectedCategory,
    onClickToInspect,
    shouldBlur,
    onMediaError,
  } = props;
  const { isInInspectedView, grayOutThumbnail, isSelected } = options;
  const [safetySettings, setSafetySettings] = useState<{
    moderatorSafetyBlurLevel: BlurStrength;
    moderatorSafetyGrayscale: boolean;
    moderatorSafetyMuteVideo: boolean;
  }>({
    moderatorSafetyBlurLevel: 2,
    moderatorSafetyGrayscale: true,
    moderatorSafetyMuteVideo: true,
  });

  const { loading, error, data } = useGQLPersonalSafetySettingsQuery();

  useEffect(() => {
    if (!data?.me?.interfacePreferences) {
      return;
    }
    // Set safety settings to the user's custom settings
    setSafetySettings({
      ...data.me.interfacePreferences,
      moderatorSafetyBlurLevel: data.me.interfacePreferences
        .moderatorSafetyBlurLevel as BlurStrength,
    });
  }, [data?.me?.interfacePreferences]);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error || !data?.me?.interfacePreferences) {
    throw error ?? new Error('Could not load safety settings');
  }

  return (
    <div
      className={`flex flex-col justify-start items-start ${
        grayOutThumbnail
          ? 'border border-solid border-gray-200 bg-gray-50 shadow rounded-md grow'
          : ''
      } ${isInInspectedView ? '' : 'max-w-xs'}`}
    >
      {grayOutThumbnail ? (
        <div className="flex items-center justify-center w-full h-full px-3 font-medium text-slate-700">
          {/* {isConfirmedCsam ? (
           <div className="relative self-start">
             <Tag
               className="absolute z-10 px-3 py-1 my-3 font-semibold text-white bg-red-500 rounded-full"
               icon={<ExclamationCircleOutlined />}
             >
               Confirmed CSAM
             </Tag>
           </div>
         ) : null} */}
          MEDIA IS BEING INSPECTED ABOVE
        </div>
      ) : (
        <div
          className={`relative inline-flex justify-center overflow-hidden cursor-pointer rounded-md shadow-lg w-fit ${
            grayOutThumbnail ? 'opacity-0' : ''
          }`}
          onClick={() => {
            if (onClickToInspect) {
              onClickToInspect(mediaId);
            }
          }}
        >
          {/* {isConfirmedCsam ? (
           <div className="relative self-start">
             <Tag
               className="absolute z-10 px-3 py-1 mt-2 font-semibold text-white bg-red-500 rounded-full"
               icon={<ExclamationCircleOutlined />}
             >
               Confirmed CSAM
             </Tag>
           </div>
         ) : null} */}
          {isInInspectedView ? null : (
            <div className="absolute z-10 flex p-1 px-3 font-semibold rounded w-fit text-slate-800 top-3 bg-slate-300 right-3">
              {index + 1}
            </div>
          )}
          {mediaId.urlInfo.mediaType === 'IMAGE' ? (
            <img
              className={`rounded-md ${
                isInInspectedView
                  ? 'w-full max-h-[600px]'
                  : 'object-scale-down w-64 h-48'
              } ${
                shouldBlur
                  ? BLUR_LEVELS[safetySettings.moderatorSafetyBlurLevel]
                  : 0
              } ${safetySettings.moderatorSafetyGrayscale ? 'grayscale' : ''}`}
              alt=""
              src={mediaId.urlInfo.url}
              onError={(img) => {
                // Retry the image loading exactly once
                if (img.currentTarget.src.includes('?time=')) {
                  onMediaError(mediaId);
                } else {
                  // Add a time query parameter to force the browser to reload the image
                  img.currentTarget.src =
                    img.currentTarget.src + '?time=' + Date.now();
                }
              }}
            />
          ) : (
            <ManualReviewJobContentBlurableVideo
              className={`${
                isInInspectedView
                  ? 'w-auto'
                  : 'object-scale-down grow max-w-64 max-h-48'
              } ${safetySettings.moderatorSafetyGrayscale ? 'grayscale' : ''}`}
              url={mediaId.urlInfo.url}
              options={{
                shouldBlur:
                  shouldBlur && safetySettings.moderatorSafetyBlurLevel > 0,
                blurStrength: safetySettings.moderatorSafetyBlurLevel,
                controlsDisabled: !isInInspectedView,
                muted: safetySettings.moderatorSafetyMuteVideo,
                onError: () => {
                  onMediaError(mediaId);
                },
                ...(isInInspectedView
                  ? { maxWidth: Infinity, maxHeight: Infinity }
                  : { maxWidth: 256, maxHeight: 192 }),
              }}
            />
          )}
          <div
            className={`group flex items-center justify-center absolute w-full bg-transparent cursor-pointer rounded-md h-full pointer-events-none ${
              isSelected
                ? `border-solid border-8 ${
                    mediaId.urlInfo.mediaType === 'IMAGE'
                      ? 'bg-[#69a9f633]'
                      : ''
                  } ${
                    state!.category === 'A1'
                      ? 'border-red-400'
                      : state!.category === 'A2'
                      ? 'border-orange-400'
                      : state!.category === 'B1'
                      ? 'border-amber-400'
                      : state!.category === 'B2'
                      ? 'border-blue-400'
                      : 'border-slate-500'
                  }`
                : 'border-transparent'
            }`}
          >
            {!isInInspectedView && (
              <SearchOutlined className="invisible text-5xl text-blue-500 group-hover:visible" />
            )}
          </div>
        </div>
      )}
      {isInInspectedView && (
        <div className="flex justify-between my-4">
          <div className="flex items-center gap-2 mr-3">
            <Label htmlFor="blur">Blur</Label>
            <Slider
              id="blur"
              className="w-32"
              min={0}
              max={Object.keys(BLUR_LEVELS).length - 1}
              onValueChange={([strength]) =>
                setSafetySettings({
                  ...safetySettings,
                  moderatorSafetyBlurLevel: strength as BlurStrength,
                })
              }
              value={[safetySettings.moderatorSafetyBlurLevel]}
              step={1}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="grayscale"
              defaultChecked
              onCheckedChange={(isGrayscale) =>
                setSafetySettings({
                  ...safetySettings,
                  moderatorSafetyGrayscale: isGrayscale,
                })
              }
              checked={safetySettings.moderatorSafetyGrayscale}
            />
            <Label htmlFor="grayscale">Grayscale</Label>
          </div>
        </div>
      )}
      {grayOutThumbnail || isInInspectedView ? null : (
        <div className="flex flex-col w-full mt-2">
          <div className="flex w-full text-start">
            <NCMECSelectCategory
              selectedCategory={state?.category}
              onUpdateCategory={updateSelectedCategory.bind(null, mediaId)}
            />
          </div>
          <div className="flex w-full mt-2 text-start">
            <NCMECLabelSelector
              disabled={state?.category == null || state.category === 'None'}
              value={state?.labels}
              addLabel={addLabel.bind(null, mediaId)}
              removeLabel={removeLabel.bind(null, mediaId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
