import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import { FilterOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import omit from 'lodash/omit';
import without from 'lodash/without';
import { useEffect, useRef, useState } from 'react';

import CloseButton from '@/components/common/CloseButton';

import CoopButton from '../CoopButton';

export default function TableFilter(props: { headers: any[] }) {
  const { headers } = props;

  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [expandedColumnNames, setExpandedColumnNames] = useState<string[]>([]);
  const [unsavedFilterValues, setUnsavedFilterValues] = useState<{
    [key: string]: any;
  }>({});
  const [isButtonFloatedRight, setIsButtonFloatedRight] = useState(false);

  const buttonRef = useRef<HTMLDivElement>(null);

  // Determine whether the "Filter" button has floated to the left or right of the screen,
  // which helps us display the filter menu properly.
  useEffect(() => {
    const handleButtonPosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const buttonRect = button.getBoundingClientRect();
      const canvasCenter = window.innerWidth / 2;

      // Check if the button is placed on the right side
      setIsButtonFloatedRight(buttonRect.right > canvasCenter);
    };

    handleButtonPosition(); // Initial check
    window.addEventListener('resize', handleButtonPosition);
    return () => window.removeEventListener('resize', handleButtonPosition);
  }, [menuVisible]);

  const scrollToButton = () => {
    if (buttonRef.current) {
      // If the button is in the bottom half of the screen, scroll down to it
      // and place it in the middle of the screen.
      const buttonPosition = buttonRef.current.getBoundingClientRect().top;
      const halfwayPoint = window.innerHeight / 2;
      if (buttonPosition > halfwayPoint) {
        buttonRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const toggleColumn = (column: string) => {
    if (expandedColumnNames.includes(column)) {
      setExpandedColumnNames(without(expandedColumnNames, column));
    } else {
      setExpandedColumnNames([...expandedColumnNames, column]);
    }
  };

  const onSave = () => {
    for (const [columnId, value] of Object.entries(unsavedFilterValues)) {
      headers.find((header) => header.id === columnId)!.setFilter(value);
    }
    setMenuVisible(false);
  };

  const onSetUnsavedFilterValue = (columnId: string, value: any) => {
    setUnsavedFilterValues({
      ...unsavedFilterValues,
      [columnId]: value,
    });
  };

  const removeFilter = (columnId: string) => {
    setUnsavedFilterValues(omit(unsavedFilterValues, columnId));
    headers.find((header) => header.id === columnId)!.setFilter(undefined);
  };

  const activeFilters = headers.filter((header) => header.filterValue);

  return headers.some((header) => header.filter) ? (
    <div className="relative inline-block text-start">
      <div className="flex items-center justify-start">
        <Button
          ref={buttonRef}
          className={`font-semibold text-base rounded ${
            activeFilters.length === 0
              ? 'bg-white hover:bg-white hover:text-[#71717a] focus:bg-white focus:text-[#71717a]'
              : 'text-white bg-[#71717a] border-none focus:text-white focus:bg-[#71717a] focus:border-none hover:text-white hover:bg-[#a1a1aa] hover:border-none'
          }`}
          icon={
            <FilterOutlined
              className={`font-semibold ${
                activeFilters.length === 0 ? 'text-[#71717a]' : 'text-white'
              }`}
            />
          }
          onClick={() => {
            setMenuVisible(!menuVisible);
            scrollToButton();
          }}
        >
          Filter
        </Button>
        <div className="flex items-center">
          {activeFilters.map((column, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 p-2 ml-3 font-semibold text-gray-600 bg-gray-200 rounded"
            >
              {`${column.Header}: ${column.filterValue}`}
              <CloseButton onClose={() => removeFilter(column.id)} />
            </div>
          ))}
        </div>
      </div>
      {menuVisible && (
        <div
          className={`flex flex-col absolute bg-white border-solid border border-[#d4d4d8] rounded shadow-md mt-1 min-w-[320px] z-20 ${
            isButtonFloatedRight ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between px-4">
            <div className="py-6 text-base font-semibold">Filter</div>
            <CoopButton title="Save" size="small" onClick={onSave} />
          </div>
          <div className="!p-0 !m-0 divider" />
          <div className="flex flex-col">
            {headers.map((column, index) => {
              if (!column || !column.Header.length || !column.Filter) {
                return null;
              }
              const expanded = expandedColumnNames.includes(column.Header);
              return (
                <div
                  className={`flex flex-col ${expanded ? 'bg-gray-100' : ''}`}
                  key={`${index}_column`}
                >
                  <div
                    className="flex items-center p-4 cursor-pointer"
                    onClick={(_) => toggleColumn(column.Header)}
                    key={`${index}_column_cell`}
                  >
                    <div
                      className="text-[13px] text-start mr-2"
                      key={`${index}_column_name`}
                    >
                      {column.Header}
                    </div>
                    {expanded ? (
                      <ChevronUp className="w-3 font-bold fill-slate-400" />
                    ) : (
                      <ChevronDown className="w-3 font-bold fill-slate-400" />
                    )}
                  </div>
                  {expanded && (
                    <div
                      className="flex flex-col px-4 pt-0 pb-4"
                      key={`${index}_content`}
                    >
                      {column.Filter({
                        ...column,
                        setUnsavedFilterValue: (value: any) =>
                          onSetUnsavedFilterValue(column.id, value),
                        unsavedFilterValue: unsavedFilterValues[column.id],
                        onSave,
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  ) : null;
}
