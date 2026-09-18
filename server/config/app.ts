import env from '#start/env';

/**
 * Derived on access rather than at import.
 *
 * `env.get` reads the validated values `Env.create` produced, and `env.set`
 * updates them — so a getter lets a test say `env.set('NODE_ENV', 'production')`
 * and have the rest of the application agree. A constant would instead hold
 * whatever the environment was when this module was first imported.
 *
 * `NODE_ENV === 'prod'` is silently non-production everywhere it appears;
 * `inProduction` is not, which is why the comparison lives here and not at each
 * call site.
 */
export default {
  get env() {
    return env.get('NODE_ENV', 'development');
  },
  get inProduction() {
    return this.env === 'production';
  },
  get inDev() {
    return this.env === 'development';
  },
  get inTest() {
    return this.env === 'test';
  },

  // Public origin of the frontend. Used to build the links and redirects the
  // application hands out, so it must be the origin a browser reaches, not an
  // internal one.
  get uiUrl() {
    return env.get('UI_URL');
  },

  /** Identifies this process in traces and as the Postgres `application_name`. */
  get serviceName() {
    return env.get('OTEL_SERVICE_NAME', 'coop-service');
  },
};
