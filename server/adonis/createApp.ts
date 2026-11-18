import { Ignitor } from '@adonisjs/core';
import type { AppEnvironments } from '@adonisjs/core/types/app';

import rcFile from '../adonisrc.js';
import config from '../config/index.js';
import { type Dependencies } from '../iocContainer/index.js';

/** The directory that holds `adonisrc` (the source dir, or `transpiled/`). */
export const APP_ROOT = new URL('../', import.meta.url);

/**
 * An Ignitor whose every application gets Coop's rc file and config from
 * code rather than from disk (see the comment in `adonisrc.ts`), including
 * the application that `ignitor.ace()` creates for itself. `deps` replaces
 * Coop's service graph, which is how the test harness injects mocks.
 */
export function makeCoopIgnitor(opts: { deps?: Dependencies } = {}) {
  return new Ignitor(APP_ROOT, {
    importer: async (filePath) => import(filePath),
  }).tap((app) => {
    app.rcContents(rcFile);
    app.useConfig(config);
    const { deps } = opts;
    if (deps) {
      app.initiating(() => {
        app.container.bindValue('coop.deps', deps);
      });
    }
  });
}

/**
 * Creates and initializes the application for the `web` (bin/www.ts) or
 * `test` (Vitest harness) entry point. Console entry points call
 * `makeCoopIgnitor().ace().handle(argv)`, which creates its own.
 */
export async function createCoopApp(
  environment: AppEnvironments,
  opts: { deps?: Dependencies } = {},
) {
  const app = makeCoopIgnitor(opts).createApp(environment);
  await app.init();
  return { app };
}
