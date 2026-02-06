import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import CoopButton from '@/webpages/dashboard/components/CoopButton';

export default function ManualReviewJobEmptyQueue() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center w-full">
      <div className="flex flex-col items-center justify-center max-w-sm p-12 mt-24 shadow-lg rounded-xl">
        <div className="pb-10 text-gray-300 text-8xl">
          <CheckCircleOutlined />
        </div>
        <div className="pb-4 text-3xl text-gray-500">No Jobs to Review</div>
        <div className="pb-10 text-base text-gray-500">
          You're all caught up! Great work getting through the jobs quickly.
          This queue is now empty.
        </div>
        <CoopButton title="Back to All Queues" onClick={() => navigate(-1)} />
      </div>
    </div>
  );
}
