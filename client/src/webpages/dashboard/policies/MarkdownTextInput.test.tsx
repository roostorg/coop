import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MarkdownTextInput from './MarkdownTextInput';

afterEach(cleanup);

describe('MarkdownTextInput', () => {
  it('synchronizes incoming HTML silently and preserves whitespace', async () => {
    const setText = vi.fn();
    const { container, rerender } = render(
      <MarkdownTextInput text="<p>Initial text</p>" setText={setText} />,
    );
    const content = container.querySelector('.tiptap')!;
    await waitFor(() => expect(content.innerHTML).toBe('<p>Initial text</p>'));

    rerender(<MarkdownTextInput text="<p>New  text</p>" setText={setText} />);

    await waitFor(() => expect(content.innerHTML).toBe('<p>New  text</p>'));
    expect(setText).not.toHaveBeenCalled();
  });

  it('retains the existing HTML schema without links, underline, or a trailing paragraph', async () => {
    const { container } = render(
      <MarkdownTextInput
        text={
          '<p><a href="https://example.com">Link</a> <u>underline</u> <strong>bold</strong></p><ol style="list-style-type: upper-roman"><li><p>Styled item</p></li></ol><ol start="3" type="1"><li><p>Last item</p></li></ol>'
        }
        setText={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('.tiptap')!.innerHTML).toBe(
        '<p>Link underline <strong>bold</strong></p><ol type="I"><li><p>Styled item</p></li></ol><ol start="3"><li><p>Last item</p></li></ol>',
      ),
    );
  });

  it('converts numbered plain text to a list and reports the edited HTML', async () => {
    const setText = vi.fn();
    const { container } = render(
      <MarkdownTextInput text="<p></p>" setText={setText} />,
    );
    const content = container.querySelector('.tiptap')!;
    await waitFor(() => expect(content.querySelector('p')).not.toBeNull());

    const getData: DataTransfer['getData'] = (type) =>
      type === 'text/plain' ? '3. Alpha\n4. Beta' : '';
    fireEvent.paste(content, {
      clipboardData: {
        getData,
        files: [],
      },
    });

    await waitFor(() =>
      expect(setText).toHaveBeenLastCalledWith(
        '<ol start="3"><li><p>Alpha</p></li><li><p>Beta</p></li></ol>',
      ),
    );
  });

  it('retains the small and disabled editor states', async () => {
    const { container, rerender } = render(
      <MarkdownTextInput text="<p>Text</p>" setText={vi.fn()} />,
    );
    rerender(
      <MarkdownTextInput
        text="<p>Text</p>"
        setText={vi.fn()}
        textSize="small"
        disabled
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('.tiptap')).toHaveAttribute(
        'contenteditable',
        'false',
      ),
    );
    expect(container.querySelector('.tiptap')).toHaveClass('text-base');
  });
});
