import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import CoopButton from '../../components/CoopButton';

export default function ManualReviewJobDequeueErrorComponent() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center w-full">
      <div className="flex flex-col items-center justify-center max-w-sm p-12 mt-24 shadow-lg rounded-xl">
        <div className="pb-10 text-gray-300 text-8xl">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="pb-4 text-3xl text-gray-500">
          Error Dequeueing Next Job
        </div>
        <div className="pb-10 text-base text-gray-500">
          There are jobs in your queue, but we were unable to dequeue one for
          you to review. Please try again later.
        </div>
        <div className="flex flex-row items-center space-x-2">
          <CoopButton
            title="Back to All Queues"
            onClick={() => navigate('/dashboard/manual_review/queues')}
          />
        </div>
      </div>
    </div>
  );
}
