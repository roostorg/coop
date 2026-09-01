import SortAmountAsc from '@/icons/lni/Text editor/sort-amount-asc.svg?react';
import SortAmountDsc from '@/icons/lni/Text editor/sort-amount-dsc.svg?react';
import { flexRender, useTable } from '@tanstack/react-table';
import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { features, TableColumnDef, TableData, TableRow } from './tableFeatures';
import TableFilter from './TableFilter';

export type TableRowData = TableData;
export type { TableColumnDef, TableRow } from './tableFeatures';

export default function Table<TData extends Record<string, any>>(
  props: {
    columns: TableColumnDef<NoInfer<TData>, any>[];
    data: readonly TData[];
    onSelectRow?: (row: TableRow<TData>) => void;
    rowLinkTo?: (row: TableRow<TData>) => string;
    topLeftComponent?: ReactNode;
    topRightComponent?: ReactNode;
    customMaxHeight?: `max-h-[${number}px]`;
    disableFilter?: boolean;
    containerClassName?: string;
    /** Force the horizontal scrollbar to always render. Opt-in because tables
     * that always fit the viewport would otherwise show an unnecessary scrollbar. */
    alwaysShowScrollbar?: boolean;
  } & (
    | {
        isCollapsed?: boolean;
        collapsedColumnTitle?: string;
        renderCollapsedCell?: (row: TableRow<TData>) => ReactNode;
      }
    | Record<never, never>
  ),
) {
  const {
    columns,
    data,
    onSelectRow,
    rowLinkTo,
    topLeftComponent,
    topRightComponent,
    customMaxHeight,
    disableFilter,
    containerClassName,
    alwaysShowScrollbar,
  } = props;
  const {
    isCollapsed = undefined,
    collapsedColumnTitle = undefined,
    renderCollapsedCell = undefined,
  } = 'isCollapsed' in props ? props : {};

  const rowsAreSelectable = onSelectRow !== undefined;
  const tableData = useMemo(() => [...data], [data]);

  const table = useTable({
    features,
    columns,
    data: tableData,
    defaultColumn: {
      cell: ({ getValue }): ReactNode => getValue() as ReactNode,
    },
  });
  const rows = table.getRowModel().rows;
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const selectRow = (row: TableRow<TData>, rowIndex: number) => {
    if (rowsAreSelectable) {
      setSelectedRow(rowIndex);
      onSelectRow(row);
    }
  };

  return (
    <div
      className={`flex flex-col items-start max-w-full mb-8 ${containerClassName ?? 'w-fit'}`}
    >
      <div
        className={`flex w-full pb-2 items-start gap-4 ${
          topLeftComponent || topRightComponent
            ? 'justify-between'
            : 'justify-end'
        } ${isCollapsed ? 'flex-col gap-1' : ''}`}
      >
        {topLeftComponent}
        {disableFilter ? null : (
          <TableFilter columns={table.getAllLeafColumns()} />
        )}
        {topRightComponent}
      </div>
      <div className="w-full min-w-0 border border-gray-200 border-solid rounded-md">
        <div
          className={`min-w-0 overflow-x-auto overflow-y-auto rounded-md ${
            alwaysShowScrollbar ? 'scrollbar-show' : ''
          } ${customMaxHeight ?? 'max-h-[1200px]'}`}
        >
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {isCollapsed && collapsedColumnTitle ? (
                    <th className="p-4 text-base font-bold text-gray-500 rounded-t-md text-start align-center">
                      <div className="flex flex-row items-center justify-between flex-nowrap whitespace-nowrap">
                        {collapsedColumnTitle}
                      </div>
                    </th>
                  ) : (
                    headerGroup.headers.map((header, index) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`align-center font-bold text-gray-500 text-start text-base !p-0 ${
                            index === 0
                              ? 'rounded-tl-md'
                              : index === headerGroup.headers.length - 1
                                ? 'rounded-tr-md'
                                : ''
                          }`}
                        >
                          <div className="flex flex-row items-center p-4 flex-nowrap whitespace-nowrap gap-3">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            {header.column.getCanSort() ? (
                              sorted === 'desc' ? (
                                <SortAmountDsc className="bg-[#40ace920] w-6 p-1 fill-primary rounded-full" />
                              ) : sorted === 'asc' ? (
                                <SortAmountAsc className="bg-[#40ace920] w-6 p-1 fill-primary rounded-full scale-y-[-1]" />
                              ) : (
                                <SortAmountDsc className="w-4 rounded-full fill-gray-500" />
                              )
                            ) : null}
                          </div>
                        </th>
                      );
                    })
                  )}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const cell = renderCollapsedCell && renderCollapsedCell(row);
                const cellWithWrapper = rowLinkTo ? (
                  <Link
                    to={rowLinkTo(row)}
                    className="flex items-center px-4 py-2 text-black hover:text-black"
                  >
                    {cell}
                  </Link>
                ) : (
                  <div className="flex items-center px-4 py-2 text-black hover:text-black">
                    {cell}
                  </div>
                );
                return isCollapsed ? (
                  <tr
                    key={row.id}
                    className={
                      rowsAreSelectable || rowLinkTo !== undefined
                        ? selectedRow === rowIndex
                          ? 'cursor-pointer bg-indigo-100 hover:bg-indigo-100 border border-solid border-indigo-200 group'
                          : `cursor-pointer hover:bg-indigo-100 group ${
                              rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            }`
                        : rowIndex % 2 === 0
                          ? 'bg-white'
                          : 'bg-slate-50'
                    }
                    onClick={() => selectRow(row, rowIndex)}
                  >
                    <td
                      className={`text-start h-px border border-solid border-gray-200 border-b-0 border-x-0 border-t ${
                        rowIndex === rows.length - 1
                          ? 'rounded-b-md'
                          : 'rounded-b-none'
                      }`}
                    >
                      {cellWithWrapper}
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.id}
                    className={
                      rowsAreSelectable || rowLinkTo !== undefined
                        ? selectedRow === rowIndex
                          ? 'cursor-pointer bg-indigo-100 hover:bg-indigo-100 border border-solid border-indigo-200 group'
                          : `cursor-pointer hover:bg-indigo-100 group ${
                              rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            }`
                        : rowIndex % 2 === 0
                          ? 'bg-white'
                          : 'bg-slate-50'
                    }
                    onClick={() => selectRow(row, rowIndex)}
                  >
                    {row.getAllCells().map((cell, index, cells) => {
                      const cellWithWrapper = rowLinkTo ? (
                        <Link
                          to={rowLinkTo(row)}
                          className="flex items-center px-4 py-2 text-black hover:text-black"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Link>
                      ) : (
                        <div className="flex items-center max-w-3xl px-4 py-2 overflow-hidden text-ellipsis text-black hover:text-black">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>
                      );

                      return (
                        <td
                          key={cell.id}
                          className={`text-start h-px border border-solid border-gray-200 border-b-0 border-x-0 border-t text-base ${
                            rowIndex === rows.length - 1 && index === 0
                              ? 'rounded-bl-md'
                              : 'rounded-bl-none'
                          } ${
                            rowIndex === rows.length - 1 &&
                            index === cells.length - 1
                              ? 'rounded-br-md'
                              : 'rounded-br-none'
                          }`}
                        >
                          {cellWithWrapper}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
