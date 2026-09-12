import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { vi } from 'vitest';

import ManualReviewJobContentBlurableVideo from './ManualReviewJobContentBlurableVideo';

const { playerProps } = vi.hoisted(() => ({
  playerProps: [] as Record<string, unknown>[],
}));

function ReactPlayerMock(props: Record<string, unknown>) {
  playerProps.push(props);
  return <video data-testid="react-player" />;
}

vi.mock('react-player', () => ({ default: ReactPlayerMock }));

type VideoOptions = NonNullable<
  ComponentProps<typeof ManualReviewJobContentBlurableVideo>['options']
>;

function renderVideo(options: VideoOptions) {
  const { container } = render(
    <ManualReviewJobContentBlurableVideo
      url="https://example.com/reported.mp4"
      options={options}
    />,
  );
  const player = screen.getByTestId('react-player');
  const filtered = player.parentElement;
  if (filtered == null) {
    throw new Error('expected the player to be wrapped');
  }
  return {
    wrapper: container.firstElementChild as HTMLElement,
    filtered,
    playButton: container.querySelector('.cursor-pointer') as HTMLElement,
  };
}

beforeEach(() => {
  playerProps.length = 0;
});

describe('ManualReviewJobContentBlurableVideo', () => {
  it('blurs with the pixel value of the configured level', () => {
    const { filtered } = renderVideo({ shouldBlur: true, blurStrength: 3 });
    expect(filtered.style.filter).toBe('blur(12px)');
  });

  it('applies the color scheme alongside the blur', () => {
    const { filtered } = renderVideo({
      shouldBlur: true,
      blurStrength: 3,
      grayscale: true,
    });
    expect(filtered.style.filter).toBe('blur(12px) grayscale(100%)');
  });

  // Regression test for roostorg/coop#524: hovering a blurred video did nothing.
  it('reveals the video while hovered and restores the blur after', () => {
    const { wrapper, filtered } = renderVideo({
      shouldBlur: true,
      blurStrength: 3,
      grayscale: true,
    });

    userEvent.hover(wrapper);
    expect(filtered.style.filter).toBe('grayscale(100%)');

    userEvent.unhover(wrapper);
    expect(filtered.style.filter).toBe('blur(12px) grayscale(100%)');
  });

  it('keeps the blur while the video plays', () => {
    const { wrapper, filtered, playButton } = renderVideo({
      shouldBlur: true,
      blurStrength: 3,
    });

    // Clicking moves the pointer onto the video, so leave it again: the
    // scenario is a playing video the moderator is not hovering.
    userEvent.click(playButton);
    userEvent.unhover(wrapper);

    expect(filtered.style.filter).toBe('blur(12px)');
  });

  it('keeps the blur while hovered when revealing is turned off', () => {
    const { wrapper, filtered } = renderVideo({
      shouldBlur: true,
      blurStrength: 3,
      revealOnHover: false,
    });

    userEvent.hover(wrapper);
    expect(filtered.style.filter).toBe('blur(12px)');
  });

  it('leaves media unfiltered when it should not be blurred', () => {
    const { filtered } = renderVideo({ shouldBlur: false, blurStrength: 3 });
    expect(filtered.style.filter).toBe('');
  });

  it('silences the player when the mute preference is on', () => {
    renderVideo({ shouldBlur: true, blurStrength: 3, muted: true });
    expect(playerProps.at(-1)?.volume).toBe(0);
  });

  it('leaves the volume alone when the mute preference is off', () => {
    renderVideo({ shouldBlur: true, blurStrength: 3, muted: false });
    expect(playerProps.at(-1)?.volume).toBeUndefined();
  });
});
