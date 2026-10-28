import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/coop-ui/Tooltip';
import { ReactElement, useEffect, useRef, useState } from 'react';

export default function CopyToClipboard(props: {
  value: string;
  children: ReactElement;
  initialTooltipText?: string;
}) {
  const { value, children, initialTooltipText = 'Copy to clipboard' } = props;
  const [feedback, setFeedback] = useState<string>();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  return (
    <TooltipProvider>
      <Tooltip
        delayDuration={0}
        open={feedback !== undefined || tooltipOpen}
        onOpenChange={setTooltipOpen}
      >
        <TooltipTrigger
          asChild
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
              await navigator.clipboard.writeText(value);
              setFeedback('Copied');
            } catch {
              setFeedback('Copy failed');
            }
            clearTimeout(resetTimer.current);
            resetTimer.current = setTimeout(() => setFeedback(undefined), 2000);
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side="top">
          {feedback ?? initialTooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
