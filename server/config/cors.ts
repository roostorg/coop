import { defineConfig } from '@adonisjs/cors';

/**
 * Closest match to the `cors()` defaults the Express app used: any origin,
 * no credentials, the same method list, request headers reflected, no max-age.
 *
 * Two differences remain: `@adonisjs/cors` sets no CORS headers when the
 * request has no `Origin` header, and it doesn't add `Vary` headers.
 */
export default defineConfig({
  enabled: true,
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: false,
  maxAge: 0,
});
