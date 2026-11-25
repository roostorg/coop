import { defineConfig } from '@adonisjs/core/bodyparser';

/**
 * JSON on every route, up to 50 MB. URL-encoded bodies are parsed only by the
 * SAML callback (`app/controllers/saml_controller.ts`), so this parser leaves
 * them alone.
 *
 * AdonisJS normalizes strings by default: `convertEmptyStringsToNull`, and
 * (v7) `trimWhitespaces`, which trims every string at every depth. Coop must
 * keep submitted item fields, GraphQL variables (passwords, rule text) and
 * report payloads exactly as sent, so both are off everywhere.
 */
export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  json: {
    limit: '50mb',
    strict: true,
    types: ['application/json'],
    convertEmptyStringsToNull: false,
    trimWhitespaces: false,
  },
  form: { types: [], convertEmptyStringsToNull: false, trimWhitespaces: false },
  raw: { types: [] },
  multipart: {
    autoProcess: false,
    types: [],
    convertEmptyStringsToNull: false,
    trimWhitespaces: false,
  },
});
