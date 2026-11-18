import { type HttpContext } from '@adonisjs/core/http';

import { resolve } from '../../adonis/resolve.js';
import {
  bridgeRequest,
  runConnectMiddleware,
} from '../middleware/session_bridge_middleware.js';

/**
 * SAML SSO via passport-saml, unchanged from the Express app: passport sends
 * the IdP redirect, or on failure redirects to `/`, by writing the Node
 * response directly.
 */
export default class SamlController {
  async login(ctx: HttpContext) {
    await this.authenticate(ctx);
  }

  async callback(ctx: HttpContext) {
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
