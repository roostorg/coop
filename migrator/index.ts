import { fileURLToPath } from 'url';

export { default as ScyllaStorage } from './storage/scyllaStorage.js';
export { type DatabaseConfig } from './cli/typescript-types.js';
export { makeCli } from './cli/index.js';
export { makeSequelizeUmzugStorage, wrapMigration } from './cli/utils.js';

export const SCRIPT_TEMPLATES_DIR_ABSOLUTE_PATH = fileURLToPath(
  new URL('./script-templates', import.meta.url),
);
