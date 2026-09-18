import env from '#start/env';

/**
 * Third-party services Coop talks out to, and where the adopter's integrations
 * manifest lives.
 */
export default {
  /**
   * Where to find the adopter's integrations config file. Relative paths are
   * resolved against the working directory; when unset, the loader falls back to
   * `integrations.config.json` in the working directory and then in `server/`,
   * since `npm run start` runs from the repo root.
   */
  configPath: env.get('INTEGRATIONS_CONFIG_PATH'),

  googlePlacesApiKey: env.get('GOOGLE_PLACES_API_KEY'),

  /** Hasher-Matcher-Actioner, for perceptual hash matching. */
  hmaServiceUrl: env.get('HMA_SERVICE_URL', 'http://localhost:9876/'),
};
