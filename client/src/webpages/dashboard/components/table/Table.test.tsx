import { GQLRuleStatus } from '@/graphql/generated';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  ColumnProps,
  DefaultColumnFilter,
  NumberRangeColumnFilter,
} from './filters';
import { dateSort, ruleStatusSort, stringSort } from './sort';
import Table, { TableColumnDef } from './Table';

type TableRow = {
  name: ReactNode;
  status: string;
  values: { id: string; name: string; status: string };
};

const columns = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ getValue }): ReactNode => getValue<ReactNode>(),
    sortFn: stringSort,
    sortDescFirst: false,
  },
  { header: 'Status', accessorKey: 'status', enableSorting: false },
] satisfies TableColumnDef<TableRow>[];

const data: TableRow[] = [
  {
    name: <span>Rendered Zulu</span>,
    status: 'Open',
    values: { id: 'z', name: 'Zulu', status: 'Open' },
  },
  {
    name: <span>Rendered Alpha</span>,
    status: 'Closed',
    values: { id: 'a', name: 'Alpha', status: 'Closed' },
  },
  {
    name: <span>Rendered Alpine</span>,
    status: 'Open',
    values: { id: 'alpine', name: 'Alpine', status: 'Open' },
  },
];

function renderTable(
  tableColumns: TableColumnDef<TableRow>[] = columns,
  props = {},
) {
  return render(
    <MemoryRouter>
      <Table columns={tableColumns} data={data} {...props} />
    </MemoryRouter>,
  );
}

function renderedNames() {
  return within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);
}

function expectAllRowsVisible() {
  expect(screen.getByText('Rendered Zulu')).toBeTruthy();
  expect(screen.getByText('Rendered Alpha')).toBeTruthy();
  expect(screen.getByText('Rendered Alpine')).toBeTruthy();
}

const filterFor =
  (accessor: string, placeholder: string) => (props: ColumnProps) =>
    DefaultColumnFilter({ columnProps: props, accessor, placeholder });

