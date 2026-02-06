import { useEffect, useState } from 'react';

import CopyTextComponent from '../../../../components/common/CopyTextComponent';
import CoopModal from '../../components/CoopModal';

import { BLUR_LEVELS, BlurStrength } from './v2/ncmec/NCMECMediaViewer';

export default function ManualReviewJobContentBlurableImage(props: {
  url: string;
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    shouldBlur?: boolean;
    blurStrength?: BlurStrength;
    grayscale?: boolean;
    disableZoom?: boolean;
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
  } = options ?? {};

  const [clicked, setClicked] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

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

  return (
    <div className="my-2 rounded-lg">
      <img
        className={`w-full rounded-lg hover:blur-none ${
          shouldBlur ? BLUR_LEVELS[blurStrength] : 'blur-0'
        } ${grayscale ? 'grayscale' : ''}`}
        alt=""
        src={url}
        onClick={() => setClicked(true)}
        style={{ maxWidth, maxHeight }}
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
