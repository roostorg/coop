import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '@testing-library/jest-dom/extend-expect';

import { Switch } from '@/coop-ui/Switch';

describe('Switch Component', () => {
  test('renders the switch component', () => {
    render(<Switch />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeInTheDocument();
  });

  test('toggles the switch on and off', async () => {
    render(<Switch id="toggle-switch" />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    userEvent.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'true');

    userEvent.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });

  test('switch is disabled', () => {
    render(<Switch id="disabled-switch" disabled />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeDisabled();

    userEvent.click(switchElement);
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });
});
