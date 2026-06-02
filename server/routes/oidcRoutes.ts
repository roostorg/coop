/* eslint-disable import/no-restricted-paths */
// kyselyUserFindByEmail and kyselyUserUpdateLoginMethods are transport-agnostic
// DB helpers that happen to live in the graphql folder. They should eventually
// move to a services layer, but that refactor is out of scope here.
import type { Express } from 'express';
import * as oidcClient from 'openid-client';

import {
  kyselyUserFindByEmail,
  kyselyUserUpdateLoginMethods,
} from '../graphql/datasources/userKyselyPersistence.js';
/* eslint-enable import/no-restricted-paths */
import type { Dependencies } from '../iocContainer/index.js';
import { discoverOidcConfig } from '../services/SSOService/index.js';

type OidcDeps = Pick<
  Dependencies,
  'OrgSettingsService' | 'SSOService' | 'ConfigService' | 'KyselyPg'
>;

export function registerOidcRoutes(app: Express, deps: OidcDeps) {
  const { KyselyPg } = deps;

  app.get('/oidc/login/callback', async (req, res, next) => {
    if (req.query.error) {
      return res.redirect(
        `${deps.ConfigService.uiUrl}/login/sso?error=${encodeURIComponent(String(req.query.error))}`,
      );
    }
    try {
      const sessionData = req.session.oidc;

      if (
        !sessionData ||
        !sessionData.code_verifier ||
        !sessionData.state ||
        !sessionData.org_id
      ) {
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=session_expired`,
        );
      }

      const { code_verifier: codeVerifier, state, org_id: orgId } = sessionData;
      // Clear session OIDC state immediately (one-time use)
      delete req.session.oidc;

      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);
      if (
        !oidcSettings ||
        oidcSettings.oidc_enabled !== true ||
        !oidcSettings.client_id ||
        !oidcSettings.client_secret ||
        !oidcSettings.issuer_url
      ) {
        // eslint-disable-next-line no-console
        console.error(
          '[OIDC] Missing or incomplete OIDC settings for org',
          orgId,
        );
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

      const config = await discoverOidcConfig(
        oidcSettings.issuer_url,
        oidcSettings.client_id,
        oidcSettings.client_secret,
      );

      // Reconstruct callback URL with code/state from IdP redirect.
      // authorizationCodeGrant needs: base = registered redirect_uri, query = code+state from IdP.
      const currentUrl = new URL(req.originalUrl, deps.ConfigService.apiUrl);

      const checks = { pkceCodeVerifier: codeVerifier, expectedState: state };

      const tokens = await oidcClient.authorizationCodeGrant(
        config,
        currentUrl,
        checks,
      );

      const claims = tokens.claims();
      let email: string | undefined = claims?.email as string | undefined;

      if (!email) {
        const userinfo = await oidcClient.fetchUserInfo(
          config,
          tokens.access_token,
          claims!.sub,
        );
        email = userinfo.email;
      }

      if (!email) {
        // eslint-disable-next-line no-console
        console.error('[OIDC] No email in token claims or userinfo');
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

      const user = await kyselyUserFindByEmail(KyselyPg, String(email));

      if (!user || user.orgId !== orgId) {
        // eslint-disable-next-line no-console
        console.error('[OIDC] User not found or org mismatch', {
          orgId,
          userOrgId: user?.orgId ?? 'none',
        });
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

      let loginUser = user;
      if (!user.loginMethods.includes('oidc')) {
        const updatedUser = await kyselyUserUpdateLoginMethods(
          KyselyPg,
          user.id,
          [...user.loginMethods, 'oidc'],
        );
        if (updatedUser != null) {
          loginUser = updatedUser;
        }
      }

      req.login(loginUser, (err) => {
        if (err) return next(err);
        res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
      });
    } catch (e) {
      return res.redirect(
        `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
      );
    }
  });

  app.post('/oidc/login/:orgId', async (req, res, next) => {
    try {
      const { orgId } = req.params;
      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);

      if (!oidcSettings || oidcSettings.oidc_enabled !== true) {
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=oidc_not_enabled`,
        );
      }
      if (
        !oidcSettings.client_id ||
        !oidcSettings.client_secret ||
        !oidcSettings.issuer_url
      ) {
        // eslint-disable-next-line no-console
        console.error('[OIDC] Missing credentials for org', orgId, {
          hasClientId: Boolean(oidcSettings.client_id),
          hasSecret: Boolean(oidcSettings.client_secret),
          hasIssuer: Boolean(oidcSettings.issuer_url),
        });
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=oidc_misconfigured`,
        );
      }

      const callbackUrl = deps.SSOService.getSSOOidcCallbackUrl();
      const config = await discoverOidcConfig(
        oidcSettings.issuer_url,
        oidcSettings.client_id,
        oidcSettings.client_secret,
      );

      const codeVerifier = oidcClient.randomPKCECodeVerifier();
      const codeChallenge =
        await oidcClient.calculatePKCECodeChallenge(codeVerifier);
      const state = oidcClient.randomState();

      const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: callbackUrl,
        scope: 'openid email',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      const redirectTo = oidcClient.buildAuthorizationUrl(config, params);

      // Store the OIDC verifier/state in the server-side session store. The
      // browser cookie only contains the opaque session identifier.
      req.session.oidc = { code_verifier: codeVerifier, state, org_id: orgId };

      // Explicitly save before redirecting — with saveUninitialized:false and an
      // async store (connect-pg-simple), the redirect can reach the browser before
      // the session row is committed, causing the callback to find an empty session.
      req.session.save((err) => {
        if (err) return next(err);
        res.redirect(redirectTo.href);
      });
    } catch (e) {
      next(e);
    }
  });
}
