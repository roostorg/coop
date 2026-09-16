import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import { NumberInput, type NumberInputProps } from '@/coop-ui/NumberInput';

describe('NumberInput', () => {
  const renderInput = (props: Partial<NumberInputProps> = {}) => {
    const defaultProps: NumberInputProps = {
      value: undefined,
      onChange: jest.fn(),
      ...props,
    };
    render(<NumberInput {...defaultProps} />);
    return screen.getByRole('textbox');
  };

  test('renders as a text input, not type="number"', () => {
    const input = renderInput();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  test('typing non-numeric characters is filtered out and never reaches onChange as garbage', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange });
    fireEvent.change(input, { target: { value: 'abc123xyz' } });
    // Digits-only default: letters are stripped at input time.
    expect(input.value).toBe('123');
    expect(onChange).toHaveBeenLastCalledWith(123);
  });

  test('rejects "-" by default (allowNegative=false)', () => {
    const input = renderInput();
    fireEvent.change(input, { target: { value: '-4' } });
    expect(input.value).toBe('4');
  });

  test('allows negative integers when allowNegative is set', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange, allowNegative: true });
    fireEvent.change(input, { target: { value: '-4' } });
    expect(input.value).toBe('-4');
    expect(onChange).toHaveBeenLastCalledWith(-4);
  });

  test('a bare "-" mid-typing is not an error yet, and reports undefined', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange, allowNegative: true });
    fireEvent.change(input, { target: { value: '-' } });
    expect(input.value).toBe('-');
    expect(screen.queryByText(/enter a valid number/i)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test('rejects "." by default (allowDecimal=false)', () => {
    const input = renderInput();
    fireEvent.change(input, { target: { value: '9.99' } });
    expect(input.value).toBe('999');
  });

  test('allows decimals when allowDecimal is set, including 0.0 and -0.4', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange, allowDecimal: true, allowNegative: true });

    fireEvent.change(input, { target: { value: '0.0' } });
    expect(input.value).toBe('0.0');
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.change(input, { target: { value: '-0.4' } });
    expect(input.value).toBe('-0.4');
    expect(onChange).toHaveBeenLastCalledWith(-0.4);
  });

  test('a trailing decimal point ("9.") is not reformatted away while typing', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange, allowDecimal: true, value: 9 });
    fireEvent.change(input, { target: { value: '9.' } });
    expect(input.value).toBe('9.');
    expect(onChange).toHaveBeenLastCalledWith(9);
  });

  test('below min shows an inline error and withholds onChange instead of clamping', () => {
    const onChange = jest.fn();
    const input = renderInput({ onChange, min: 0, max: 100, value: 50 });
    fireEvent.change(input, { target: { value: '150' } });
    expect(input.value).toBe('150');
    expect(screen.getByText('Must be at most 100')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test('clearing an out-of-range field removes the error', () => {
    const input = renderInput({ min: 0, max: 100 });
    fireEvent.change(input, { target: { value: '150' } });
    expect(screen.getByText('Must be at most 100')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByText(/must be/i)).not.toBeInTheDocument();
  });

  test('clearing the field to retype is not fought by a parent that coerces undefined to 0', () => {
    // Simulates a caller whose own state is a required `number`, so its
    // onChange handler must coerce `undefined` back to some default —
    // which bounces straight back down as `value`. The field must still
    // let the user clear and retype without the display snapping back.
    function Wrapper() {
      const [stored, setStored] = React.useState(50);
      return (
        <NumberInput
          value={stored}
          onChange={(next) => setStored(next ?? 0)}
        />
      );
    }
    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '15' } });
    expect(input.value).toBe('15');
  });

  test('blur normalizes the display back to the committed value', () => {
    function Wrapper() {
      const [stored, setStored] = React.useState(50);
      return (
        <NumberInput value={stored} onChange={(next) => setStored(next ?? 0)} />
      );
    }
    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.blur(input);
    expect(input.value).toBe('0');
  });

  test('an external value change (not caused by this field) resyncs the display', () => {
    const { rerender } = render(
      <NumberInput value={5} onChange={jest.fn()} />,
    );
    const input = screen.getByRole('textbox');
    expect(input.value).toBe('5');

    rerender(<NumberInput value={42} onChange={jest.fn()} />);
    expect(input.value).toBe('42');
  });

  test('renders disabled', () => {
    const input = renderInput({ disabled: true });
    expect(input).toBeDisabled();
  });
});
