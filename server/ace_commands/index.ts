import { ListLoader } from '@adonisjs/core/ace';

import GetInviteToken from './get_invite_token.js';
import RunWorkerOrJob from './run_worker_or_job.js';

/**
 * Coop's ace commands, registered in `adonisrc.ts`. A list rather than
 * AdonisJS' directory scan, which needs a generated `commands.json` manifest
 * (`node ace` with `@adonisjs/assembler`) in the build output.
 */
const loader = new ListLoader([RunWorkerOrJob, GetInviteToken]);

export const getMetaData = loader.getMetaData.bind(loader);
export const getCommand = loader.getCommand.bind(loader);
