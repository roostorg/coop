import { GQLThemePreference } from '../graphql/generated';

export const THEME_PREFERENCES = [
  GQLThemePreference.System,
  GQLThemePreference.Light,
  GQLThemePreference.Dark,
] as const;

export const THEME_PREFERENCE_LABELS: Record<GQLThemePreference, string> = {
  [GQLThemePreference.System]: 'System',
  [GQLThemePreference.Light]: 'Light',
  [GQLThemePreference.Dark]: 'Dark',
};

export const NEXT_THEME_FOR_PREFERENCE: Record<
  GQLThemePreference,
  'system' | 'light' | 'dark'
> = {
  [GQLThemePreference.System]: 'system',
  [GQLThemePreference.Light]: 'light',
  [GQLThemePreference.Dark]: 'dark',
};
