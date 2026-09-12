export const MODERATOR_SAFETY_COLOR_SCHEMES = [
  'NONE',
  'GRAYSCALE',
  'SEPIA',
] as const;

export type ModeratorSafetyColorScheme =
  (typeof MODERATOR_SAFETY_COLOR_SCHEMES)[number];

export const MODERATOR_SAFETY_COLOR_SCHEME_LABELS: Record<
  ModeratorSafetyColorScheme,
  string
> = {
  NONE: 'None',
  GRAYSCALE: 'Grayscale',
  SEPIA: 'Sepia',
};

// The API stores the color scheme as two independent booleans
// (moderatorSafetyGrayscale / moderatorSafetySepia) so the schema stays
// backwards-compatible; the UI models them as one mutually exclusive scheme.
// Grayscale wins if both flags are somehow set — the UI only ever writes one.
export function colorSchemeFromPreferences(preferences: {
  moderatorSafetyGrayscale: boolean;
  moderatorSafetySepia: boolean;
}): ModeratorSafetyColorScheme {
  if (preferences.moderatorSafetyGrayscale) {
    return 'GRAYSCALE';
  }
  if (preferences.moderatorSafetySepia) {
    return 'SEPIA';
  }
  return 'NONE';
}

// Tailwind filter class for a resolved color scheme. Deriving classes from the
// resolved scheme (rather than the raw booleans) keeps the "grayscale wins"
// invariant even if both flags are somehow set.
export function colorSchemeClassName(
  colorScheme: ModeratorSafetyColorScheme,
): string {
  switch (colorScheme) {
    case 'GRAYSCALE':
      return 'grayscale';
    case 'SEPIA':
      return 'sepia';
    case 'NONE':
      return '';
  }
}

export function preferencesFromColorScheme(
  colorScheme: ModeratorSafetyColorScheme,
): {
  moderatorSafetyGrayscale: boolean;
  moderatorSafetySepia: boolean;
} {
  return {
    moderatorSafetyGrayscale: colorScheme === 'GRAYSCALE',
    moderatorSafetySepia: colorScheme === 'SEPIA',
  };
}

// Each blur level keeps the pixel value its Tailwind `blur-*` class applied
// before wellness filters became a single inline `filter`.
const BLUR_PIXELS_BY_LEVEL = [0, 4, 8, 12, 16, 24, 40];

export const MAX_BLUR_LEVEL = BLUR_PIXELS_BY_LEVEL.length - 1;

// Single source for the `filter` applied to reviewed media, so every surface
// blurs and tints alike. Returns undefined when nothing applies, which leaves
// the style off the element entirely.
export function moderatorSafetyFilterStyle(options: {
  blurLevel?: number;
  shouldBlur?: boolean;
  grayscale?: boolean;
  sepia?: boolean;
}): string | undefined {
  const {
    blurLevel = 0,
    shouldBlur = false,
    grayscale = false,
    sepia = false,
  } = options;
  const filters: string[] = [];

  if (shouldBlur) {
    const level = Math.min(Math.max(Math.trunc(blurLevel), 0), MAX_BLUR_LEVEL);
    const pixels = BLUR_PIXELS_BY_LEVEL[level];
    if (pixels > 0) {
      filters.push(`blur(${pixels}px)`);
    }
  }

  const colorScheme = colorSchemeFromPreferences({
    moderatorSafetyGrayscale: grayscale,
    moderatorSafetySepia: sepia,
  });
  switch (colorScheme) {
    case 'GRAYSCALE':
      filters.push('grayscale(100%)');
      break;
    case 'SEPIA':
      filters.push('sepia(100%)');
      break;
    case 'NONE':
      break;
  }

  return filters.length > 0 ? filters.join(' ') : undefined;
}
