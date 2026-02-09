declare module 'homoglyph-search';
declare module 'nilsimsa';

declare module 'uuid-apikey';

declare interface String {
  toUpperCase<T extends string>(this: T): Uppercase<T>;
  toLowerCase<T extends string>(this: T): Lowercase<T>;
}

// Workaround for https://github.com/apollographql/apollo-server/issues/6868
// At some point, we should just upgrade to Apollo Server 4, but that's a big lift.
//
// We also have to fork + override retry-axios, which we don't depend on
// directly, but it's a dependency of the google maps sdk. However, the version
// of retry-axios used by the SDK isn't compatible with moduleResolution=nodeNext,
// so we were getting a type error. Forking the SDK to update retry-axios isn't
// feasible, because the new version of retry-axios uses a newer axios version,
// which contains some breaking changes (to param serialization; see
// https://github.com/axios/axios/pull/4734), which would be hard to update the
// SDK to account for.
declare module '@graphql-tools/schema' {
  import { GraphQLSchema } from 'graphql';

  import { IExecutableSchemaDefinition } from './types.js';

  export declare function makeExecutableSchema<TContext = any>({
    typeDefs,
    resolvers,
    resolverValidationOptions,
    parseOptions,
    inheritResolversFromInterfaces,
    pruningOptions,
    updateResolversInPlace,
    schemaExtensions,
  }: IExecutableSchemaDefinition<TContext>): GraphQLSchema;
}

declare module 'stream-to-blob' {
  export default function streamToBlob(
    stream: NodeJS.ReadableStream,
    mimeType?: string | null,
  ): Promise<Blob>;
}

declare module 'latlon-geohash' {
  export interface Point {
    lat: number;
    lon: number;
  }

  /**
   * Encodes latitude/longitude to geohash, either to specified precision or to automatically
   * evaluated precision.
   *
   * @param   lat - Latitude in degrees.
   * @param   lng - Longitude in degrees.
   * @param   [precision] - Number of characters in resulting geohash.
   * @returns Geohash of supplied latitude/longitude.
   * @throws  Invalid geohash.
   *
   * @example
   *     var geohash = Geohash.encode(52.205, 0.119, 7); // geohash: 'u120fxw'
   */
  export function encode(lat: number, lng: number, precision?: number): string;

  /**
   * Decode geohash to latitude/longitude (location is approximate centre of geohash cell,
   *     to reasonable precision).
   *
   * @param   geohash - Geohash string to be converted to latitude/longitude.
   * @returns (Center of) geohashed location.
   * @throws  Invalid geohash.
   *
   * @example
   *     var latlon = Geohash.decode('u120fxw'); // latlon: { lat: 52.205, lon: 0.1188 }
   */
  export function decode(geohash: string): Point;
}

declare module '@stdlib/stats-binomial-test' {
  /**
   * A [successes, failures] tuple.
   */
  type Tuple = [number, number];

  /**
   * Interface defining function options.
   */
  interface Options {
    /**
     * Significance level (default: 0.05).
     */
    alpha?: number;

    /**
     * Alternative hypothesis (`two-sided`, `less`, or `greater`; default: 'two-sided').
     */
    alternative?: 'two-sided' | 'less' | 'greater';

    /**
     * Success probability under H0 (default: 0.5)
     */
    p?: number;
  }

  /**
   * Test result.
   */
  interface Results {
    /**
     * Used significance level.
     */
    alpha: number;

    /**
     * Test decision.
     */
    rejected: boolean;

    /**
     * p-value of the test.
     */
    pValue: number;

    /**
     * Sample proportion.
     */
    statistic: number;

    /**
     * 1-alpha confidence interval for the success probability.
     */
    ci: Array<number>;

    /**
     * Assumed success probability under H0.
     */
    nullValue: number;

    /**
     * Alternative hypothesis (`two-sided`, `less`, or `greater`).
     */
    alternative: string;

    /**
     * Name of test.
     */
    method: string;

    /**
     * Function to print formatted output.
     */
    print: Function;
  }

  /**
   * Interface of test for the success probability in a Bernoulli experiment.
   */
  interface BinomialTest {
    /**
     * Computes an exact test for the success probability in a Bernoulli experiment.
     *
     * @param x - number of successes
     * @param n - total number of observations
     * @param options - function options
     * @param options.alpha - significance level (default: 0.05)
     * @param options.alternative - alternative hypothesis (`two-sided`, `less`, or `greater`; default: 'two-sided')
     * @param options.p - success probability under H0 (default: 0.5)
     * @throws must provide valid options
     * @returns test results
     *
     * @example
     * var out = binomialTest( 682, 925 );
     * // returns {...}
     *
     * out = binomialTest( 682, 925, {
     *     'p': 0.75,
     *     'alpha': 0.05
     * });
     * // returns {...}
     */
    (x: number, n: number, options?: Options): Results;

