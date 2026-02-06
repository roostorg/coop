import { DatePicker, Input, Select } from 'antd';
import intersection from 'lodash/intersection';
import uniq from 'lodash/uniq';
import { MouseEvent } from 'react';
import { Row, UseFiltersColumnProps } from 'react-table';

const { Option } = Select;
const { RangePicker } = DatePicker;

export type ColumnProps = UseFiltersColumnProps<object> & {
  setUnsavedFilterValue: (value: any) => void;
  unsavedFilterValue: any;
  onSave: () => void;
};

export type FilterProps = {
  columnProps: ColumnProps;
  accessor: string;
  placeholder?: string;
};

function onClickFilter(event: MouseEvent) {
  // This ensures that clicking the filter doesn't trigger a
  // 'sort column' event
  event.stopPropagation();
}

export function getFilterTypes() {
  return {
    // Override the default text filter to use "startWith"
    text: (rows: Row<any>[], id: string, filterValue: any) => {
      if (filterValue == null || filterValue.length === 0) {
        return rows;
      }
      return rows.filter((row) => {
        const rowValue = row.original.values[id[0]];
        return rowValue != null
          ? String(rowValue)
              .toLowerCase()
              .includes(String(filterValue).toLowerCase())
          : false;
      });
    },
    // Allow for filtering on options in a predetermined list
    includes: (rows: Row<any>[], id: string, filterValue: any) => {
      if (
        filterValue == null ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        return rows;
      }
      return rows.filter((row) => {
        const rowValue = row.original.values[id[0]];
        if (rowValue == null) {
          return false;
        }
        if (Array.isArray(rowValue)) {
          return intersection(filterValue, rowValue).length > 0;
        }
        return filterValue.includes(rowValue);
      });
    },
    range: (rows: Row<any>[], id: string, filterValue: any) => {
      if (filterValue == null) {
        return rows;
      }
      const start = filterValue[0];
      const end = filterValue[1];
      return rows.filter((row) => {
        if (start && start > row.original.values[id[0]]) {
          return false;
        }
        if (end && end < row.original.values[id[0]]) {
          return false;
        }
        return true;
      });
    },
    dateRange: (rows: Row<any>[], id: string, filterValue: any) => {
      if (filterValue == null) {
        return rows;
      }
      let start = filterValue[0];
      let end = filterValue[1];
      if (start) {
        start = start.format('YYYY-MM-DD');
      }
      if (end) {
        end = end.format('YYYY-MM-DD');
      }
      return rows.filter((row) => {
        if (start && start > row.original.values[id[0]]) {
          return false;
        }
        if (end && end < row.original.values[id[0]]) {
          return false;
        }
        return true;
      });
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
    options.push((row.original as any).values[accessor]);
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
            setUnsavedFilterValue((old = []) => {
              return [undefined, old[1]];
            });
            return;
          }
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            setUnsavedFilterValue((old = []) => {
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
            setUnsavedFilterValue((old = []) => {
              return [old[0], undefined];
            });
            return;
          }
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            setUnsavedFilterValue((old = []) => {
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

  // We wrap this in a div because RangePicker's onClick doesn't work
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
