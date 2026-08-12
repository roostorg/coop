import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import ItemTypePreview from './ItemTypePreview';

test('renders preview tooltip rows in a table body without a DOM nesting error', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const { container } = render(
      <ItemTypePreview
        kind="CONTENT"
        roles={{
          createdAt: undefined,
          creatorId: undefined,
          threadId: 'thread_id',
          displayName: undefined,
          parentId: undefined,
          isDeleted: undefined,
        }}
      />,
    );

    fireEvent.mouseEnter(container.firstElementChild!.firstElementChild!);

    const table = await screen.findByRole('table');
    const tableBody =
      table.querySelector<HTMLTableSectionElement>(':scope > tbody');

    expect(tableBody).not.toBeNull();
    expect(tableBody!.querySelectorAll(':scope > tr')).toHaveLength(5);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('thread_id')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.getByText('Thread')).toBeTruthy();
    await waitFor(() =>
      expect(
        consoleError.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('cannot be a child') &&
            call.includes('<tr>') &&
            call.includes('table'),
        ),
      ).toBe(false),
    );
  } finally {
    consoleError.mockRestore();
  }
});
