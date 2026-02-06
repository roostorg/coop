import {
  type AnyParams,
  type AnyValidators,
  type Entry,
  type NormalizedParams,
  type Store,
  type StoreEntryInput,
} from "../../types/index.js";
import { type JsonOf, jsonStringify } from "../../utils/utils.js";
import {
  requestVariantKeyForVaryKeys,
  resultVariantKey,
  type VariantKey,
  type VaryKeys,
} from "../../utils/varyHelpers.js";
import ExpiringEntryMap from "./ExpiringEntryMap.js";

// Primary cache key for stored resources.
type ResourceId = string;

// Full cache key that includes the variant key.
type FullCacheKey = JsonOf<readonly [ResourceId, VariantKey]>;

/**
 * This class implements an in-memory store for cache entries. For details on
 * each method, see the interface.
 *
 * Note that this class is implemented to make get() fast, at the expense of
 * making store() slower, under the assumption that reads from the cache happen
 * much more often than new data is stored (which should be the case).
 */
export default class MemoryStore<
  Content,
  Validators extends AnyValidators = AnyValidators,
  Params extends AnyParams = AnyParams,
> implements Store<Content, Validators, Params>
{
  /**
   * This map stores metadata about each distinct `ResourceId` (i.e., primary
   * cache key) that's stored. Specifically...
   *
   * - When an incoming request comes in, we have to find entries that match on
   *   both the primary cache key (the `ResourceId`) and the secondary cache key
   *   (the `VariantKey`). However, to match on the latter, we can't compute all
   *   possible variant keys for the request, so, instead, we need to store
   *   which sets of `varyKeys` we've seen for producer results for this
   *   `ResourceId`. That's what `varyKeysSets` holds. This is consulted on each
   *   request. See note on {@link requestVariantKeyForVaryKeys} for details.
   *
   * - When all stored entries for a given ResourceId have been evicted/expired,
   *   we want to reclaim a bit of memory (by deleting the whole map entry for
   *   that `ResourceId`, so we use `entryVariantKeys` to track how many entries
   *   we're still storing for this `ResourceId`.
   *
   * - Similarly, during cache invalidation, we want to be able to delete all
   *   the stored entries for a given `ResourceId`, so we use `entryVariantKeys`
   *   to be able to find all of those.
   */
  private readonly resourceMetadataMap = new Map<
    ResourceId,
    { varyKeysSets: VaryKeys[]; entryVariantKeys: VariantKey[] }
  >();

  /**
   * Meanwhile, this map wholes the actual cached entries, keyed by their full
   * cache key. We use an ExpiringEntryMap to efficiently support time- and
   * size-based expiration of entries. It stores the `ResourceId` in addition to
   * the entry solely so that, on expiration, we can decrement the entry count
   * for that resource id without having to parse the cache key.
   */
  private readonly entriesMap: ExpiringEntryMap<
    FullCacheKey,
    [Entry<Content, Validators, Params>, ResourceId]
  >;

  private readonly fallbackDeleteAfter: number;

  /**
   * @param opts.numItemsLimit If set, the store will limit the number of items
   *   it maintains by evicting least recently used items. Note that, while this
   *   caps the amount of memory the store will use, it also adds marginal
   *   overhead to every lookup, as the store must record that the looked up
   *   item is now the most recently accessed.
   *
   * @param opts.fallbackDeleteAfter When an item is stored, the caller (usually
   *   the Cache class) tells the store how long to retain the item for, based
   *   on how long it's likely to be useful for satisfying future requests.
   *   However, sometimes, the cache will tell the store that an entry can be
   *   stored forever. This usually happens if the producer doesn't limit the
   *   item's `maxStale`, in which case the data is potentially usable forever,
   *   as consumers can request arbitarily data using the maxStale directive.
   *   However, storing this sort of data forever is impractical in terms of
   *   memory usage. So, the fallbackDeleteAfter setting controls the TTL that
   *   should apply in these cases. Like all times in this caching setup, this
   *   is in seconds.
   *
   * @param opts.onItemEviction A callback that's called whenever an item is
   *   removed from the store -- whether because it expired or because it was
   *   evicted to make room for a new item under the `numItemsLimit` setting.
   */
  constructor(opts?: {
    numItemsLimit?: number;
    fallbackDeleteAfter?: number;
    onItemEviction?: (entry: Entry<Content, Validators, Params>) => void;
  }) {
    const { numItemsLimit, onItemEviction, fallbackDeleteAfter } = opts ?? {};

    this.entriesMap = new ExpiringEntryMap({
      numItemsLimit,
      onItemEviction: async ([entry, resourceId]) => {
        this.onItemEviction(entry, resourceId);
        onItemEviction?.(entry);
      },
    });
    this.fallbackDeleteAfter = fallbackDeleteAfter ?? 60 * 60; /* 60 minutes */
  }

  private onItemEviction(
    entry: Entry<Content, Validators, Params>,
    resourceId: ResourceId,
  ) {
    const metadata = this.resourceMetadataMap.get(resourceId)!;
    const evictedItemVariantKey = resultVariantKey(entry.vary);

    metadata.entryVariantKeys = metadata.entryVariantKeys.filter(
      (it) => it !== evictedItemVariantKey,
    );

    if (metadata.entryVariantKeys.length === 0) {
      this.resourceMetadataMap.delete(resourceId);
    }
  }

  public async get(id: string, normalizedParams: NormalizedParams<Params>) {
    const resourceMetadata = this.resourceMetadataMap.get(id);

    if (!resourceMetadata) {
      return [];
    }

    return resourceMetadata.varyKeysSets.flatMap((varyKeys) => {
      const variantKey = requestVariantKeyForVaryKeys(
        normalizedParams,
        varyKeys,
      );

      const cacheKey = makeCacheKey(id, variantKey);
      const variantResult = this.entriesMap.get(cacheKey);
      return variantResult ? [variantResult[0]] : [];
    });
  }

  public async store(
    entriesWithTimes: readonly StoreEntryInput<Content, Validators, Params>[],
  ) {
    await Promise.all(entriesWithTimes.map(async (it) => this.storeOne(it)));
  }

  private async storeOne(it: StoreEntryInput<Content, Validators, Params>) {
    const { entry, maxStoreForSeconds: deleteAfter } = it;
    const { id } = entry;

    let resourceMetadata = this.resourceMetadataMap.get(id);
    if (resourceMetadata === undefined) {
      resourceMetadata = { varyKeysSets: [], entryVariantKeys: [] };
      this.resourceMetadataMap.set(id, resourceMetadata);
    }

    // Get a canonical array for Object.keys(entry.vary) so that we don't add
    // duplicates to resourceMetadata.varyKeys, which would slow down reads!
    const varyKeys = canonicalSmallStringMultiset(Object.keys(entry.vary));

    // We add the new varyKeys to the array, using an array rather than a set
    // because, again, we expect the number of varyKeys per resource to be very
    // small and because we'd rather slow down store() than get(), which using a
    // set would do.
    if (!resourceMetadata.varyKeysSets.includes(varyKeys)) {
      resourceMetadata.varyKeysSets.push(varyKeys);
    }

    // For storing the variant key in the metadata, we don't care about the
    // components, so we can just use a string rather than a canonical array.
    const variantKey = resultVariantKey(entry.vary);

    if (!resourceMetadata.entryVariantKeys.includes(variantKey)) {
      resourceMetadata.entryVariantKeys.push(variantKey);
    }

    // Now that the metadata's updated, we store the content.
    const cacheKey = makeCacheKey(id, variantKey);
    const finalDeleteAfterSeconds =
      deleteAfter === Infinity ? this.fallbackDeleteAfter : deleteAfter;

    this.entriesMap.set(cacheKey, [entry, id], finalDeleteAfterSeconds * 1000);
  }

  public async delete(id: ResourceId) {
    const resourceMetadata = this.resourceMetadataMap.get(id);
    if (!resourceMetadata) {
      return;
    }

    for (const variantKey of resourceMetadata.entryVariantKeys) {
      const cacheKey = makeCacheKey(id, variantKey);
      this.entriesMap.delete(cacheKey);
    }

    this.resourceMetadataMap.delete(id);
  }

  public async close() {
    this.entriesMap.close();
  }
}

