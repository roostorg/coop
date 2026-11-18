import { Ignitor } from '@adonisjs/core';
import type { AppEnvironments } from '@adonisjs/core/types/app';

import rcFile from '../adonisrc.js';
import config from '../config/index.js';
import { type Dependencies } from '../iocContainer/index.js';

/** The directory that holds `adonisrc` (the source dir, or `transpiled/`). */
export const APP_ROOT = new URL('../', import.meta.url);

/**
 * Creates and initializes an AdonisJS application for one of the server's
 * entry points: `web` (bin/www.ts), `console` (ace commands, workers and
 * jobs) or `test` (the Vitest harness).
 *
 * The rc file and config are passed in rather than read from disk; see the
 * comment in `adonisrc.ts`. `deps` replaces Coop's service graph, which is how
 * the test harness injects mocks.
 */
export async function createCoopApp(
  environment: AppEnvironments,
  opts: { deps?: Dependencies } = {},
) {
  const ignitor = new Ignitor(APP_ROOT, {
    importer: async (filePath) => import(filePath),
  });
  const app = ignitor.createApp(environment);
  app.rcContents(rcFile);
  app.useConfig(config);
  await app.init();
  if (opts.deps) {
    app.container.bindValue('coop.deps', opts.deps);
  }
  return { ignitor, app };
}
