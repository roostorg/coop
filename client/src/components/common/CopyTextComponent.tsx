import { Copy as CopyAlt } from 'lucide-react';
import { ReactElement } from 'react';

import CopyToClipboard from './CopyToClipboard';

/**
 * Text component that allows the user to copy the text to their clipboard.
 */
export default function CopyTextComponent(props: {
  // Text to copy to the clipboard
  value: string;
  // If value being copied to the clipboard is different from what you'd like
  // to display to the user, set this value
  displayValue?: string | ReactElement;
  // Tooltip text to display when the user hovers over the text
  initialTooltipText?: string;
  // Optional footer items to display below the text
  footerItems?: ReactElement[];
  isError?: boolean;
  wrapText?: boolean;
}) {
  const {
    value,
    displayValue = value,
    initialTooltipText,
    footerItems = [],
    isError = false,
    wrapText = false,
  } = props;

  return (
    <div className="flex flex-col">
      <CopyToClipboard value={value} initialTooltipText={initialTooltipText}>
        <div className="flex flex-row items-center cursor-pointer grow">
          {typeof displayValue === 'string' ? (
            <span
              className={`font-normal ${
                isError ? 'text-red-400' : 'text-slate-400'
              } ${wrapText ? 'break-all min-w-0' : 'whitespace-nowrap'}`}
            >
              {displayValue}
            </span>
          ) : (
            displayValue
          )}
          <CopyAlt
            className={`flex w-4 h-4 min-w-fit ${
              displayValue && displayValue !== '' ? 'ml-1' : ''
            } ${isError ? 'text-red-400' : 'text-slate-400'}`}
          />
        </div>
      </CopyToClipboard>
      <div className="flex flex-row">{footerItems}</div>
    </div>
  );
}
