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