describe('Table behavior', () => {
  it('preserves grouped header spans above leaf headers', () => {
    const groupedColumns = [
      {
        header: 'Details',
        columns,
      },
    ] satisfies TableColumnDef<TableRow>[];

    renderTable(groupedColumns);

    const headerRows = within(screen.getAllByRole('rowgroup')[0]).getAllByRole(
      'row',
    );
    expect(headerRows).toHaveLength(2);
    expect(
      within(headerRows[0])
        .getByRole('columnheader', { name: 'Details' })
        .getAttribute('colspan'),
    ).toBe('2');
    expect(
      within(headerRows[1]).getByRole('columnheader', { name: /Name/ }),
    ).toBeTruthy();
    expect(
      within(headerRows[1]).getByRole('columnheader', { name: 'Status' }),
    ).toBeTruthy();
  });

  it('keeps placeholder headers inert while grouped sortable headers stay accessible', () => {
    const groupedColumns = [
      columns[0],
      {
        header: 'Details',
        columns: [columns[1]],
      },
    ] satisfies TableColumnDef<TableRow>[];
    renderTable(groupedColumns);

    const placeholderHeader = screen
      .getAllByRole('columnheader')
      .find((header) => header.textContent === '');
    expect(placeholderHeader).toBeTruthy();
    expect(within(placeholderHeader!).queryByRole('button')).toBeNull();
    expect(placeholderHeader!.hasAttribute('aria-sort')).toBe(false);

    const nameHeader = screen.getByRole('columnheader', { name: /Name/ });
    const nameSortButton = within(nameHeader).getByRole('button', {
      name: /Name/,
    });
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');

    nameSortButton.focus();
    userEvent.type(nameSortButton, '{enter}', { skipClick: true });
    expect(renderedNames()).toEqual([
      'Rendered Alpha',
      'Rendered Alpine',
      'Rendered Zulu',
    ]);
  });

  it('makes sortable headers keyboard accessible and reports their sort direction', () => {
    renderTable();

    const nameHeader = screen.getByRole('columnheader', { name: /Name/ });
    const nameSortButton = within(nameHeader).getByRole('button', {
      name: /Name/,
    });
    const statusHeader = screen.getByRole('columnheader', { name: 'Status' });

    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
    expect(within(statusHeader).queryByRole('button')).toBeNull();
    expect(statusHeader.hasAttribute('aria-sort')).toBe(false);

    nameSortButton.focus();
    expect(document.activeElement).toBe(nameSortButton);
    userEvent.type(nameSortButton, '{enter}', { skipClick: true });
    expect(renderedNames()).toEqual([
      'Rendered Alpha',
      'Rendered Alpine',
      'Rendered Zulu',
    ]);
    expect(
      screen
        .getByRole('columnheader', { name: /Name/ })
        .getAttribute('aria-sort'),
    ).toBe('ascending');

    userEvent.type(nameSortButton, '{space}', { skipClick: true });
    expect(renderedNames()).toEqual([
      'Rendered Zulu',
      'Rendered Alpine',
      'Rendered Alpha',
    ]);
    expect(
      screen
        .getByRole('columnheader', { name: /Name/ })
        .getAttribute('aria-sort'),
    ).toBe('descending');
  });

  it('renders accessor values and sorts by raw values only on sortable headers', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeTruthy();
    expectAllRowsVisible();

    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(renderedNames()).toEqual([
      'Rendered Alpha',
      'Rendered Alpine',
      'Rendered Zulu',
    ]);

    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(renderedNames()).toEqual([
      'Rendered Zulu',
      'Rendered Alpine',
      'Rendered Alpha',
    ]);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Status' }));
    expect(renderedNames()).toEqual([
      'Rendered Zulu',
      'Rendered Alpine',
      'Rendered Alpha',
    ]);
  });

  it('sorts rendered rule statuses by their raw enum values', () => {
    type StatusRow = {
      status: ReactNode;
      values: { status: string };
    };
    const statusColumns = [
      {
        header: 'Status',
        accessorKey: 'status',
        sortFn: ruleStatusSort,
        sortDescFirst: false,
      },
    ] satisfies TableColumnDef<StatusRow>[];
    const statusData: StatusRow[] = [
      {
        status: <span>Background</span>,
        values: { status: GQLRuleStatus.Background },
      },
      {
        status: <span>Draft</span>,
        values: { status: GQLRuleStatus.Draft },
      },
      {
        status: <span>Live</span>,
        values: { status: GQLRuleStatus.Live },
      },
    ];
    render(
      <MemoryRouter>
        <Table columns={statusColumns} data={statusData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('columnheader', { name: /Status/ }));

    expect(
      within(screen.getAllByRole('rowgroup')[1])
        .getAllByRole('row')
        .map((row) => within(row).getByRole('cell').textContent),
    ).toEqual(['Live', 'Background', 'Draft']);
  });

  it('sorts a rendered age column by its nested raw date value', () => {
    type QueueRow = {
      oldestTaskAge: ReactNode;
      values: { oldestJobCreatedAt: string };
    };
    const queueColumns = [
      {
        header: 'Oldest Task Age',
        accessorKey: 'oldestTaskAge',
        sortFn: dateSort('oldestJobCreatedAt'),
        sortDescFirst: false,
      },
    ] satisfies TableColumnDef<QueueRow>[];
    const queueData: QueueRow[] = [
      {
        oldestTaskAge: <span>Newest task</span>,
        values: { oldestJobCreatedAt: '2026-08-11T00:00:00Z' },
      },
      {
        oldestTaskAge: <span>Oldest task</span>,
        values: { oldestJobCreatedAt: '2026-08-01T00:00:00Z' },
      },
      {
        oldestTaskAge: <span>Middle task</span>,
        values: { oldestJobCreatedAt: '2026-08-06T00:00:00Z' },
      },
    ];
    render(
      <MemoryRouter>
        <Table columns={queueColumns} data={queueData} />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('columnheader', { name: /Oldest Task Age/ }),
    );

    expect(
      within(screen.getAllByRole('rowgroup')[1])
        .getAllByRole('row')
        .map((row) => within(row).getByRole('cell').textContent),
    ).toEqual(['Oldest task', 'Middle task', 'Newest task']);
  });

  it('does not offer filtering unless a column supplies a filter renderer', () => {
    renderTable();
    expect(screen.queryByRole('button', { name: /filter/i })).toBeNull();
  });

  it('stages multiple filters until Save and supports clearing and removing them', () => {
    const filterColumns = [
      {
        ...columns[0],
        meta: { filter: filterFor('name', 'Filter names') },
        filterFn: 'text',
      },
      {
        ...columns[1],
        meta: { filter: filterFor('status', 'Filter statuses') },
        filterFn: 'text',
      },
    ] satisfies TableColumnDef<TableRow>[];
    renderTable(filterColumns);

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    const filterMenu = screen
      .getByRole('button', { name: 'Save' })
      .closest<HTMLElement>('.absolute');
    expect(filterMenu).not.toBeNull();
    fireEvent.click(within(filterMenu!).getByText('Name'));
    fireEvent.change(screen.getByPlaceholderText('Filter names'), {
      target: { value: 'alp' },
    });
    fireEvent.click(within(filterMenu!).getByText('Status'));
    fireEvent.change(screen.getByPlaceholderText('Filter statuses'), {
      target: { value: 'Closed' },
    });
    expectAllRowsVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Rendered Alpha')).toBeTruthy();
    expect(screen.queryByText('Rendered Alpine')).toBeNull();
    expect(screen.queryByText('Rendered Zulu')).toBeNull();
    expect(screen.getByText('Name: alp')).toBeTruthy();
    expect(screen.getByText('Status: Closed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    fireEvent.change(screen.getByPlaceholderText('Filter statuses'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Rendered Alpha')).toBeTruthy();
    expect(screen.getByText('Rendered Alpine')).toBeTruthy();
    expect(screen.queryByText('Rendered Zulu')).toBeNull();
    expect(screen.queryByText('Status: Closed')).toBeNull();

    const nameChip = screen.getByText('Name: alp');
    const closeIcon = nameChip.parentElement?.querySelector('svg');
    expect(closeIcon).not.toBeNull();
    fireEvent.click(closeIcon!);
    expectAllRowsVisible();
  });

  it('renders links and selects a clicked row using its raw data', () => {
    const onSelectRow = vi.fn();
    renderTable(columns, {
      rowLinkTo: (row: any) => `/rows/${row.original.values.id}`,
      onSelectRow,
    });

    const bodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole(
      'row',
    );
    expect(
      bodyRows.map((row) =>
        within(row)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ),
    ).toEqual([
      ['/rows/z', '/rows/z'],
      ['/rows/a', '/rows/a'],
      ['/rows/alpine', '/rows/alpine'],
    ]);
    const alphaRow = screen.getByText('Rendered Alpha').closest('tr')!;
    fireEvent.click(alphaRow);
    expect(onSelectRow).toHaveBeenCalledTimes(1);
    expect(onSelectRow.mock.calls[0][0].original.values.id).toBe('a');
    expect(alphaRow.classList.contains('bg-indigo-100')).toBe(true);
  });

  it('renders one collapsed summary cell per row instead of normal columns', () => {
    renderTable(columns, {
      isCollapsed: true,
      collapsedColumnTitle: 'Summary',
      renderCollapsedCell: (row: any) =>
        `Collapsed ${row.original.values.name}`,
    });

    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Summary' })).toBeTruthy();
    expect(screen.getAllByRole('cell')).toHaveLength(3);
    expect(screen.getByText('Collapsed Zulu')).toBeTruthy();
    expect(screen.getByText('Collapsed Alpha')).toBeTruthy();
    expect(screen.getByText('Collapsed Alpine')).toBeTruthy();
    expect(screen.queryByText('Open')).toBeNull();
    expect(screen.queryByText('Closed')).toBeNull();
  });

  it('facets raw options by other filters but not the probed column filter', () => {
    const facetData: TableRow[] = [
      {
        name: <span>Label One</span>,
        status: 'Open',
        values: { id: 'group-a-1', name: 'Alpha', status: 'Open' },
      },
      {
        name: <span>Label Two</span>,
        status: 'Open',
        values: { id: 'group-a-2', name: 'Bravo', status: 'Open' },
      },
      {
        name: <span>Label Three</span>,
        status: 'Open',
        values: { id: 'group-b-1', name: 'Charlie', status: 'Open' },
      },
      {
        name: <span>Label Four</span>,
        status: 'Closed',
        values: { id: 'group-a-3', name: 'Delta', status: 'Closed' },
      },
    ];
    const FacetFilter = (props: ColumnProps<TableRow>) => (
      <>
        <div data-testid="facets">
          {props.preFilteredRows
            .map((row) => row.original.values.name)
            .sort()
            .join(',')}
        </div>
        <DefaultColumnFilter
          columnProps={props}
          accessor="name"
          placeholder="Filter facets"
        />
      </>
    );
    const filterColumns: TableColumnDef<TableRow>[] = [
      {
        ...columns[0],
        meta: { filter: FacetFilter },
        filterFn: 'text',
      },
      {
        ...columns[1],
        meta: { filter: filterFor('status', 'Filter statuses') },
        filterFn: 'text',
      },
      {
        header: 'ID',
        id: 'id',
        accessorFn: (row) => row.values.id,
        cell: ({ row }) => `Rendered ${row.original.values.id}`,
        meta: { filter: filterFor('id', 'Filter IDs') },
        filterFn: 'text',
      },
    ];
    render(
      <MemoryRouter>
        <Table columns={filterColumns} data={facetData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    let menu = screen
      .getByRole('button', { name: 'Save' })
      .closest<HTMLElement>('.absolute')!;
    fireEvent.click(within(menu).getByText('Name'));
    expect(screen.getByTestId('facets').textContent).toBe(
      'Alpha,Bravo,Charlie,Delta',
    );
    fireEvent.click(within(menu).getByText('Status'));
    fireEvent.change(screen.getByPlaceholderText('Filter statuses'), {
      target: { value: 'Open' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.getByTestId('facets').textContent).toBe(
      'Alpha,Bravo,Charlie',
    );
    menu = screen
      .getByRole('button', { name: 'Save' })
      .closest<HTMLElement>('.absolute')!;
    fireEvent.click(within(menu).getByText('ID'));
    fireEvent.change(screen.getByPlaceholderText('Filter IDs'), {
      target: { value: 'group-a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.getByTestId('facets').textContent).toBe('Alpha,Bravo');

    fireEvent.change(screen.getByPlaceholderText('Filter facets'), {
      target: { value: 'Alpha' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.getByTestId('facets').textContent).toBe('Alpha,Bravo');
  });

  it('stages an inclusive numeric range and filters raw values on Save', () => {
    type NumericRow = {
      score: ReactNode;
      values: { score: number };
    };
    const numericData: NumericRow[] = [
      { score: <span>Low score</span>, values: { score: 4 } },
      { score: <span>Boundary score</span>, values: { score: 5 } },
      { score: <span>High score</span>, values: { score: 8 } },
    ];
    const numericColumns = [
      {
        header: 'Score',
        accessorKey: 'score',
        cell: ({ getValue }): ReactNode => getValue<ReactNode>(),
        meta: {
          filter: (props: ColumnProps<NumericRow>) =>
            NumberRangeColumnFilter({
              columnProps: props,
              accessor: 'score',
            }),
        },
        filterFn: 'range',
      },
    ] satisfies TableColumnDef<NumericRow>[];
    render(
      <MemoryRouter>
        <Table columns={numericColumns} data={numericData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    const filterMenu = screen
      .getByRole('button', { name: 'Save' })
      .closest<HTMLElement>('.absolute');
    expect(filterMenu).not.toBeNull();
    fireEvent.click(within(filterMenu!).getByText('Score'));
    fireEvent.change(screen.getByPlaceholderText('min'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByPlaceholderText('max'), {
      target: { value: '8' },
    });
    expect(screen.getByText('Low score')).toBeTruthy();
    expect(screen.getByText('Boundary score')).toBeTruthy();
    expect(screen.getByText('High score')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByText('Low score')).toBeNull();
    expect(screen.getByText('Boundary score')).toBeTruthy();
    expect(screen.getByText('High score')).toBeTruthy();
  });

  it('applies zero-valued lower and upper numeric range bounds', () => {
    type NumericRow = {
      score: ReactNode;
      values: { score: number };
    };
    const numericData: NumericRow[] = [
      { score: <span>Negative score</span>, values: { score: -1 } },
      { score: <span>Zero score</span>, values: { score: 0 } },
      { score: <span>Positive score</span>, values: { score: 1 } },
    ];
    const numericColumns = [
      {
        header: 'Score',
        accessorKey: 'score',
        cell: ({ getValue }): ReactNode => getValue<ReactNode>(),
        meta: {
          filter: (props: ColumnProps<NumericRow>) =>
            NumberRangeColumnFilter({
              columnProps: props,
              accessor: 'score',
            }),
        },
        filterFn: 'range',
      },
    ] satisfies TableColumnDef<NumericRow>[];
    render(
      <MemoryRouter>
        <Table columns={numericColumns} data={numericData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    const filterMenu = screen
      .getByRole('button', { name: 'Save' })
      .closest<HTMLElement>('.absolute')!;
    fireEvent.click(within(filterMenu).getByText('Score'));
    fireEvent.change(screen.getByPlaceholderText('min'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByPlaceholderText('max'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByText('Negative score')).toBeNull();
    expect(screen.getByText('Zero score')).toBeTruthy();
    expect(screen.queryByText('Positive score')).toBeNull();
  });
});
