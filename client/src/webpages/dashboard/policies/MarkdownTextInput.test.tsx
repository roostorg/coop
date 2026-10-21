import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import MarkdownTextInput from './MarkdownTextInput';

function ControlledEditor({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  return (
    <>
      <MarkdownTextInput text={text} setText={setText} />
      <output aria-label="Saved HTML">{text}</output>
    </>
  );
}

describe('MarkdownTextInput', () => {
  beforeAll(() => {
    // jsdom does not implement the range geometry used to scroll the selection.
    Object.defineProperties(Range.prototype, {
      getClientRects: { configurable: true, value: () => [] },
      getBoundingClientRect: {
        configurable: true,
        value: () => new DOMRect(),
      },
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
  });

  it('converts a heading to normal text and supports undo and redo', async () => {
    render(<ControlledEditor initialText="<h2>Policy definition</h2>" />);
    const style = await screen.findByRole('combobox', { name: 'Text style' });
    const saved = screen.getByLabelText('Saved HTML');

    fireEvent.change(style, { target: { value: 'paragraph' } });
    await waitFor(() =>
      expect(saved.textContent).toBe('<p>Policy definition</p>'),
    );
    expect(style).toHaveValue('paragraph');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(saved.textContent).toBe('<h2>Policy definition</h2>'),
    );
    expect(style).toHaveValue('2');

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(saved.textContent).toBe('<p>Policy definition</p>'),
    );
  });

  it.each([
    ['Bulleted list', 'ul'],
    ['Numbered list', 'ol'],
  ])('toggles %s without losing text', async (label, tag) => {
    render(<ControlledEditor initialText="<p>Keep this text</p>" />);
    const button = await screen.findByRole('button', { name: label });
    const saved = screen.getByLabelText('Saved HTML');

    fireEvent.click(button);
    await waitFor(() =>
      expect(saved.textContent).toBe(
        `<${tag}><li><p>Keep this text</p></li></${tag}>`,
      ),
    );
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    await waitFor(() =>
      expect(saved.textContent).toBe('<p>Keep this text</p>'),
    );
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts without undo history and accepts externally loaded content', async () => {
    const { rerender } = render(
      <MarkdownTextInput text="" setText={() => {}} />,
    );
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

    rerender(
      <MarkdownTextInput text="<h3>Loaded policy</h3>" setText={() => {}} />,
    );
    expect(
      await screen.findByRole('heading', { name: 'Loaded policy', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('3');
  });

  it('disables editing and formatting when disabled', async () => {
    const { container } = render(
      <MarkdownTextInput text="<p>Read only</p>" setText={() => {}} disabled />,
    );

    expect(await screen.findByRole('combobox')).toBeDisabled();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
    expect(container.querySelector('.tiptap')).toHaveAttribute(
      'contenteditable',
      'false',
    );
  });
});
