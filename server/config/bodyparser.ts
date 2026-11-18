import { defineConfig } from '@adonisjs/core/bodyparser';

/**
 * JSON on every route, up to 50 MB. URL-encoded bodies are parsed only by the
 * SAML callback (`app/controllers/saml_controller.ts`), so this parser leaves
 * them alone.
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
  form: { types: [], convertEmptyStringsToNull: false },
  raw: { types: [] },
  multipart: {
    autoProcess: false,
    types: [],
    convertEmptyStringsToNull: false,
  },
});
