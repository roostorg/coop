import {
  MultiSamlStrategy,
  type VerifyWithRequest,
} from '@node-saml/passport-saml';
import express, { type Express } from 'express';
import passport from 'passport';

// resolveSamlUser is a transport-agnostic SAML user-resolution helper that
// happens to live under the graphql folder. It should eventually move to a
// services layer, but that refactor is out of scope here.
/* eslint-disable-next-line import/no-restricted-paths */
import { resolveSamlUser } from '../graphql/utils/resolveSamlUser.js';
import type { Dependencies } from '../iocContainer/index.js';
import {
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
} from '../utils/errors.js';

type SamlDeps = Pick<
  Dependencies,
  'OrgSettingsService' | 'SSOService' | 'ConfigService' | 'KyselyPg' | 'Tracer'
>;

export function registerSamlRoutes(app: Express, deps: SamlDeps) {
  const { KyselyPg } = deps;

  // Shared by both the signon and logout verify callbacks. Delegates to
  // resolveSamlUser, which binds the user lookup to the org named in the
  // callback path (`/saml/login/:orgId/callback`) so an assertion
  // authenticating one org can never resolve a user from another
  // (GHSA-2v93-383c-9fw2). It must NOT mutate the user: SSO login is not gated
  // on `loginMethods`, so implicitly appending 'saml' here only silently
  // upgraded a user's login methods — an account-takeover vector on signon, and
  // plainly wrong on the logout path. This mirrors the OIDC callback, which
  // likewise no longer mutates login methods.
  const verifySamlUser: VerifyWithRequest = async (req, profile, done) =>
    resolveSamlUser(KyselyPg, deps.Tracer, req, profile, done);

  passport.use(
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        async getSamlOptions(req, done) {
          // orgId path param should be set in the /saml/* route handlers.
          const rawOrgId = req.params['orgId'];
          const orgId = typeof rawOrgId === 'string' ? rawOrgId : undefined;

          if (!orgId) {
            return done(
              makeNotFoundError('orgId not found in path.', {
                shouldErrorSpan: true,
              }),
            );
          }

          const samlSettings =
            await deps.OrgSettingsService.getSamlSettings(orgId);

          if (!samlSettings)
            return done(
              makeInternalServerError('Unexpected error.', {
                shouldErrorSpan: true,
              }),
            );

          if (!samlSettings.saml_enabled)
            return done(
              makeBadRequestError('SAML not enabled for this organization.', {
                shouldErrorSpan: true,
              }),
            );

          done(null, {
            entryPoint: samlSettings.sso_url as string,
            idpCert: samlSettings.cert as string,
            callbackUrl: deps.SSOService.getSSOSamlCallbackUrl(orgId),
            issuer: deps.SSOService.getSSOSamlIssuer(),
          });
        },
      },
      verifySamlUser, // signon verify
      verifySamlUser, // logout verify — same lookup, and must not mutate the user
    ),
  );

  // `failureRedirect` resolves against the API server, so '/' would land the
  // user on the API root. Point failures at the UI's SSO login page instead,
  // mirroring the success path below and the OIDC routes.
  const samlFailureRedirect = `${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`;

  app.get(
    '/saml/login/:orgId',
    passport.authenticate('saml', {
      failureRedirect: samlFailureRedirect,
      failureFlash: true,
    }),
  );

  app.post(
    `/saml/login/:orgId/callback`,
    express.urlencoded(),
    passport.authenticate('saml', {
      failureRedirect: samlFailureRedirect,
      failureFlash: true,
    }),
    (_req, res) => {
      res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
    },
  );
}
