import {
  colorSchemeClassName,
  colorSchemeFromPreferences,
  moderatorSafetyFilterStyle,
  preferencesFromColorScheme,
} from './safetySettings';

describe('safetySettings color scheme', () => {
  it('maps boolean preferences to a color scheme', () => {
    expect(
      colorSchemeFromPreferences({
        moderatorSafetyGrayscale: true,
        moderatorSafetySepia: false,
      }),
    ).toBe('GRAYSCALE');
    expect(
      colorSchemeFromPreferences({
        moderatorSafetyGrayscale: false,
        moderatorSafetySepia: true,
      }),
    ).toBe('SEPIA');
    expect(
      colorSchemeFromPreferences({
        moderatorSafetyGrayscale: false,
        moderatorSafetySepia: false,
      }),
    ).toBe('NONE');
  });

  it('prefers grayscale if both stored flags are set', () => {
    expect(
      colorSchemeFromPreferences({
        moderatorSafetyGrayscale: true,
        moderatorSafetySepia: true,
      }),
    ).toBe('GRAYSCALE');
  });

  it('maps a color scheme back to mutually exclusive booleans', () => {
    expect(preferencesFromColorScheme('GRAYSCALE')).toEqual({
      moderatorSafetyGrayscale: true,
      moderatorSafetySepia: false,
    });
    expect(preferencesFromColorScheme('SEPIA')).toEqual({
      moderatorSafetyGrayscale: false,
      moderatorSafetySepia: true,
    });
    expect(preferencesFromColorScheme('NONE')).toEqual({
      moderatorSafetyGrayscale: false,
      moderatorSafetySepia: false,
    });
  });

  it('round-trips every scheme', () => {
    for (const scheme of ['NONE', 'GRAYSCALE', 'SEPIA'] as const) {
      expect(
        colorSchemeFromPreferences(preferencesFromColorScheme(scheme)),
      ).toBe(scheme);
    }
  });

  it('maps a color scheme to its Tailwind class', () => {
    expect(colorSchemeClassName('GRAYSCALE')).toBe('grayscale');
    expect(colorSchemeClassName('SEPIA')).toBe('sepia');
    expect(colorSchemeClassName('NONE')).toBe('');
  });

  it('never yields both filter classes even if both flags are set', () => {
    expect(
      colorSchemeClassName(
        colorSchemeFromPreferences({
          moderatorSafetyGrayscale: true,
          moderatorSafetySepia: true,
        }),
      ),
    ).toBe('grayscale');
  });
});

describe('moderatorSafetyFilterStyle', () => {
  it('keeps the pixel value each blur level rendered before', () => {
    const pixelsByLevel = [0, 4, 8, 12, 16, 24, 40];
    pixelsByLevel.forEach((pixels, level) => {
      expect(
        moderatorSafetyFilterStyle({ blurLevel: level, shouldBlur: true }),
      ).toBe(level === 0 ? undefined : `blur(${pixels}px)`);
    });
  });

  it('drops the blur when this media should not be blurred', () => {
    expect(
      moderatorSafetyFilterStyle({ blurLevel: 6, shouldBlur: false }),
    ).toBeUndefined();
  });

  it('clamps levels outside the configurable range', () => {
    expect(
      moderatorSafetyFilterStyle({ blurLevel: 99, shouldBlur: true }),
    ).toBe('blur(40px)');
    expect(
      moderatorSafetyFilterStyle({ blurLevel: -1, shouldBlur: true }),
    ).toBeUndefined();
  });

  it('composes blur and color scheme', () => {
    expect(
      moderatorSafetyFilterStyle({
        blurLevel: 3,
        shouldBlur: true,
        grayscale: true,
      }),
    ).toBe('blur(12px) grayscale(100%)');
    expect(
      moderatorSafetyFilterStyle({
        blurLevel: 3,
        shouldBlur: true,
        sepia: true,
      }),
    ).toBe('blur(12px) sepia(100%)');
  });

  it('applies a color scheme on its own', () => {
    expect(moderatorSafetyFilterStyle({ grayscale: true })).toBe(
      'grayscale(100%)',
    );
    expect(moderatorSafetyFilterStyle({ sepia: true })).toBe('sepia(100%)');
  });

  it('never applies both color filters, like the settings screens', () => {
    expect(moderatorSafetyFilterStyle({ grayscale: true, sepia: true })).toBe(
      'grayscale(100%)',
    );
  });

  it('returns undefined when there is nothing to apply', () => {
    expect(moderatorSafetyFilterStyle({})).toBeUndefined();
    expect(
      moderatorSafetyFilterStyle({ blurLevel: 0, shouldBlur: true }),
    ).toBeUndefined();
  });
});
