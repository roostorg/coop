import {
  colorSchemeClassName,
  colorSchemeFromPreferences,
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
