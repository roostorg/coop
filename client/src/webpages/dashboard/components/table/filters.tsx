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
    text: (row: FacetedRow, id: string, value: any) =>
      value == null ||
      value.length === 0 ||
      (raw(row, id) != null &&
        String(raw(row, id))
          .toLowerCase()
          .includes(String(value).toLowerCase())),
    includes: (row: FacetedRow, id: string, value: any) =>
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      (raw(row, id) != null &&
        (Array.isArray(raw(row, id))
          ? intersection(value, raw(row, id)).length > 0
          : value.includes(raw(row, id)))),
    range: (row: FacetedRow, id: string, value: any) =>
      value == null ||
      ((!value[0] || value[0] <= raw(row, id)) &&
        (!value[1] || value[1] >= raw(row, id))),
    dateRange: (row: FacetedRow, id: string, value: any) => {
      if (value == null) return true;
      const start = value[0]?.format('YYYY-MM-DD');
      const end = value[1]?.format('YYYY-MM-DD');
      return (!start || start <= raw(row, id)) && (!end || end >= raw(row, id));
    },
  };
}
function onClickFilter(event: MouseEvent) {
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
