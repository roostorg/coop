import { Label } from '@/coop-ui/Label';
import { Switch } from '@/coop-ui/Switch';
import { useGQLPersonalSafetySettingsQuery } from '@/graphql/generated';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import FullScreenLoading from '@/components/common/FullScreenLoading';

import { type BlurStrength } from './v2/ncmec/NCMECMediaViewer';

export default function IframeContentDisplayComponent(props: {
  contentUrl: string;
}) {
  const { contentUrl } = props;

  const contentProxyUrl =
    import.meta.env.VITE_CONTENT_PROXY_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://content.getcoop.com'
      : 'http://localhost:4000');

  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);

  const [state, setState] = useState<{
    blur: boolean;
    grayscale: boolean;
    shouldTranslate: boolean;
  }>({
    blur: true,
    grayscale: false,
    shouldTranslate: false,
  });

  const { blur, grayscale, shouldTranslate } = state;

  const { loading, data } = useGQLPersonalSafetySettingsQuery();
  const {
    moderatorSafetyBlurLevel = 2 as BlurStrength,
    moderatorSafetyGrayscale = true,
  } = data?.me?.interfacePreferences ?? {};

  useEffect(() => {
    setState({
      blur: moderatorSafetyBlurLevel !== 0,
      grayscale: moderatorSafetyGrayscale,
      shouldTranslate: false,
    });
  }, [moderatorSafetyBlurLevel, moderatorSafetyGrayscale]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== contentProxyUrl) return;

      if (event.data.type === 'translationStatus') {
        setIsTranslating(event.data.isTranslating);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [contentProxyUrl]);

  const handleIframeLoad = useCallback(
    function (elm: HTMLIFrameElement | null) {
      const sendMessage = () => {
        if (!elm?.contentWindow) return;

        try {
          elm.contentWindow.postMessage(
            {
              type: 'customControl',
              blur: blur ? moderatorSafetyBlurLevel : 0,
              grayscale,
              shouldTranslate,
            },
            contentProxyUrl,
          );

          if (shouldTranslate) {
            setIsTranslating(true);
          }
        } catch (e) {
          setTimeout(() => {
            try {
              elm.contentWindow?.postMessage(
                {
                  type: 'customControl',
                  blur: blur ? moderatorSafetyBlurLevel : 0,
                  grayscale,
                  shouldTranslate,
                },
                contentProxyUrl,
              );
            } catch (retryError) {
              setIsTranslating(false);
            }
          }, 1000);
        }
      };

      if (!elm || isIframeLoading) {
        return;
      }

      sendMessage();
    },
    [
      blur,
      moderatorSafetyBlurLevel,
      grayscale,
      shouldTranslate,
      contentProxyUrl,
      isIframeLoading,
    ],
  );

  if (loading) {
    return <FullScreenLoading />;
  }

  const url = `${contentProxyUrl}/?contentUrl=${encodeURIComponent(contentUrl)}`;

  return (
    <div className="flex flex-col w-full p-2 isolation-auto">
      <div className="flex flex-row items-center self-end gap-4 mb-2">
        <div className="flex items-center space-x-2">
          {isTranslating && (
            <LoaderCircle className="h-4 w-4 animate-spin text-indigo-500" />
          )}
          <Switch
            disabled={isIframeLoading}
            id="translate-to-english"
            defaultChecked={shouldTranslate}
            onCheckedChange={(value) => {
              setState({ ...state, shouldTranslate: value });
              if (!value) {
                setIsTranslating(false);
              }
            }}
            checked={shouldTranslate}
          />
          <Label htmlFor="translate-to-english">Translate to English</Label>
        </div>
      </div>
      <div className="relative w-full min-h-[800px] h-[800px] border border-solid rounded-md overflow-hidden">
        {isIframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-75">
            <LoaderCircle className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        )}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-75">
            <div className="text-red-500">{iframeError}</div>
          </div>
        )}
        <iframe
          key={url}
          ref={handleIframeLoad}
          title="Content Display"
          src={url}
          onLoad={() => {
            setIsIframeLoading(false);
            setIframeError(null);
          }}
          onError={(e) => {
            setIsIframeLoading(false);
            setIframeError('Failed to load content');
          }}
          className="w-full h-full p-0 absolute inset-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
