import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h, onMounted, shallowRef } from 'vue';

import VersionNavigation from './VersionNavigation.vue';

import './style.css';
import '../version-nav.css';

export default {
  extends: DefaultTheme,
  Layout: {
    setup() {
      const { theme } = useData();
      const manifest = shallowRef(theme.value.docsVersions);
      onMounted(async () => {
        const response = await fetch(`${manifest.value.base}versions.json`);
        if (response.ok) manifest.value = await response.json();
      });
      return () =>
        h(DefaultTheme.Layout, null, {
          'nav-bar-content-after': () =>
            h(VersionNavigation, { manifest: manifest.value }),
          'doc-before': () =>
            h(VersionNavigation, { manifest: manifest.value, notice: true }),
        });
    },
  },
};
