import { CirclePlay } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ReactPlayer from 'react-player';

import CoopModal from '../../components/CoopModal';

import { BLUR_LEVELS, BlurStrength } from './v2/ncmec/NCMECMediaViewer';

export default function ManualReviewJobContentBlurableVideo(props: {
  url: string;
  className?: string;
  options?: {
    shouldBlur?: boolean;
    muted?: boolean;
    blurStrength?: BlurStrength;
    controlsDisabled?: boolean;
    maxWidth?: number | string;
    maxHeight?: number | string;
    onError?: () => void;
    // From the ReactPlayer docs: Set to true to show just the video thumbnail,
    // which loads the full player on click
    lightMode?: boolean;
  };
}) {
  const { url, className, options } = props;
  const {
    shouldBlur = false,
    muted = false,
    blurStrength,
    controlsDisabled,
    lightMode = false,
    maxWidth = Infinity,
    maxHeight = Infinity,
  } = options ?? {};
  // react-player defaults its wrapper <div> to a fixed 640x360 and forwards
  // `style` straight to it. Left alone, that box overflows (or, once the parent
  // clips it, hides) whenever the review panel is narrower than 640px. Make the
  // player fill the container width instead, capped by any caller-supplied
  // max-*; drop `max-*: Infinity`, which is invalid CSS.
  const playerWidth = maxWidth !== Infinity ? maxWidth : '100%';
  const playerHeight = maxHeight !== Infinity ? maxHeight : 360;
  const playerStyle: CSSProperties = { display: 'flex', width: '100%' };
  if (maxWidth !== Infinity) {
    playerStyle.maxWidth = maxWidth;
  }
  if (maxHeight !== Infinity) {
    playerStyle.maxHeight = maxHeight;
  }

  const [videoError, setVideoError] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReactPlayer>(null);

  // Reset video error when the url changes
  useEffect(() => setVideoError(false), [url]);

  useEffect(() => {
    ref.current?.addEventListener(
      'wheel',
      (e) => {
        if (playing) {
          e.preventDefault();
          if (
            playerRef.current &&
            playerRef.current.getCurrentTime() - e.deltaY / 10 >=
              playerRef.current.getDuration()
          ) {
            // Prevent scrolling from overflowing back to the beginning again
            playerRef.current?.seekTo(playerRef.current.getDuration() - 1);
          } else {
            playerRef.current?.seekTo(
              playerRef.current.getCurrentTime() - e.deltaY / 10,
            );
          }
        }
      },
      { passive: false },
    );
  });

  return (
    <div
      className={`${className} relative overflow-hidden rounded-lg shadow h-fit`}
      ref={ref}
    >
      <div
        className={`shadow ${
          shouldBlur
            ? blurStrength
              ? BLUR_LEVELS[blurStrength]
              : !playing
                ? 'blur-sm'
                : 'blur-0'
            : 'blur-0'
        }`}
      >
        <ReactPlayer
          width={playerWidth}
          height={playerHeight}
          style={playerStyle}
          playing={playing}
          url={url}
          controls={!controlsDisabled}
          light={lightMode}
          onError={(_) => {
            if (options?.onError) {
              options.onError();
            } else if (playing) {
              setVideoError(true);
            }
          }}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload',
                // react-player spreads `attributes` after its own `style`, so
                // this fully replaces it — restate width/height and add
                // object-fit so the video letterboxes in the fixed wrapper box
                // instead of stretching.
                style: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain' as const,
                },
              },
            },
          }}
          ref={playerRef}
          volume={muted ? 0 : undefined}
          onPlay={() => {
            setPlaying(true);
          }}
        />
      </div>
      {playing ? null : (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer top-1/2 left-1/2"
          onClick={() => {
            if (!controlsDisabled) {
              setPlaying(true);
            }
          }}
        >
          <CirclePlay
            className="w-12 h-12 text-white drop-shadow-lg"
            strokeWidth={1.5}
          />
        </div>
      )}
      <CoopModal
        title="Error"
        visible={videoError}
        footer={[
          {
            title: 'OK',
            onClick: () => setVideoError(false),
            type: 'primary',
          },
        ]}
      >
        We were unable to play this video.
      </CoopModal>
    </div>
  );
}
