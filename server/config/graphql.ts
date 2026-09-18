import env from '#start/env';

export default {
  /**
   * Rejects queries nested deeper than this, so a hostile or accidental deeply
   * recursive query can't be turned into a denial of service.
   */
  maxDepth: env.get('GRAPHQL_MAX_DEPTH', 10),
};
