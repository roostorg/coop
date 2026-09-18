import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { vi } from 'vitest';

import ManualReviewJobContentBlurableImage from './ManualReviewJobContentBlurableImage';

type ImageOptions = NonNullable<
  ComponentProps<typeof ManualReviewJobContentBlurableImage>['options']
>;

function renderImage(options: ImageOptions) {
  const { container } = render(
    <ManualReviewJobContentBlurableImage
      url="https://example.com/reported.jpg"
      options={options}
    />,
  );
  const image = container.querySelector('img');
  if (image == null) {
    throw new Error('expected the component to render an image');
  }
  return { wrapper: container.firstElementChild as HTMLElement, image };
}

describe('ManualReviewJobContentBlurableImage', () => {
  it('blurs with the pixel value of the configured level', () => {
    const { image } = renderImage({ shouldBlur: true, blurStrength: 3 });
    expect(image.style.filter).toBe('blur(12px)');
  });

  it('applies the color scheme alongside the blur', () => {
    const { image } = renderImage({
      shouldBlur: true,
      blurStrength: 3,
      grayscale: true,
    });
    expect(image.style.filter).toBe('blur(12px) grayscale(100%)');
  });

  it('reveals the image while hovered and keeps the color scheme', () => {
    const { wrapper, image } = renderImage({
      shouldBlur: true,
      blurStrength: 3,
      grayscale: true,
    });

    userEvent.hover(wrapper);
    expect(image.style.filter).toBe('grayscale(100%)');

    userEvent.unhover(wrapper);
    expect(image.style.filter).toBe('blur(12px) grayscale(100%)');
  });

  it('keeps the blur while hovered when revealing is turned off', () => {
    const { wrapper, image } = renderImage({
      shouldBlur: true,
      blurStrength: 3,
      revealOnHover: false,
    });

    userEvent.hover(wrapper);
    expect(image.style.filter).toBe('blur(12px)');
  });

  it('leaves media unfiltered when it should not be blurred', () => {
    const { image } = renderImage({ shouldBlur: false, blurStrength: 3 });
    expect(image.style.filter).toBe('');
  });

  it('does not read or write browser storage', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    renderImage({ shouldBlur: true, blurStrength: 3 });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
