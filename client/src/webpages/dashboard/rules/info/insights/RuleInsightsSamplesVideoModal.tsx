import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import ReactPlayer from 'react-player/lazy';

import CoopModal from '../../../components/CoopModal';
import CoopButton from '@/webpages/dashboard/components/CoopButton';

export default function RuleInsightsSamplesVideoModal(props: {
  videoURL: string;
  onClose: () => void;
}) {
  const { videoURL, onClose } = props;
  const [videoError, setVideoError] = useState<Error | null>(null);
  return (
    <CoopModal visible={true} onClose={onClose}>
      {videoError != null ? (
        <div className="flex items-start justify-center w-full h-full">
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
            <div className="pb-8 text-8xl text-neutral-300">
              <ExclamationCircleOutlined />
            </div>
            <div className="pb-2 text-3xl max-w-s text-zinc-500">
              Something Went Wrong
            </div>
            <div className="pt-2 pb-10 text-base max-w-s text-zinc-500">
              We're having trouble playing this video.
            </div>
            <CoopButton title="Close" onClick={onClose} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <ReactPlayer
            width="100%"
            url={videoURL}
            controls={true}
            onError={setVideoError}
          />
        </div>
      )}
    </CoopModal>
  );
}
