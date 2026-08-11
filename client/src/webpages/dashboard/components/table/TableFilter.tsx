import ChevronDown from '@/icons/lni/Direction/chevron-down.svg?react';
import ChevronUp from '@/icons/lni/Direction/chevron-up.svg?react';
import { FilterOutlined } from '@ant-design/icons';
import { Column, RowData } from '@tanstack/react-table';
import { Button } from 'antd';
import omit from 'lodash/omit';
import without from 'lodash/without';
import { useEffect, useRef, useState } from 'react';

import CloseButton from '@/components/common/CloseButton';

import CoopButton from '../CoopButton';

export default function TableFilter<TData extends RowData>({
  columns,
}: {
  columns: Column<TData, unknown>[];
}) {
  const filterColumns = columns.filter(
    (column) => column.getCanFilter() && column.columnDef.meta?.filter,
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [pending, setPending] = useState<Record<string, any>>({});
  const [floatedRight, setFloatedRight] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const position = () => {
      if (buttonRef.current)
        setFloatedRight(
          buttonRef.current.getBoundingClientRect().right >
            window.innerWidth / 2,
        );
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [menuVisible]);
  const onSave = () => {
    Object.entries(pending).forEach(([id, value]) =>
      filterColumns.find((c) => c.id === id)?.setFilterValue(value),
    );
    setMenuVisible(false);
  };
  const remove = (id: string) => {
    setPending(omit(pending, id));
    filterColumns.find((c) => c.id === id)?.setFilterValue(undefined);
  };
  const active = filterColumns.filter((column) => column.getFilterValue());
  if (!filterColumns.length) return null;
  return (
    <div className="relative inline-block text-start">
      <div className="flex items-center justify-start">
        <Button
          ref={buttonRef}
          className={`font-semibold text-base rounded ${active.length ? 'text-white bg-[#71717a] border-none' : 'bg-white'}`}
          icon={<FilterOutlined />}
          onClick={() => setMenuVisible(!menuVisible)}
        >
          Filter
        </Button>
        <div className="flex items-center">
          {active.map((column) => (
            <div
              key={column.id}
              className="flex items-center gap-1.5 p-2 ml-3 font-semibold text-gray-600 bg-gray-200 rounded"
            >
              {`${String(column.columnDef.header)}: ${column.getFilterValue()}`}
              <CloseButton onClose={() => remove(column.id)} />
            </div>
          ))}
        </div>
      </div>
      {menuVisible && (
        <div
          className={`flex flex-col absolute bg-white border-solid border border-[#d4d4d8] rounded shadow-md mt-1 min-w-[320px] z-20 ${floatedRight ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-center justify-between px-4">
            <div className="py-6 text-base font-semibold">Filter</div>
            <CoopButton title="Save" size="small" onClick={onSave} />
          </div>
          <div className="!p-0 !m-0 divider" />
          <div className="flex flex-col">
            {filterColumns.map((column) => {
              const label = String(column.columnDef.header);
              const open = expanded.includes(label);
              const Renderer = column.columnDef.meta!.filter!;
              return (
                <div
                  className={`flex flex-col ${open ? 'bg-gray-100' : ''}`}
                  key={column.id}
                >
                  <div
                    className="flex items-center p-4 cursor-pointer"
                    onClick={() =>
                      setExpanded(
                        open ? without(expanded, label) : [...expanded, label],
                      )
                    }
                  >
                    <div className="text-[13px] text-start mr-2">{label}</div>
                    {open ? (
                      <ChevronUp className="w-3 font-bold fill-slate-400" />
                    ) : (
                      <ChevronDown className="w-3 font-bold fill-slate-400" />
                    )}
                  </div>
                  {open && (
                    <div className="flex flex-col px-4 pt-0 pb-4">
                      <Renderer
                        preFilteredRows={column.getFacetedRowModel().flatRows}
                        setUnsavedFilterValue={(value: any) =>
                          setPending({
                            ...pending,
                            [column.id]:
                              typeof value === 'function'
                                ? value(pending[column.id])
                                : value,
                          })
                        }
                        unsavedFilterValue={pending[column.id]}
                        onSave={onSave}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
