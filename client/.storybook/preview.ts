import type { Preview } from '@storybook/react';

import '../src/styles/globals.css';
import 'tailwindcss/lib/css/preflight.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
