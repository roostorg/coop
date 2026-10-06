import { fireEvent, render, screen } from '@testing-library/react';

import { Input } from './Input';

describe('Input allowClear', () => {
  it('shows the clear button once an uncontrolled input has a value', () => {
    render(<Input aria-label="Search" allowClear />);
    expect(
      screen.queryByRole('button', { name: 'Clear' }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'abc' },
    });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('hides the clear button for disabled and read-only inputs', () => {
    const { rerender } = render(
      <Input aria-label="Search" allowClear disabled value="abc" readOnly />,
    );
    expect(
      screen.queryByRole('button', { name: 'Clear' }),
    ).not.toBeInTheDocument();
    rerender(<Input aria-label="Search" allowClear readOnly value="abc" />);
    expect(
      screen.queryByRole('button', { name: 'Clear' }),
    ).not.toBeInTheDocument();
  });
});
