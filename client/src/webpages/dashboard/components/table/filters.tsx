import { MultiCombobox } from '@/coop-ui/Combobox';
import { Input } from '@/coop-ui/Input';
import intersection from 'lodash/intersection';
import uniq from 'lodash/uniq';
import { MouseEvent } from 'react';

import type {
  FacetedRow,
  FilterRendererProps,
  TableData,
} from './tableFeatures';

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
      // filterValue is a `[startYYYY-MM-DD, endYYYY-MM-DD]` string tuple.
      const start = filterValue[0] || undefined;
      const end = filterValue[1] || undefined;
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
    <div onClick={onClickFilter}>
      <MultiCombobox
        placeholder={placeholder}
        value={(unsavedFilterValue as string[] | undefined) ?? []}
        onValueChange={(value) => {
          setUnsavedFilterValue(value.length > 0 ? value : undefined);
        }}
        options={uniqueOptions.map((option) => ({
          value: String(option),
          label: String(option),
        }))}
      />
    </div>
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

  const [start, end] = (unsavedFilterValue as
    [string | undefined, string | undefined] | undefined) ?? [
    undefined,
    undefined,
  ];

  const update = (next: [string | undefined, string | undefined]) => {
    setUnsavedFilterValue(next[0] || next[1] ? next : undefined);
  };

  return (
    <div
      className="flex items-center gap-2 min-w-[250px]"
      onClick={onClickFilter}
    >
      <Input
        type="date"
        aria-label="Start date"
        className="!w-36"
        value={start ?? ''}
        onChange={(e) => update([e.target.value || undefined, end])}
      />
      <span className="text-slate-400">to</span>
      <Input
        type="date"
        aria-label="End date"
        className="!w-36"
        value={end ?? ''}
        onChange={(e) => update([start, e.target.value || undefined])}
      />
    </div>
  );
}
