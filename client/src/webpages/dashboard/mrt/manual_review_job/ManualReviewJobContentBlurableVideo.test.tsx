import { render } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import ManualReviewJobContentBlurableVideo from './ManualReviewJobContentBlurableVideo';

vi.mock('react-player', () => ({
  default: function MockPlayer() {
    return <div data-testid="player" />;
  },
}));

describe('ManualReviewJobContentBlurableVideo hover unblur', () => {
  it('keeps play-to-unblur and adds group-hover unblur on a blurred video', () => {
    const { container } = render(
      <ManualReviewJobContentBlurableVideo
        url="https://example.test/sample.mp4"
        options={{ shouldBlur: true }}
      />,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toMatch(/\bgroup\b/);

    const blurred = wrapper?.querySelector('.blur-sm');
    expect(blurred).toBeTruthy();
    expect(blurred?.className).toMatch(/group-hover:blur-none/);
    expect(blurred?.className).not.toMatch(/\bblur-0\b/);
  });
});
