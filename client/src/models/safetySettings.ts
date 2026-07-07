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
