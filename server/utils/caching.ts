import {
  Cache,
  MemoryStore,
  wrapProducer,
  type AnyParams,
  type AnyValidators,
  type ConsumerDirectives,
  type Entry,
  type ProducerDirectives,
} from '../lib/cache/index.js';
import { type ReadonlyDeep } from 'type-fest';

import { jsonParse, jsonStringify } from './encoding.js';
import { type JSON } from './json-schema-types.js';

type Opts<KeyType, CachedContentType, CacheKeyType extends string = string> = {
  /**
   * This is the function responsible for returning the content that will be
   * cached for the provided key.
   */
  producer(cacheKey: KeyType): Promise<CachedContentType>;
  /**
   * These are the "producer directives" (or a function that returns the
   * producer directives given the producer's return value). These instruct the
   * cache on how long the value is likely to still be correct (or at least
   * worth serving from cache). Consumers can specify their own freshness
   * requirements when reading from the cache, which may force the cache to get
   * a new value even if the producer said the cached value is still probably
   * ok (or, alternately, may allow a cached value to be used longer than the
   * producer thinks is generally safe).
   */
  directives:
    | ProducerDirectives
    | ((it: ReadonlyDeep<CachedContentType>) => ProducerDirectives);
  collapseOverlappingRequestsTime?: number;
  numItemsLimit?: number;
  onItemEviction?(value: ReadonlyDeep<CachedContentType>, key: KeyType): void;
  keyGeneration?: {
    toString(it: KeyType): CacheKeyType;
    fromString(str: CacheKeyType): KeyType;
  };
};

type CachedFn<KeyType, CachedContentType> = {
  (
    key: KeyType,
    directives?: ConsumerDirectives,
  ): Promise<ReadonlyDeep<CachedContentType>>;
  close(): Promise<void>;
  /** Invalidates the cached value for the given key. Used when the source data has been replaced (e.g. key rotation). */
  invalidate?(key: KeyType): Promise<void>;
};

/**
 * Basically, this is like {@link wrapProducer}, except it takes care of a bunch
 * of other small details that our generic caching library doesn't and shouldn't
 * know about, like that we're using an in-memory store; that we want to cache
 * all produced values using the same directives (as given in the `directive`
 * option); that we want to mark the cache result as readonly (because the
 * in-memory store means it'll be reused between callers); etc.
 */
export function cached<
  KeyType extends ReadonlyDeep<JSON>,
  CachedContentType,
  CacheKeyType extends string = string,
>(
  opts: Opts<KeyType, CachedContentType, CacheKeyType>,
): CachedFn<KeyType, CachedContentType>;
export function cached<
  KeyType,
  CachedContentType,
  CacheKeyType extends string = string,
>(
  // NB: if the KeyType is not JSON-compatible, the caller must provide their
  // own key generation and parsing functions, as the default ones won't work!
  opts: Opts<KeyType, CachedContentType, CacheKeyType> &
    Required<
      Pick<Opts<KeyType, CachedContentType, CacheKeyType>, 'keyGeneration'>
    >,
): CachedFn<KeyType, CachedContentType>;
export function cached<
  KeyType,
  CachedContentType,
  CacheKeyType extends string = string,
>(opts: Opts<KeyType, CachedContentType, CacheKeyType>) {
  const {
    directives,
    producer,
    numItemsLimit,
    collapseOverlappingRequestsTime,
    onItemEviction: givenOnItemEviction,
    keyGeneration = {
      // NB: these casts are not safe as far as TS is concerned because
      // CacheKeyType can be instantiated with an arbitrary subtype of string,
      // and jsonStringify obv can't produce all of those. However,
      // jsonStringify and jsonParse are only used if the caller doesn't provide
      // their own keyGeneration functions, and, in that case, `CacheKeyType` is
      // totally unobservable outside this function, so it doesn't actually
      // matter if it's instantiated with a string subtype that isn't
      // JsonOf<KeyType>.
      toString: jsonStringify as unknown as (it: KeyType) => CacheKeyType,
      fromString: jsonParse as unknown as (it: CacheKeyType) => KeyType,
    },
  } = opts;
  const finalOnItemEvication = givenOnItemEviction
    ? (
        it: Entry<ReadonlyDeep<CachedContentType>, AnyValidators, AnyParams>,
      ) => {
        givenOnItemEviction(
          it.content,
          keyGeneration.fromString(it.id as CacheKeyType),
        );
      }
    : undefined;

  const getWithCache = wrapProducer(
    new Cache(
      new MemoryStore({ numItemsLimit, onItemEviction: finalOnItemEvication }),
      {
        onGetAfterClose: 'return-nothing',
        onStoreAfterClose: 'return-nothing',
      },
    ),
    { collapseOverlappingRequestsTime },
    async (req) => {
      const origKey = keyGeneration.fromString(
        req.id satisfies string as CacheKeyType,
      );

      // Always cast the produced result to be marked readonly, because the same
      // cached object is gonna be returned for multiple requests, so making any
      // mutations to that object would be an insanely bad idea that'd be
      // impossible to reason about.
      const content = (await producer(
        origKey,
      )) satisfies CachedContentType as ReadonlyDeep<CachedContentType>;

      return {
        content,
        directives:
          typeof directives === 'function' ? directives(content) : directives,
      };
    },
  );

  async function exposedGet(key: KeyType, directives?: ConsumerDirectives) {
    const cacheKey = keyGeneration.toString(key);
    return (await getWithCache({ id: cacheKey, directives })).content;
  }

  exposedGet.close = async () => getWithCache.cache.close();
  exposedGet.invalidate = async (key: KeyType) => {
    const cacheKey = keyGeneration.toString(key);
    await getWithCache.cache.delete(cacheKey);
  };
  return exposedGet;
}

/**
 * The type of functions returned by {@link cached}, which matches the type of
 * the original producer, except that there's an added close() property/method.
 */
export type Cached<OriginalProducer extends (key: never) => Promise<unknown>> =
  OriginalProducer extends (
    key: infer KeyType extends ReadonlyDeep<JSON>,
  ) => Promise<infer CacheContentType>
    ? CachedFn<KeyType, CacheContentType>
    : never;
