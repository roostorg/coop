/* eslint-disable import/no-restricted-paths */
// These graphql/datasources imports are transport-agnostic DB helpers that
// happen to live in the graphql folder. They should eventually move to a
// services layer, but that refactor is out of scope here.
import express, { type Express } from 'express';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import passport from 'passport';

import { makeLoginUserDoesNotExistError } from '../graphql/datasources/userApiErrors.js';
import {
  kyselyUserFindByEmail,
  kyselyUserUpdateLoginMethods,
} from '../graphql/datasources/userKyselyPersistence.js';
/* eslint-enable import/no-restricted-paths */
import type { Dependencies } from '../iocContainer/index.js';
import {
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
} from '../utils/errors.js';

type SamlDeps = Pick<
  Dependencies,
  'OrgSettingsService' | 'SSOService' | 'ConfigService' | 'KyselyPg'
>;

export function registerSamlRoutes(app: Express, deps: SamlDeps) {
  const { KyselyPg } = deps;

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
      async (_req, profile, done) => {
        try {
          const user = await kyselyUserFindByEmail(
            KyselyPg,
            String(profile?.email),
          );
          if (user == null) {
            return done(
              makeLoginUserDoesNotExistError({ shouldErrorSpan: true }),
            );
          }

          if (!user.loginMethods.includes('saml')) {
            const updatedUser = await kyselyUserUpdateLoginMethods(
              KyselyPg,
              user.id,
              [...user.loginMethods, 'saml'],
            );
            if (updatedUser != null) {
              return done(null, updatedUser);
            }
          }

          return done(null, user);
        } catch (e) {
          return done(
            makeInternalServerError('Unknown error during login attempt', {
              shouldErrorSpan: true,
            }),
          );
        }
      },
      async (_req, profile, done) => {
        try {
          const user = await kyselyUserFindByEmail(
            KyselyPg,
            String(profile?.email),
          );
          if (user == null) {
            return done(
              makeLoginUserDoesNotExistError({ shouldErrorSpan: true }),
            );
          }

          if (!user.loginMethods.includes('saml')) {
            const updatedUser = await kyselyUserUpdateLoginMethods(
              KyselyPg,
              user.id,
              [...user.loginMethods, 'saml'],
            );
            if (updatedUser != null) {
              return done(null, updatedUser);
            }
          }

          return done(null, user);
        } catch (e) {
          return done(
            makeInternalServerError('Unknown error during login attempt', {
              shouldErrorSpan: true,
            }),
          );
        }
      },
    ),
  );

  app.get(
    '/saml/login/:orgId',
    passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
  );

  app.post(
    `/saml/login/:orgId/callback`,
    express.urlencoded(),
    passport.authenticate('saml', {
      failureRedirect: '/',
      failureFlash: true,
    }),
    (_req, res) => {
      res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
    },
  );
}
