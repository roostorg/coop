import { Tooltip } from 'antd';
import { useEffect, useRef, useState } from 'react';

export default function TruncatedTextTableCell(props: {
  text: string;
  hideTooltip?: boolean;
}) {
  const { text, hideTooltip = false } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [truncatedText, setTruncatedText] = useState(text);
  const ellipsis = '...';

  useEffect(() => {
    const handleResize = () => {
      truncateText();
    };

    const truncateText = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;

        if (getTextWidth(text) <= containerWidth) {
          setTruncatedText(text);
        } else {
          let truncated = text;
          while (
            getTextWidth(truncated + ellipsis) > containerWidth &&
            truncated.length > 0
          ) {
            truncated = truncated.slice(0, -1);
          }
          setTruncatedText(truncated + ellipsis);
        }
      }
    };

    const getTextWidth = (text: string): number => {
      if (!containerRef.current) return 0;

      const tempElement = document.createElement('span');
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'nowrap';
      tempElement.textContent = text;
      containerRef.current.appendChild(tempElement);
      const width = tempElement.offsetWidth;
      containerRef.current.removeChild(tempElement);
      return width;
    };

    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden whitespace-nowrap"
    >
      {truncatedText.endsWith(ellipsis) && !hideTooltip ? (
        <Tooltip title={text} placement="top">
          {truncatedText}
        </Tooltip>
      ) : (
        truncatedText
      )}
    </div>
  );
}
