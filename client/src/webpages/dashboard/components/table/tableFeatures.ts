import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  tableFeatures,
  type Column,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';

import { getFilterTypes } from './filters';

export type TableData = Record<string, any>;
export type FacetedRow<TData extends TableData = TableData> = {
  original: TData;
};
export type FilterRendererProps<TData extends TableData = TableData> = {
  preFilteredRows: readonly FacetedRow<TData>[];
  setUnsavedFilterValue: (value: any) => void;
  unsavedFilterValue: any;
  onSave: () => void;
};
type TableColumnMeta = {
  // Use TypeScript's bivariance pattern to accept filter renderers
  // typed for a table's specific row shape.
  // https://stackoverflow.com/a/52668133
  filter?: {
    bivarianceHack(props: FilterRendererProps): ReactNode;
  }['bivarianceHack'];
  valueType?: unknown;
};

export const features = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: getFilterTypes(),
  columnMeta: metaHelper<TableColumnMeta>(),
});

export type TableFeatures = typeof features;
export type TableRow<TData extends TableData = TableData> = Row<
  TableFeatures,
  TData
>;
export type TableColumnDef<
  TData extends TableData = TableData,
  TValue = unknown,
> = ColumnDef<TableFeatures, TData, TValue>;
export type TableColumn<
  TData extends TableData = TableData,
  TValue = unknown,
> = Column<TableFeatures, TData, TValue>;
