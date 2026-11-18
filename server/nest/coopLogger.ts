import { type LoggerService } from '@nestjs/common';

import { logErrorJson, logJson } from '../utils/logging.js';

/**
 * Routes Nest's own log lines through Coop's JSON logging. Startup chatter
 * (module init, route mapping) is debug-level and dropped.
 */
export class CoopNestLogger implements LoggerService {
  log() {}
  debug() {}
  verbose() {}

  warn(message: unknown, context?: string) {
    // eslint-disable-next-line no-restricted-syntax
    logJson({ level: 'warn', message: String(message), context });
  }

  error(message: unknown, stackOrContext?: string, context?: string) {
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({
      message: context ?? stackOrContext,
      error: message instanceof Error ? message : new Error(String(message)),
    });
  }
}
