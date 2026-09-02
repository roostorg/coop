import { Play } from 'lucide-react';

export function RuleInsightsSamplesPlayVideoButton(props: {
  onClick: () => void;
}) {
  const { onClick } = props;

  return (
    <div
      className="flex items-center font-bold text-primary hover:underline"
      onClick={(event) => {
        onClick();
        event.stopPropagation();
      }}
    >
      Play Video
      <div style={{ paddingTop: '2px' }}>
        <Play className="w-4 h-4" fill="currentColor" />
      </div>
    </div>
  );
}