    /**
     * Computes an exact test for the success probability in a Bernoulli experiment.
     *
     * @param x - two-element array with number of successes and number of failures
     * @param options - function options
     * @param options.alpha - significance level (default: 0.05)
     * @param options.alternative - alternative hypothesis (`two-sided`, `less`, or `greater`; default: 'two-sided')
     * @param options.p - success probability under H0 (default: 0.5)
     * @throws must provide valid options
     * @returns test results
     *
     * @example
     * var out = binomialTest( [ 682, 243 ] );
     * // returns {...}
     *
     * out = binomialTest( [ 682, 243 ], {
     *     'p': 0.75,
     *     'alpha': 0.05
     * });
     * // returns {...}
     */
    (x: Tuple, options?: Options): Results;
  }

  /**
   * Computes an exact test for the success probability in a Bernoulli experiment.
   *
   * @param x - number of successes or two-element array with successes and failures
   * @param n - total number of observations
   * @param options - function options
   * @param options.alpha - significance level (default: 0.05)
   * @param options.alternative - alternative hypothesis (`two-sided`, `less`, or `greater`; default: 'two-sided')
   * @param options.p - success probability under H0 (default: 0.5)
   * @throws must provide valid options
   * @returns test results
   *
   * @example
   * var out = binomialTest( 682, 925 );
   * // returns {...}
   *
   * @example
   * var out = binomialTest( [ 682, 243 ] );
   * // returns {...}
   */
  var binomialTest: BinomialTest;

  // EXPORTS //

  export = binomialTest;
}

namespace NodeJS {
  interface ProcessEnv {
    DATABASE_HOST?: string;
    DATABASE_READ_ONLY_HOST?: string;
    DATABASE_PORT?: string;
    DATABASE_NAME?: string;
    DATABASE_USER?: string;
    DATABASE_PASSWORD?: string;
    SESSION_SECRET?: string;
    SNOWFLAKE_USERNAME?: string;
    SNOWFLAKE_PASSWORD?: string;
    SNOWFLAKE_DB_NAME?: string;
    SNOWFLAKE_ACCOUNT?: string;
    SNOWFLAKE_ROLE?: string;
    SNOWFLAKE_SCHEMA?: string;
    SNOWFLAKE_WAREHOUSE?: string;
    SNOWFLAKE_POOL_SIZE?: string;
    WAREHOUSE_ADAPTER?: string;
    ANALYTICS_ADAPTER?: string;
    DATA_WAREHOUSE_PROVIDER?: string;
    KAFKA_BROKER_HOST?: string;
    KAFKA_BROKER_USERNAME?: string;
    KAFKA_BROKER_PASSWORD?: string;
    KAFKA_SCHEMA_REGISTRY_HOST?: string;
    KAFKA_SCHEMA_REGISTRY_USERNAME?: string;
    KAFKA_SCHEMA_REGISTRY_PASSWORD?: string;
    KAFKAJS_NO_PARTITIONER_WARNING?: string;
    KAFKA_TOPIC_KEY_SCHEMA_ID_DATA_WAREHOUSE_INGEST_EVENTS?: string;
    KAFKA_TOPIC_VALUE_SCHEMA_ID_DATA_WAREHOUSE_INGEST_EVENTS?: string;
    SNOWFLAKE_S3_BUCKET_NAME?: string;
    SNOWFLAKE_S3_BUCKET_REGION?: string;
    NODE_ENV?: string;
    EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS?: string;
    ALLOW_USER_INPUT_LOCALHOST_URIS?: string;
    SEQUELIZE_PRINT_LOGS?: string;
    SNOWFLAKE_PRINT_LOGS?: string;
    REDIS_USE_CLUSTER?: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_USER?: string;
    REDIS_PASSWORD?: string;
    GROQ_SECRET_KEY?: string;
    SENDGRID_API_KEY?: string;
    GOOGLE_PLACES_API_KEY?: string;
    READ_ME_JWT_SECRET?: string;
    GOOGLE_TRANSLATE_API_KEY?: string;
    OPEN_AI_API_KEY?: string;
    SLACK_APP_BEARER_TOKEN?: string;
    GRAPHQL_OPAQUE_SCALAR_SECRET?: string;
  }
}
