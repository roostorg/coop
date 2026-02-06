import { ReactComponent as CopyAlt } from '@/icons/lni/Web and Technology/copy-alt.svg';
import { Tooltip } from 'antd';
import { useState } from 'react';

const DEFAULT_TOOLTIP_TEXT = 'Copy to clipboard';

/**
 * Text component that allows the user to copy the text to their clipboard.
 */
export default function CopyTextComponent(props: {
  // Text to copy to the clipboard
  value: string;
  // If value being copied to the clipboard is different from what you'd like
  // to display to the user, set this value
  displayValue?: string | JSX.Element;
  // Tooltip text to display when the user hovers over the text
  initialTooltipText?: string;
  // Optional footer items to display below the text
  footerItems?: JSX.Element[];
  isError?: boolean;
  wrapText?: boolean;
}) {
  const {
    value,
    displayValue = value,
    initialTooltipText = DEFAULT_TOOLTIP_TEXT,
    footerItems = [],
    isError = false,
    wrapText = false,
  } = props;
  const [copyTextTooltipTitle, setCopyTextTooltipTitle] =
    useState<string>(initialTooltipText);

  const resetTextTooltipTitle = () => {
    setTimeout(() => setCopyTextTooltipTitle(initialTooltipText), 20);
  };

  return (
    <div className="flex flex-col">
      <Tooltip
        title={copyTextTooltipTitle}
        onOpenChange={(visible: boolean) => {
          if (!visible) {
            resetTextTooltipTitle();
          }
        }}
      >
        <div
          className="flex flex-row items-center cursor-pointer grow"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            navigator.clipboard.writeText(value);
            setCopyTextTooltipTitle('Copied!');
          }}
        >
          {typeof displayValue === 'string' ? (
            <span
              className={`font-normal ${
                isError ? 'text-red-400' : 'text-slate-400'
              } ${wrapText ? '' : 'whitespace-nowrap'}`}
            >
              {displayValue}
            </span>
          ) : (
            displayValue
          )}
          <CopyAlt
            className={`flex w-4 h-4 min-w-fit ${
              displayValue && displayValue !== '' ? 'ml-1' : ''
            } ${isError ? 'fill-red-400' : 'fill-slate-400'}`}
          />
        </div>
      </Tooltip>
      <div className="flex flex-row">{footerItems}</div>
    </div>
  );
}
