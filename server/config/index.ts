import { http } from './app.js';
import bodyparser from './bodyparser.js';
import encryption from './encryption.js';
import logger from './logger.js';

/**
 * Every config file, keyed by the name AdonisJS would give it when loading
 * the `config/` directory. Passed to `app.useConfig()` in `adonis/createApp.ts`.
 */
export default {
  app: { http },
  encryption,
  bodyparser,
  logger,
};