function makeCacheKey(id: ResourceId, variantKey: VariantKey): FullCacheKey {
  return jsonStringify([id, variantKey] as const);
}

/**
 * In JS, if you want to use an array/set/etc as a Map key, you have to pass the
 * exact same object that was used as the key when you want to do a lookup,
 * because JS doesn't have value equality. That's a giant pain, as we'd like to
 * have `map.set(new Set(['a','b']), x)`, then `map.get(new Set(['a','b']))`
 * work in our code above, where the set would be the set of keys that the entry
 * varied on. The work around is to stringify the value, but then you're using
 * extra memory and may have to parse it again to actually use it.
 *
 * The helper below makes it simple to instead use the value you want as a key,
 * by returning the same object every time it's given an array with the same
 * strings, including if the strings are given in a different order. I.e.,
 *
 * ```ts
 * canonicalSmallStringMultiset(['a', 'b']) ===
 *  canonicalSmallStringMultiset(['a', 'b']) ===
 *  canonicalSmallStringMultiset(['b', 'a'])
 * ```
 *
 * It's a multiset because it allows duplicate strings, but input arrays with
 * duplicates are not equal, i.e.
 *
 * ```ts
 * canonicalSmallStringMultiset(['a', 'a']) !==
 *  canonicalSmallStringMultiset(['a'])
 * ```
 *
 * The name refers to "small string" because it's optimized for multi-sets with
 * a few number of strings; with more items, it'd be better to use an actual JS
 * Set.
 */
const canonicalSmallStringMultiset = (() => {
  const canonical = new Map<string, readonly string[]>();

  return (arr: readonly string[]) => {
    const key = jsonStringify(arr.slice().sort());
    const canonicalArr = canonical.get(key);
    if (!canonicalArr) {
      canonical.set(key, arr);
      return arr;
    }

    return canonicalArr;
  };
})();
