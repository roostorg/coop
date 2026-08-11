import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Column } from 'react-table';
import { describe, expect, it, vi } from 'vitest';

import { ColumnProps, DefaultColumnFilter } from './filters';
import { stringSort } from './sort';
import Table from './Table';

type TableRow = {
  name: ReactNode;
  status: string;
  values: { id: string; name: string; status: string };
};

const columns = [
  { Header: 'Name', accessor: 'name', sortType: stringSort },
  { Header: 'Status', accessor: 'status', canSort: false },
] as unknown as Column<object>[];

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

function renderTable(tableColumns: Column<object>[] = columns, props = {}) {
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
  (accessor: 'name' | 'status', placeholder: string) => (props: ColumnProps) =>
    DefaultColumnFilter({ columnProps: props, accessor, placeholder });

describe('Table v7 behavior', () => {
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

  it('does not offer filtering unless a column supplies a filter renderer', () => {
    renderTable();
    expect(screen.queryByRole('button', { name: /filter/i })).toBeNull();
  });

  it('stages multiple filters until Save and supports clearing and removing them', () => {
    const filterColumns = [
      {
        ...columns[0],
        Filter: filterFor('name', 'Filter names'),
        filter: 'text',
      },
      {
        ...columns[1],
        Filter: filterFor('status', 'Filter statuses'),
        filter: 'text',
      },
    ] as unknown as Column<object>[];
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
});
