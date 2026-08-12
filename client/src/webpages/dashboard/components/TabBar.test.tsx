import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import TabBar from './TabBar';

describe('TabBar', () => {
  it('renders keyed tooltip and plain tabs and selects a clicked tab', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onTabClick = vi.fn();

    try {
      render(
        <TabBar
          tabs={[
            { label: 'Overview', value: 'overview' },
            {
              label: 'Roles',
              value: 'roles',
              tooltip: 'Manage roles',
            },
          ]}
          initialSelectedTab="overview"
          onTabClick={onTabClick}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Roles' }));

      expect(onTabClick).toHaveBeenCalledWith('roles');
      expect(
        screen
          .getByRole('tab', { name: 'Roles' })
          .classList.contains('border-b-primary'),
      ).toBe(true);
      expect(
        consoleError.mock.calls.some((call) =>
          call.some((argument) =>
            String(argument).includes(
              'Each child in a list should have a unique "key" prop',
            ),
          ),
        ),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
