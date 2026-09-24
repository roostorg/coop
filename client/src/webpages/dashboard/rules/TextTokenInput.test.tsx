import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom/extend-expect';

import { vi } from 'vitest';

import TextTokenInput from './TextTokenInput';

describe('TextTokenInput', () => {
  it('commits pending text to a token on blur', () => {
    const updateTokenValues = vi.fn();
    render(
      <TextTokenInput
        uniqueKey="test"
        updateTokenValues={updateTokenValues}
        initialValues={[]}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'testword' } });
    fireEvent.blur(input);

    expect(updateTokenValues).toHaveBeenCalledWith(['testword']);
    expect(screen.getByText('testword')).toBeInTheDocument();
  });

  it('does not create an empty token when blurring an empty field', () => {
    const updateTokenValues = vi.fn();
    render(
      <TextTokenInput
        uniqueKey="test"
        updateTokenValues={updateTokenValues}
        initialValues={[]}
      />,
    );

    fireEvent.blur(screen.getByRole('textbox'));

    expect(updateTokenValues).not.toHaveBeenCalled();
  });

  it('commits only once when an outside click also triggers blur', () => {
    const updateTokenValues = vi.fn();
    render(
      <TextTokenInput
        uniqueKey="test"
        updateTokenValues={updateTokenValues}
        initialValues={[]}
      />,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'testword' } });

    // Clicking a focusable element outside the input: the browser fires blur
    // (which commits) before the document click handler runs.
    fireEvent.blur(input);
    input.blur();
    fireEvent.click(document.body);

    expect(updateTokenValues).toHaveBeenCalledTimes(1);
    expect(updateTokenValues).toHaveBeenCalledWith(['testword']);
  });

  it('still commits on a click outside that does not move focus (dead space)', () => {
    const updateTokenValues = vi.fn();
    render(
      <TextTokenInput
        uniqueKey="test"
        updateTokenValues={updateTokenValues}
        initialValues={[]}
      />,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'testword' } });

    // A click on non-focusable page chrome leaves the input focused, so no
    // blur fires — the document click handler is what commits here.
    fireEvent.click(document.body);

    expect(updateTokenValues).toHaveBeenCalledTimes(1);
    expect(updateTokenValues).toHaveBeenCalledWith(['testword']);
  });
});
