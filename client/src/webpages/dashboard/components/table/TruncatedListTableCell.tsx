import { Tooltip } from 'antd';
import difference from 'lodash/difference';
import { useEffect, useRef, useState } from 'react';

import TruncatedTextTableCell from './TruncatedTextTableCell';

export default function TruncatedListTableCell(props: { list: string[] }) {
  const { list } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayComponent, setDisplayComponent] =
    useState<React.ReactElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      truncateList();
    };

    const truncateList = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const separator = ', ';
        const remainingItemsIndicator = (count: number) => ` +${count}`;
        const itemsThatFit = [];
        let remainingCount = 0;
        let textToFit = null;

        for (let i = 0; i < list.length; i++) {
          const potentialText = [...itemsThatFit, list[i]].join(separator);
          const potentialRemainingIndicator =
            remainingCount > 0 ? remainingItemsIndicator(remainingCount) : '';
          const potentialFullText = `${potentialText} ${potentialRemainingIndicator}`;

          if (getTextWidth(potentialFullText) <= containerWidth) {
            itemsThatFit.push(list[i]);
          } else {
            remainingCount = list.length - itemsThatFit.length;
            const remainingIndicator = remainingItemsIndicator(remainingCount);
            textToFit = itemsThatFit.length ? (
              <div className="flex gap-1">
                <div>{itemsThatFit.join(separator)}</div>
                <Tooltip title={difference(list, itemsThatFit)} placement="top">
                  {remainingIndicator}
                </Tooltip>
              </div>
            ) : (
              // We had to truncate the first item because it was too long to fit
              <div className="flex w-full gap-1">
                <TruncatedTextTableCell
                  text={list[0]}
                  hideTooltip={remainingCount > 1}
                />
                {remainingCount > 1 ? (
                  <Tooltip
                    title={difference(list, itemsThatFit).join(', ')}
                    placement="top"
                  >
                    {remainingIndicator}
                  </Tooltip>
                ) : null}
              </div>
            );
            break;
          }
        }

        if (!textToFit) {
          textToFit = <div>{itemsThatFit.join(separator)}</div>;
        }

        setDisplayComponent(textToFit);
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
  }, [list]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden whitespace-nowrap"
    >
      {displayComponent}
    </div>
  );
}
