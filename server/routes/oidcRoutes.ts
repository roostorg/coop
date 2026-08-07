/* eslint-disable import/no-restricted-paths */
// kyselyUserFindByEmail and kyselyUserUpdateLoginMethods are transport-agnostic
// DB helpers that happen to live in the graphql folder. They should eventually
// move to a services layer, but that refactor is out of scope here.
import type { Express } from 'express';
import * as oidcClient from 'openid-client';

import { kyselyUserFindByEmail } from '../graphql/datasources/userKyselyPersistence.js';
/* eslint-enable import/no-restricted-paths */
import type { Dependencies } from '../iocContainer/index.js';
import { discoverOidcConfig } from '../services/SSOService/index.js';

type OidcDeps = Pick<
  Dependencies,
  'OrgSettingsService' | 'SSOService' | 'ConfigService' | 'KyselyPg'
>;

// Org ids are free-form varchar(255) (e.g. `org_123`). We don't enforce a
// generation scheme here, but reject anything that isn't a plausible id before
// using it in a DB lookup — this stops `String(undefined)` → "undefined" style
// values and keeps the param to a safe character set. Real authorization is
// still the `getOidcSettings` + `oidc_enabled` check below.
const isValidOrgId = (orgId: string): boolean =>
  /^[A-Za-z0-9_-]{1,255}$/.test(orgId);

type OidcSettings = NonNullable<
  Awaited<ReturnType<OidcDeps['OrgSettingsService']['getOidcSettings']>>
>;

// True only when OIDC is enabled AND every credential the flow needs is present.
// Written as a type guard so callers get non-null client/issuer fields afterwards
// without re-checking each one inline.
const hasUsableOidcConfig = (
  settings: OidcSettings | undefined,
): settings is OidcSettings & {
  oidc_enabled: true;
  client_id: string;
  client_secret: string;
  issuer_url: string;
} =>
  settings?.oidc_enabled === true &&
  settings.client_id != null &&
  settings.client_secret != null &&
  settings.issuer_url != null;

export function registerOidcRoutes(app: Express, deps: OidcDeps) {
  const { KyselyPg } = deps;

  app.get('/oidc/:orgId/callback', async (req, res, next) => {
    if (req.query.error) {
      const redirect = new URL('/login/sso', deps.ConfigService.uiUrl);
      redirect.searchParams.set('error', String(req.query.error));
      if (req.query.error_description) {
        redirect.searchParams.set(
          'error_description',
          String(req.query.error_description),
        );
      }
      return res.redirect(redirect.toString());
    }
    try {
      const { orgId } = req.params;
      if (!isValidOrgId(orgId)) {
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

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

      // The org is taken from the callback URL, but it must match the org the
      // flow was started for (stored in the session). A mismatch means the
      // callback was replayed against a different org — treat it as a failure.
      if (sessionData.org_id !== orgId) {
        // eslint-disable-next-line no-console
        console.error('[OIDC] Callback orgId does not match session', {
          urlOrgId: orgId,
          sessionOrgId: sessionData.org_id,
        });
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

      const { code_verifier: codeVerifier, state } = sessionData;
      // Clear session OIDC state immediately (one-time use)
      delete req.session.oidc;

      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);
      if (!hasUsableOidcConfig(oidcSettings)) {
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
      // `claims.email` is typed as a JSON value, so narrow with `typeof` rather
      // than casting — a non-string email must not flow into the DB lookup.
      let email = typeof claims?.email === 'string' ? claims.email : undefined;

      if (!email && claims?.sub) {
        const userinfo = await oidcClient.fetchUserInfo(
          config,
          tokens.access_token,
          claims.sub,
        );
        // `userinfo.email` can be undefined here — it's `email?: string` on
        // oauth4webapi's `UserInfoResponse` (re-exported by openid-client) — so
        // the `!email` gate below handles the missing case. We narrow with
        // `typeof` to also keep any non-string value out of the DB lookup.
        email = typeof userinfo.email === 'string' ? userinfo.email : undefined;
      }

      if (!email) {
        // eslint-disable-next-line no-console
        console.error('[OIDC] No email in token claims or userinfo');
        return res.redirect(
          `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
        );
      }

      // `email` is now narrowed to `string`, so no `String(...)` coercion needed.
      const user = await kyselyUserFindByEmail(KyselyPg, email);

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

      req.login(user, (err) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error('[OIDC] Failed to establish session for user', err);
          return next(err);
        }
        res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[OIDC] Unexpected error in callback handler', e);
      return res.redirect(
        `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`,
      );
    }
  });

  app.post('/oidc/:orgId/start', async (req, res, next) => {
    // Opaque failure: this endpoint is unauthenticated, so distinct
    // "not enabled" vs "misconfigured" errors would let anyone enumerate each
    // org's SSO state. Always return the same generic error to the client and
    // keep the diagnostic detail in the server log only.
    const ssoLoginFailed = new URL(
      '/login/sso?error=sso_login_failed',
      deps.ConfigService.uiUrl,
    ).toString();
    try {
      const { orgId } = req.params;
      if (!isValidOrgId(orgId)) {
        return res.redirect(ssoLoginFailed);
      }
      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);

      if (!hasUsableOidcConfig(oidcSettings)) {
        // eslint-disable-next-line no-console
        console.error(
          '[OIDC] Login start for org without usable OIDC config',
          orgId,
          {
            enabled: oidcSettings?.oidc_enabled === true,
            hasClientId: Boolean(oidcSettings?.client_id),
            hasSecret: Boolean(oidcSettings?.client_secret),
            hasIssuer: Boolean(oidcSettings?.issuer_url),
          },
        );
        return res.redirect(ssoLoginFailed);
      }

      const callbackUrl = deps.SSOService.getSSOOidcCallbackUrl(orgId);
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
