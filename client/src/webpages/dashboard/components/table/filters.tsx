import { DatePicker, Input, Select } from 'antd';
import intersection from 'lodash/intersection';
import uniq from 'lodash/uniq';
import { MouseEvent } from 'react';

import type {
  FacetedRow,
  FilterRendererProps,
  TableData,
} from './tableFeatures';

const { Option } = Select;
const { RangePicker } = DatePicker;
type RawRow = { values: Record<string, any> };

export type ColumnProps<TData extends TableData = TableData> =
  FilterRendererProps<TData>;
export type FilterProps = {
  columnProps: ColumnProps;
  accessor: string;
  placeholder?: string;
};
const raw = (row: FacetedRow, id: string) =>
  (row.original as RawRow).values[id];

export function getFilterTypes() {
  return {
    // Match case-insensitive substrings against the raw column value.
    text: (row: FacetedRow, id: string, filterValue: any) => {
      if (filterValue == null || filterValue.length === 0) {
        return true;
      }
      const rowValue = raw(row, id);
      if (rowValue == null) {
        return false;
      }
      return String(rowValue)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    },
    // Allow filtering on options in a predetermined list.
    includes: (row: FacetedRow, id: string, filterValue: any) => {
      if (
        filterValue == null ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        return true;
      }
      const rowValue = raw(row, id);
      if (rowValue == null) {
        return false;
      }
      if (Array.isArray(rowValue)) {
        return intersection(filterValue, rowValue).length > 0;
      }
      return filterValue.includes(rowValue);
    },
    range: (row: FacetedRow, id: string, filterValue: any) => {
      if (filterValue == null) {
        return true;
      }
      const start = filterValue[0];
      const end = filterValue[1];
      const rowValue = raw(row, id);
      if (start && start > rowValue) {
        return false;
      }
      if (end && end < rowValue) {
        return false;
      }
      return true;
    },
    dateRange: (row: FacetedRow, id: string, filterValue: any) => {
      if (filterValue == null) {
        return true;
      }
      const start = filterValue[0]?.format('YYYY-MM-DD');
      const end = filterValue[1]?.format('YYYY-MM-DD');
      const rowValue = raw(row, id);
      if (start && start > rowValue) {
        return false;
      }
      if (end && end < rowValue) {
        return false;
      }
      return true;
    },
  };
}
function onClickFilter(event: MouseEvent) {
  // Prevent clicks inside filter controls from sorting the column.
  event.stopPropagation();
}
export function DefaultColumnFilter({ columnProps, placeholder }: FilterProps) {
  const { unsavedFilterValue, setUnsavedFilterValue, onSave } = columnProps;
  return (
    <Input
      value={unsavedFilterValue || ''}
      placeholder={placeholder}
      onChange={(e) => setUnsavedFilterValue(e.target.value || undefined)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && unsavedFilterValue?.length) onSave();
      }}
      onClick={onClickFilter}
    />
  );
}
export function SelectColumnFilter({
  columnProps,
  accessor,
  placeholder,
}: FilterProps) {
  const options = uniq(
    columnProps.preFilteredRows.flatMap(
      (row) => (row.original as RawRow).values[accessor],
    ),
  );
  return (
    <Select
      mode="multiple"
      placeholder={placeholder}
      value={columnProps.unsavedFilterValue}
      onChange={(value) =>
        columnProps.setUnsavedFilterValue(value || undefined)
      }
      onClick={onClickFilter}
      dropdownMatchSelectWidth={false}
    >
      {options.map((option, i) => (
        <Option key={i} value={option}>
          {option}
        </Option>
      ))}
    </Select>
  );
}
export function NumberRangeColumnFilter({ columnProps }: FilterProps) {
  const set = columnProps.setUnsavedFilterValue;
  return (
    <div className="flex items-center gap-2">
      <Input
        className="!w-14"
        onChange={(e) =>
          set((old: any[] = []) => [
            e.target.value ? parseFloat(e.target.value) : undefined,
            old[1],
          ])
        }
        onClick={onClickFilter}
        placeholder="min"
      />
      to
      <Input
        className="!w-14"
        onChange={(e) =>
          set((old: any[] = []) => [
            old[0],
            e.target.value ? parseFloat(e.target.value) : undefined,
          ])
        }
        onClick={onClickFilter}
        placeholder="max"
      />
    </div>
  );
}
export function DateRangeColumnFilter({ columnProps }: FilterProps) {
  return (
    // RangePicker does not forward onClick, so intercept it on a wrapper.
    <div onClick={onClickFilter}>
      <RangePicker
        className="!min-w-[250px]"
        placeholder={['Start', 'End']}
        value={columnProps.unsavedFilterValue}
        format="YYYY-MM-DD"
        showTime={{ format: 'hh:mm a' }}
        onChange={(value: any) => columnProps.setUnsavedFilterValue(value)}
      />
    </div>
  );
}
