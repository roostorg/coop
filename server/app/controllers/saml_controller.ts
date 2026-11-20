import { type IncomingMessage } from 'node:http';
import querystring from 'node:querystring';
import { type HttpContext } from '@adonisjs/core/http';

import { resolve } from '../../adonis/resolve.js';
import { makeBadRequestError } from '../../utils/errors.js';
import {
  bridgeRequest,
  runConnectMiddleware,
} from '../middleware/session_bridge_middleware.js';

/**
 * SAML SSO via passport-saml: passport sends
 * the IdP redirect, or on failure redirects to `/`, by writing the Node
 * response directly.
 */
export default class SamlController {
  async login(ctx: HttpContext) {
    await this.authenticate(ctx);
  }

  async callback(ctx: HttpContext) {
    // The IdP posts the assertion as a URL-encoded form; parse it flat (Node's
    // querystring), up to 100 KB, for passport-saml to read from `req.body`.
    if (ctx.request.is(['application/x-www-form-urlencoded'])) {
      ctx.request.updateBody(
        querystring.parse(await readBody(ctx.request.request, 100 * 1024)),
      );
    }
    if (await this.authenticate(ctx)) {
      const { uiUrl } = await resolve(ctx, 'ConfigService');
      ctx.response.redirect(`${uiUrl}/dashboard`);
    }
  }

  /** Resolves `true` when the user is authenticated and logged in. */
  private async authenticate(ctx: HttpContext) {
    const { passport } = await resolve(ctx, 'coop.auth');
    const { req, res } = bridgeRequest(ctx);
    return runConnectMiddleware(
      passport.authenticate('saml', {
        failureRedirect: '/',
        failureFlash: true,
      }) as Parameters<typeof runConnectMiddleware>[0],
      req,
      res,
    );
  }
}

async function readBody(req: IncomingMessage, limit: number) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) {
      throw makeBadRequestError('Request body too large.', {
        shouldErrorSpan: false,
      });
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
