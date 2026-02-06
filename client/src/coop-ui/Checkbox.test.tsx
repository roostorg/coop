import { render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import { Checkbox } from '@/coop-ui/Checkbox';
import { CheckboxProps } from '@radix-ui/react-checkbox';
import userEvent from '@testing-library/user-event';

describe('Checkbox Component', () => {
  const renderCheckbox = (props: Partial<CheckboxProps> = {}) => {
    const defaultProps: CheckboxProps = {
      onCheckedChange: jest.fn(),
      ...props,
    };
    return render(<Checkbox {...defaultProps} />);
  };

  test('checkbox should be checked if the checked prop is true', () => {
    renderCheckbox({ checked: true });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('checkbox should not be checked if the checked prop is false', () => {
    renderCheckbox({ checked: false });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  test('calls onCheckedChange when the checkbox is clicked', () => {
    const handleChange = jest.fn();
    renderCheckbox({ onCheckedChange: handleChange });

    const checkbox = screen.getByRole('checkbox');
    userEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  test('does not call onCheckedChange when the checkbox is disabled', () => {
    const handleChange = jest.fn();
    renderCheckbox({ onCheckedChange: handleChange, disabled: true });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    userEvent.click(checkbox);

    expect(handleChange).not.toHaveBeenCalled();
  });

  test('renders with the correct id', () => {
    renderCheckbox({ id: 'test-checkbox' });
    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'test-checkbox');
  });

  test('renders with the defaultChecked prop and updates with checked prop', () => {
    const { rerender } = render(
      <Checkbox defaultChecked={true} onCheckedChange={jest.fn()} />,
    );
    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).toBeChecked();

    rerender(<Checkbox checked={false} onCheckedChange={jest.fn()} />);

    expect(checkbox).not.toBeChecked();

    rerender(<Checkbox checked={true} onCheckedChange={jest.fn()} />);

    expect(checkbox).toBeChecked();
  });

  test('renders with the disabled prop', () => {
    renderCheckbox({ disabled: true });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });
});
