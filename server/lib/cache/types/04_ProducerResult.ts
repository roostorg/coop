import type { AnyParams } from "./01_Params.js";
import { type AnyValidators } from "./02_Validators.js";
import { type NormalizedProducerResultResource } from "./index.js";

/**
 * ProducerResult represents the shape of messages returned by a service
 * for saving in the cache. It includes content (the actual cached value)
 * along with various pieces of metadata that control caching behavior.
 *
 * T: the type of the content
 * U: the type of its potential validators
 * V: the type of request parameters (see HTTP cache model docs).
 */
export type ProducerResult<
  T,
  Validators extends AnyValidators,
  Params extends AnyParams,
> = ProducerResultResource<T, Validators, Params> & {
  supplementalResources?: ProducerResultResource<T, Validators, Params>[];
};

/**
 * A ProducerResultResource is the producer's representation, at some point in
 * time, of a single, cacheable resource. It includes the id of that resource,
 * its content, and the various caching related metadata/directives.
 *
 * ProducerResultResources, once normalized
 * {@see {@link NormalizedProducerResultResource}}, are the key data that
 * returned from the Cache and read/written to the Store.
 */
export type ProducerResultResource<
  T,
  Validators extends AnyValidators,
  Params extends AnyParams,
> = {
  id: string;
  vary?: Vary<Params>;

  content: T;

  // Age of content at the moment its sent by this producer -- in seconds!
  // Will be non-zero when this producer is itself a cache [since it's been
  // holding the content for some period of time], or it could be non-zero to
  // reflect that some time passed while it was being retreived [network latency].
  // Defaults to 0 if not provided.
  initialAge?: number;

  // The moment that this ProducerResultResource was created. Per comment above,
  // this may be different from when the resource's current state was fetched
  // from the origin, if initialAge is non-zero.
  date?: Date;

  // producer cache control directives.
  directives: ProducerDirectives;

  // validation infos. Will be interpreted as an empty object if not provided.
  validators?: Partial<Validators>;
};

// The vary object holds a set of param (name, value) pairs that the producer
// used to create the result. These form a secondary cache key for the resource,
// with `id`. A null value indicates that the parameter must be missing to
// generate this result; a missing key (or, because TS can't easily prevent it,
// an undefined value, indicates that the result doesn't vary on the parameter.
export type Vary<Params extends AnyParams> = {
  [K in keyof Params]?: Exclude<Params[K], undefined> | null;
};

/**
 * Supported producer directives. More to be added.
 *
 * - freshUntilAge: The number of seconds for which the produced value is fresh.
 *   By default, stale (i.e., not fresh) responses will not be returned by the
 *   cache, but consumer or producer use of the `maxStale` directive can
 *   override this. This is equivalent to the producer `max-age` directive in
 *   HTTP; it's just renamed to reflect the fact that (like in HTTP) it has a
 *   fundamentally different meaning than consumer `maxAge`.
 *
 * - maxStale: An array of three numbers, with identical format and meaning as
 *   the consumer `maxStale` directive. Setting this to `[0, 0, 0]` creates
 *   semantics very similar to HTTP's built-in `must-revalidate` producer
 *   directive. Combining `maxStale: [0, 0, 0]` with `freshUntilAge: 0` create
 *   semantics very similar to HTTP's `no-cache` producer directive. Meanwhile,
 *   setting this to `[0, a, b]` creates very similar semantics to using the
 *   HTTP directives `stale-while-revalidate=a, stale-if-error=b` (but limits
 *   the ability for the consumer to request stale requests without
 *   revalidation).
 *     If the `maxStale` directive is missing on a producer's response, the
 *   value of the consumer's `maxStale` directive is used as though it were the
 *   value returned by the producer. (If the consumer's `maxStale` was also
 *   missing, there's a convoluted process for assigning it a default value
 *   first.) The point of all the logic around assigning default `maxStale`
 *   values is to allow the overall directive system to remain simple -- only a
 *   few directives, with clear conflict resolution rules -- while allowing that
 *   system to simulate a large chunk of HTTP semantics.
 *
 * - storeFor: the maximum number of seconds _after the content was generated_
 *   that it may be stored in a cache. Note: this is slightly different from
 *   saying "the maximum amount of time that a cache may store the result it
 *   just received". Specifically, if there's a chain of caches, these two ideas
 *   come apart, because cache x may have just received the content, even though
 *   it was produced from an upstream origin a while back. Therefore, from the
 *   perspective of a given cache in the chain, the amount of time it can store
 *   the result is `Math.max(0, directives.storeFor - initialAge)`. [For the
 *   definition of initialAge, {@see ProducerResult}.]
 *
 * Note: when resolving directives, the cache will behave to satisfy all
 * directives. So, for example, if the producer indicates that a response is
 * storable for A seconds, whereas the consumer would allow it to be stored for
 * B seconds, the cache may store it for `Math.min(A, B)` seconds.
 */
export type ProducerDirectives = {
  freshUntilAge: number; // seconds
  maxStale?: [number, number, number]; // seconds
  storeFor?: number;
};
