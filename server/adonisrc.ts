import { defineConfig } from '@adonisjs/core/app';

/**
 * AdonisJS application manifest.
 *
 * The app is always created through `adonis/createApp.ts`, which passes this
 * object to `app.rcContents()` rather than letting AdonisJS import
 * `adonisrc.js` from disk. Loading it from a TS module lets Vitest transform
 * the provider imports below, and lets the test harness create several app
 * instances in one process.
 */
export default defineConfig({
  typescript: true,
  directories: {
    config: 'config',
    commands: 'commands',
  },
  providers: [
    async () => import('@adonisjs/core/providers/app_provider'),
    async () => import('@adonisjs/cors/cors_provider'),
    async () => import('./providers/coop_provider.js'),
  ],
  commands: [
    async () => import('@adonisjs/core/commands'),
    async () => import('./ace_commands/index.js'),
  ],
  preloads: [],
});
