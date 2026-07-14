import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import CollapsibleText from '@/webpages/dashboard/mrt/manual_review_job/v2/components/CollapsibleText';

describe('CollapsibleText', () => {
  it('renders short text in full without a Read more button', () => {
    render(<CollapsibleText text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('collapses text exceeding maxGraphemes and shows Read more', () => {
    const longText = 'a'.repeat(2001);
    render(<CollapsibleText text={longText} />);
    // The full text is in the DOM (CSS line-clamp hides overflow visually, not in the DOM).
    expect(screen.getByText(longText)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /read more/i }),
    ).toBeInTheDocument();
  });

  it('expands to full text and toggles to Read less on click', () => {
    const longText = 'a'.repeat(2001);
    render(<CollapsibleText text={longText} />);
    const moreButton = screen.getByRole('button', { name: /read more/i });
    fireEvent.click(moreButton);
    expect(
      screen.getByRole('button', { name: /read less/i }),
    ).toBeInTheDocument();
    // Full text is now rendered (not clamped).
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it('collapses again on Read less click', () => {
    const longText = 'a'.repeat(2001);
    render(<CollapsibleText text={longText} />);
    fireEvent.click(screen.getByRole('button', { name: /read more/i }));
    fireEvent.click(screen.getByRole('button', { name: /read less/i }));
    expect(
      screen.getByRole('button', { name: /read more/i }),
    ).toBeInTheDocument();
  });

  it('counts graphemes, not UTF-16 code units (emoji with skin tone)', () => {
    // 👨🏿 is a single grapheme but 4 UTF-16 code units. A naive `.length`
    // check would collapse at 501 such graphemes (length 2004 > 2000), but
    // a correct grapheme count (501) stays under the threshold → no collapse.
    const grapheme = '👨🏿';
    const underThresholdByGrapheme = grapheme.repeat(501);
    expect(underThresholdByGrapheme.length).toBeGreaterThan(2000);
    render(<CollapsibleText text={underThresholdByGrapheme} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    // 2001 graphemes (8016 UTF-16 code units) does exceed the grapheme
    // threshold → collapses.
    const overThresholdByGrapheme = grapheme.repeat(2001);
    render(<CollapsibleText text={overThresholdByGrapheme} />);
    expect(
      screen.getByRole('button', { name: /read more/i }),
    ).toBeInTheDocument();
  });

  it('respects a custom maxGraphemes threshold', () => {
    // 11 chars, under default maxGraphemes (2000) but over custom maxGraphemes (10).
    render(<CollapsibleText text="12345678901" maxGraphemes={10} />);
    expect(
      screen.getByRole('button', { name: /read more/i }),
    ).toBeInTheDocument();
  });

  it('respects a custom maxLines threshold for wrapping text', () => {
    const wrappingText = 'wrap '.repeat(20).trim();
    const { container, rerender } = render(
      <div style={{ width: 80 }}>
        <CollapsibleText text={wrappingText} maxGraphemes={10} maxLines={2} />
      </div>,
    );
    const clampedDiv = container.querySelector(
      'div[style*="-webkit-box"]',
    ) as HTMLElement;
    expect(clampedDiv.style.webkitLineClamp).toBe('2');

    rerender(
      <div style={{ width: 80 }}>
        <CollapsibleText text={wrappingText} maxGraphemes={10} maxLines={3} />
      </div>,
    );
    expect(clampedDiv.style.webkitLineClamp).toBe('3');
  });

  it('does not collapse text at exactly maxGraphemes', () => {
    render(<CollapsibleText text={'a'.repeat(2000)} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('resets to collapsed when the text prop changes', () => {
    // Simulates navigating between review jobs that reuse the same field name
    // (React reuses the CollapsibleText instance). Expanding one long value,
    //then rendering a different long value, must restore the collapsed state.
    const { rerender } = render(<CollapsibleText text={'a'.repeat(2001)} />);
    fireEvent.click(screen.getByRole('button', { name: /read more/i }));
    expect(
      screen.getByRole('button', { name: /read less/i }),
    ).toBeInTheDocument();

    rerender(<CollapsibleText text={'b'.repeat(2001)} />);
    expect(
      screen.getByRole('button', { name: /read more/i }),
    ).toBeInTheDocument();
  });
});
