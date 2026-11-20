import { defineConfig } from '@adonisjs/core/logger';

import env from '../start/env.js';

/**
 * Framework logs (AdonisJS' own pino logger, available as `ctx.logger`). Coop's
 * application logs still go through `utils/logging.ts` (`logJson`), which
 * writes the JSON lines the log pipeline already parses. No pino transport, so
 * no worker thread: pino writes JSON lines straight to stdout.
 */
const loggerConfig = defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: env.get('OTEL_SERVICE_NAME') ?? 'coop-server',
      level: env.get('LOG_LEVEL') ?? 'info',
    },
  },
});

export default loggerConfig;
