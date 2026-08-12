import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import ItemTypesExplainer from './ItemTypesExplainer';

test('renders the three explainer rows inside a table body without a DOM nesting error', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    render(<ItemTypesExplainer />);

    const table = screen.getByRole('table');
    const tableBody =
      table.querySelector<HTMLTableSectionElement>(':scope > tbody');

    expect(
      consoleError.mock.calls.some(
        (call) =>
          call[0]?.includes('cannot be a child') &&
          call.includes('<tr>') &&
          call.includes('table'),
      ),
    ).toBe(false);
    expect(tableBody).not.toBeNull();
    expect(within(tableBody!).getAllByRole('row')).toHaveLength(3);
  } finally {
    consoleError.mockRestore();
  }
});
