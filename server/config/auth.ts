import { defineConfig } from '@adonisjs/auth';
import type { InferAuthenticators } from '@adonisjs/auth/types';

import { ApiKeyGuard } from '../app/auth/api_key_guard.js';

const authConfig = defineConfig({
  default: 'apiKey',
  guards: {
    apiKey: (ctx) => new ApiKeyGuard(ctx),
  },
});

export default authConfig;

declare module '@adonisjs/auth/types' {
  // AdonisJS' documented way to type `ctx.auth` from this config.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface Authenticators extends InferAuthenticators<
    typeof authConfig
  > {}
}
