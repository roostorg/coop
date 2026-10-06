import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineVersionedConfig } from '@viteplus/versions';

import { configureMarkdown, headingId, sidebar } from './site.mjs';

export default () => {
  const output = { base: '/coop/', outDir: resolve('.vitepress/dist') };
  if (process.env.npm_lifecycle_event === 'preview') return output;

  const source = resolve('.vitepress/work');
  const manifest = JSON.parse(
    readFileSync(resolve(source, 'versions.json'), 'utf8'),
  );
  return defineVersionedConfig({
    title: 'Coop',
    description:
      'Documentation for Coop, the open source review and moderation tool from ROOST.',
    lang: 'en',
    ...output,
    srcDir: '.vitepress/work',
    publicDir: resolve(source, 'public'),
    srcExclude: [
      '**/SUMMARY.md',
      '**/images/adopters/README.md',
      'public/**',
      'extracted/**',
    ],
    versionsConfig: {
      current: 'latest',
      versionSwitcher: false,
      hooks: {
        rewritesHook: (path, version) =>
          `${version}/${path.replace(/(^|\/)README\.md$/, '$1index.md')}`,
      },
    },
    // These links open the reader's local Coop services, not documentation pages.
    ignoreDeadLinks: [/^https?:\/\/localhost(?::\d+)?(?:\/|$)/],
    head: [
      ['link', { rel: 'icon', href: '/coop/latest/theme/favicon.svg' }],
      [
        'meta',
        {
          property: 'og:image',
          content:
            'https://roostorg.github.io/coop/latest/theme/images/card.png',
        },
      ],
    ],
    markdown: {
      anchor: { slugify: headingId },
      config(md) {
        configureMarkdown(md);
      },
    },
    themeConfig: {
      logo: '/latest/theme/favicon.svg',
      siteTitle: 'Coop docs',
      docsVersions: manifest,
      sidebar: Object.fromEntries(
        manifest.versions.map(({ name }) => [
          name,
          sidebar(
            readFileSync(
              resolve(source, 'archive', name, 'SUMMARY.md'),
              'utf8',
            ),
          ),
        ]),
      ),
      outline: [2, 3],
      search: { provider: 'local' },
      socialLinks: [
        { icon: 'github', link: 'https://github.com/roostorg/coop' },
      ],
      editLink: {
        pattern: ({ relativePath }) => {
          const [version, ...path] = relativePath.split('/');
          return `https://github.com/roostorg/coop/edit/${version === 'latest' ? 'main' : version}/docs/${path.join('/').replace(/(^|\/)index\.md$/, '$1README.md')}`;
        },
        text: 'Edit this page on GitHub',
      },
      footer: {
        message: 'Coop is an open source project from ROOST and the community.',
      },
    },
  });
};
