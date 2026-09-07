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

function onClickFilter(event: MouseEvent) {
  // Prevent clicks inside filter controls from sorting the column.
  event.stopPropagation();
}

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
      if (start != null && start > rowValue) {
        return false;
      }
      if (end != null && end < rowValue) {
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

// Define a default UI for filtering
export function DefaultColumnFilter(props: FilterProps) {
  const { columnProps, placeholder } = props;
  const { unsavedFilterValue, setUnsavedFilterValue, onSave } = columnProps;
  return (
    <Input
      value={unsavedFilterValue || ''}
      placeholder={placeholder}
      onChange={(e) => setUnsavedFilterValue(e.target.value || undefined)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && unsavedFilterValue?.length) {
          onSave();
        }
      }}
      onClick={onClickFilter}
    />
  );
}

// This is a custom filter UI for selecting
// a unique option from a list
export function SelectColumnFilter(props: FilterProps) {
  const { columnProps, accessor, placeholder } = props;
  const { unsavedFilterValue, setUnsavedFilterValue, preFilteredRows } =
    columnProps;
  // Calculate the options for filtering
  // using the preFilteredRows
  const options: (string[] | string)[] = [];
  preFilteredRows.forEach((row) => {
    options.push((row.original as RawRow).values[accessor]);
  });
  const uniqueOptions = uniq(options.flat());

  // Render a multi-select box
  return (
    <Select
      mode="multiple"
      placeholder={placeholder}
      value={unsavedFilterValue}
      onChange={(value) => {
        setUnsavedFilterValue(value || undefined);
      }}
      onClick={onClickFilter}
      dropdownMatchSelectWidth={false}
    >
      {uniqueOptions.map((option, i) => (
        <Option key={i} value={option}>
          {option}
        </Option>
      ))}
    </Select>
  );
}

export function NumberRangeColumnFilter(props: FilterProps) {
  const { columnProps } = props;
  const { setUnsavedFilterValue } = columnProps;

  return (
    <div className="flex items-center gap-2">
      <Input
        className="!w-14"
        onChange={(e) => {
          if (!e.target.value) {
            setUnsavedFilterValue((old: any[] = []) => {
              return [undefined, old[1]];
            });
            return;
          }
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            setUnsavedFilterValue((old: any[] = []) => {
              return [val, old[1]];
            });
          }
        }}
        onClick={onClickFilter}
        placeholder="min"
      />
      to
      <Input
        className="!w-14"
        onChange={(e) => {
          if (!e.target.value) {
            setUnsavedFilterValue((old: any[] = []) => {
              return [old[0], undefined];
            });
            return;
          }
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            setUnsavedFilterValue((old: any[] = []) => {
              return [old[0], val];
            });
          }
        }}
        onClick={onClickFilter}
        placeholder="max"
      />
    </div>
  );
}

export function DateRangeColumnFilter(props: FilterProps) {
  const { columnProps } = props;
  const { unsavedFilterValue, setUnsavedFilterValue } = columnProps;

  // RangePicker does not forward onClick, so intercept it on a wrapper.
  return (
    <div onClick={onClickFilter}>
      <RangePicker
        className="!min-w-[250px]"
        placeholder={['Start', 'End']}
        value={unsavedFilterValue}
        format="YYYY-MM-DD"
        showTime={{ format: 'hh:mm a' }}
        onChange={(value: any) => {
          setUnsavedFilterValue(value);
        }}
      />
    </div>
  );
}
