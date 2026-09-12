import { moderatorSafetyFilterStyle } from '@/models/safetySettings';
import { CirclePlay } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

import CoopModal from '../../components/CoopModal';

import type { BlurStrength } from './v2/ncmec/NCMECMediaViewer';

export default function ManualReviewJobContentBlurableVideo(props: {
  url: string;
  className?: string;
  options?: {
    shouldBlur?: boolean;
    muted?: boolean;
    blurStrength?: BlurStrength;
    grayscale?: boolean;
    sepia?: boolean;
    revealOnHover?: boolean;
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
    blurStrength = 1,
    grayscale = false,
    sepia = false,
    revealOnHover = true,
    controlsDisabled,
    lightMode = false,
    maxWidth = Infinity,
    maxHeight = Infinity,
  } = options ?? {};
  const [videoError, setVideoError] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
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

  const filter = moderatorSafetyFilterStyle({
    blurLevel: blurStrength,
    shouldBlur: shouldBlur && !(revealOnHover && isHovered),
    grayscale,
    sepia,
  });

  return (
    <div
      className={`${className} relative rounded-lg shadow h-fit`}
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="shadow" style={{ filter }}>
        <ReactPlayer
          style={{ display: 'flex', maxWidth, maxHeight }}
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
