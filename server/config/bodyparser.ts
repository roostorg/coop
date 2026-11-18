import { defineConfig } from '@adonisjs/core/bodyparser';

/**
 * Mirrors `express.json({ limit: '50mb' })` on every route, plus the
 * `express.urlencoded()` that only the SAML callback used.
 *
 * `convertEmptyStringsToNull` defaults to true in AdonisJS. Coop must store
 * submitted item fields exactly as sent, so it's off everywhere.
 */
export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  json: {
    limit: '50mb',
    strict: true,
    types: ['application/json'],
    convertEmptyStringsToNull: false,
  },
  form: {
    limit: '100kb',
    types: ['application/x-www-form-urlencoded'],
    convertEmptyStringsToNull: false,
  },
  // Express never parsed text or multipart bodies.
  raw: { types: [] },
  multipart: {
    autoProcess: false,
    types: [],
    convertEmptyStringsToNull: false,
  },
});
