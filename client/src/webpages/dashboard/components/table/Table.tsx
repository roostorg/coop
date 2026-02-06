/* eslint-disable react/jsx-key */
import { ReactComponent as SortAmountAsc } from '@/icons/lni/Text editor/sort-amount-asc.svg';
import { ReactComponent as SortAmountDsc } from '@/icons/lni/Text editor/sort-amount-dsc.svg';
import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Column, Row, useFilters, useSortBy, useTable } from 'react-table';

import { getFilterTypes } from './filters';
import TableFilter from './TableFilter';

export default function Table(
  props: {
    columns: ReadonlyArray<Column<object>>;
    data: readonly object[];
    onSelectRow?: (rowData: Row<any>) => void;
    rowLinkTo?: (rowData: Row<any>) => string;
    topLeftComponent?: ReactNode;
    topRightComponent?: ReactNode;
    customMaxHeight?: `max-h-[${number}px]`;
    disableFilter?: boolean;
    containerClassName?: string;
  } & (
    | {
        isCollapsed?: boolean;
        collapsedColumnTitle?: string;
        renderCollapsedCell?: (row: Row<any>) => ReactNode;
      }
    | {}
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
  } = props;
  const {
    isCollapsed = undefined,
    collapsedColumnTitle = undefined,
    renderCollapsedCell = undefined,
  } = 'isCollapsed' in props ? props : {};

  const rowsAreSelectable = onSelectRow !== undefined;

  const filterTypes = useMemo(getFilterTypes, []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    /* @ts-ignore */
    useTable({ columns, data, filterTypes }, useFilters, useSortBy);

  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const selectRow = (row: Row<any>, rowIndex: number) => {
    if (rowsAreSelectable) {
      setSelectedRow(rowIndex);
      onSelectRow(row);
    }
  };

  return (
    <div className={`flex flex-col items-start max-w-full mb-8 ${containerClassName ?? 'w-fit'}`}>
      <div
        className={`flex w-full pb-2 items-start gap-4 ${
          topLeftComponent || topRightComponent
            ? 'justify-between'
            : 'justify-end'
        } ${isCollapsed ? 'flex-col gap-1' : ''}`}
      >
        {topLeftComponent}
        {disableFilter ? null : (
          <TableFilter
            headers={[...headerGroups.values()].flatMap(
              (group) => group.headers,
            )}
          />
        )}
        {topRightComponent}
      </div>
      <div className="w-full border border-gray-200 border-solid rounded-md scrollbar-hide">
        <div
          className={`overflow-x-auto overflow-y-scroll rounded-md scrollbar-hide ${
            customMaxHeight ?? 'max-h-[1200px]'
          }`}
        >
          <table {...getTableProps()} className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-50">
              {headerGroups.map((headerGroup, i) => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {isCollapsed && collapsedColumnTitle ? (
                    <th className="p-4 text-base font-bold text-gray-500 rounded-t-md text-start align-center">
                      <div className="flex flex-row items-center justify-between flex-nowrap whitespace-nowrap">
                        {collapsedColumnTitle}
                      </div>
                    </th>
                  ) : (
                    headerGroup.headers.map((column, index) => {
                      // For some reason when we pass `columns` into useTable,
                      // the `headers` prop in headerGroups doesn't receive the
                      // canSort value from each of the columns (it's overwritten)
                      // to true always. So we pull the canSort value from the
                      // `columns` variable instead of the headerGroup.headers variable.
                      // NB: canSort defaults to true
                      const canSort =
                        columns.find(
                          /* @ts-ignore */
                          (col) => col.Header === column.Header,
                          /* @ts-ignore */
                        )!.canSort ?? true;
                      // If we don't set this on the header's column object directly,
                      // the user can still click the header to sort the row, even
                      // though the sort UI is hidden.
                      if (!canSort) {
                        /* @ts-ignore */
                        column.canSort = false;
                      }
                      return (
                        <th
                          {...column.getHeaderProps(
                            /* @ts-ignore */
                            column.getSortByToggleProps(),
                          )}
                          className={`align-center font-bold text-gray-500 text-start text-base !p-0 ${
                            index === 0
                              ? 'rounded-tl-md'
                              : index === headerGroup.headers.length - 1
                              ? 'rounded-tr-md'
                              : ''
                          }`}
                        >
                          <div className="flex flex-row items-center p-4 flex-nowrap whitespace-nowrap gap-3">
                            {column.render('Header')}
                            {/* @ts-ignore */}
                            {canSort ? (
                              /* @ts-ignore */
                              column.isSortedDesc ? (
                                <SortAmountDsc className="bg-[#40ace920] w-6 p-1 fill-primary rounded-full" /> /* @ts-ignore */
                              ) : column.isSorted ? (
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
            <tbody {...getTableBodyProps()}>
              {rows.map((row, rowIndex) => {
                prepareRow(row);
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
                    {...row.getRowProps()}
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
                    {row.cells.map((cell, index) => {
                      const cellWithWrapper = rowLinkTo ? (
                        <Link
                          to={rowLinkTo(row)}
                          className="flex items-center px-4 py-2 text-black hover:text-black"
                        >
                          {cell.render('Cell')}
                        </Link>
                      ) : (
                        <div className="flex items-center max-w-3xl px-4 py-2 overflow-scroll text-black hover:text-black scrollbar-hide">
                          {cell.render('Cell')}
                        </div>
                      );

                      return (
                        <td
                          {...cell.getCellProps()}
                          className={`text-start h-px border border-solid border-gray-200 border-b-0 border-x-0 border-t text-base ${
                            rowIndex === rows.length - 1 && index === 0
                              ? 'rounded-bl-md'
                              : 'rounded-bl-none'
                          } ${
                            rowIndex === rows.length - 1 &&
                            index === columns.length - 1
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
