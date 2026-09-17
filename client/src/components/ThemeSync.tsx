import { gql } from '@apollo/client';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import { useGQLUserThemePreferenceQuery } from '../graphql/generated';
import { NEXT_THEME_FOR_PREFERENCE } from '../models/theme';

gql`
  query UserThemePreference {
    me {
      id
      interfacePreferences {
        themePreference
      }
    }
  }
`;

/**
 * Applies the signed-in user's persisted theme preference to next-themes.
 * Renders nothing; mount once inside the authenticated shell so it never
 * runs on the login/signup pages (those follow the system scheme).
 */
export default function ThemeSync() {
  const { setTheme } = useTheme();
  const { data } = useGQLUserThemePreferenceQuery();

  const themePreference = data?.me?.interfacePreferences?.themePreference;

  useEffect(() => {
    if (themePreference) {
      setTheme(NEXT_THEME_FOR_PREFERENCE[themePreference]);
    }
  }, [themePreference, setTheme]);

  return null;
}
