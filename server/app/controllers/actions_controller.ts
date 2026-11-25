import type { HttpContext } from '@adonisjs/core/http';

import { resolve } from '../../adonis/resolve.js';
import submitAction from '../../routes/action/submitAction.js';
import { jsonBody } from '../../utils/bodySchemaValidation.js';
import {
  submitActionValidator,
  type SubmitActionInput,
} from '../validators/action_validator.js';
import { validateJsonBody } from '../validators/coop_error_reporter.js';

/**
 * `POST /api/v1/actions`, written the AdonisJS way: the `auth` middleware
 * authenticates the API key, and VineJS validates the body.
 */
export default class ActionsController {
  async store(ctx: HttpContext) {
    const { orgId } = ctx.auth.use('apiKey').getUserOrFail();
    await validateJsonBody(ctx, submitActionValidator);
    ctx.orgId = orgId;
    const deps = await resolve(ctx, 'coop.deps');
    // The handler gets the body as sent, not VineJS' output (which drops
    // unknown keys, e.g. extra fields on `reportedItems`).
    await submitAction(deps)(ctx, jsonBody(ctx) as SubmitActionInput);
    ctx.response.header('Content-Length', 0);
  }
}
