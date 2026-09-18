import { moderatorSafetyFilterStyle } from '@/models/safetySettings';
import { useEffect, useState } from 'react';

import CopyTextComponent from '../../../../components/common/CopyTextComponent';
import CoopModal from '../../components/CoopModal';

import type { BlurStrength } from './v2/ncmec/NCMECMediaViewer';

export default function ManualReviewJobContentBlurableImage(props: {
  url: string;
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    shouldBlur?: boolean;
    blurStrength?: BlurStrength;
    grayscale?: boolean;
    disableZoom?: boolean;
    sepia?: boolean;
    revealOnHover?: boolean;
  };
  onError?: () => void;
}) {
  const { url, options, onError } = props;
  const {
    maxWidth = Infinity,
    maxHeight = Infinity,
    shouldBlur = false,
    blurStrength = 0,
    grayscale = false,
    disableZoom = false,
    sepia = false,
    revealOnHover = true,
  } = options ?? {};

  const [clicked, setClicked] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Reset error when the url changes
  useEffect(() => setError(false), [url]);

  if (error) {
    return (
      <CopyTextComponent
        value={url}
        displayValue="Image failed to load. Click to copy the failed URL."
        isError
        wrapText
      />
    );
  }

  const filter = moderatorSafetyFilterStyle({
    blurLevel: blurStrength,
    shouldBlur: shouldBlur && !(revealOnHover && isHovered),
    grayscale,
    sepia,
  });

  return (
    <div
      className="my-2 rounded-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        className="w-full rounded-lg"
        alt=""
        src={url}
        onClick={() => setClicked(true)}
        style={{ maxWidth, maxHeight, filter }}
        onError={() => {
          setError(true);
          onError?.();
        }}
      />
      {clicked && !disableZoom ? (
        <dialog className="dialog" style={{ position: 'absolute' }} open>
          <CoopModal visible={clicked} onClose={() => setClicked(false)}>
            <img
              className="max-w-full image"
              alt=""
              src={props.url}
              onClick={() => setClicked(false)}
            />
          </CoopModal>
        </dialog>
      ) : null}
    </div>
  );
}
