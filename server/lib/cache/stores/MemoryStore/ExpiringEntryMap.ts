import lruMap from "lru_map";

const { LRUMap } = lruMap;

/**
 * A Map-like object that can kick out entries after a TTL or after a max number
 * of values are saved. This is implemented separately from the MemoryStore,
 * to separate the eviction logic from the "matching usable entries" logic.
 */
export default class ExpiringEntryMap<K, V> {
  private readonly store:
    | Map<K, { value: V; expiration: number }>
    | lruMap.LRUMap<K, { value: V; expiration: number }>;
  private onItemEviction?: (evictedItem: V, evictedItemKey: K) => Promise<void>;

  private cleanupJobTimer: NodeJS.Timeout;
  private cleanupIterator: Iterator<[K, { value: V; expiration: number }]>;

  /**
   * @param opts.numItemsLimit If provided, the map will evict the least
   *  recently used item when the number of items stored exceeds this limit.
   *
   * @param opts.onItemEviction callback that is called *after* an item is
   *   removed from the cache (via manual deletion, expiration, or the map
   *   exceeding the numItemsLimit).
   */
  constructor(opts?: {
    numItemsLimit?: number;
    onItemEviction?: (evictedItem: V, evictedItemKey: K) => Promise<void>;
  }) {
    const { numItemsLimit, onItemEviction } = opts ?? {};

    this.store = numItemsLimit ? new LRUMap(numItemsLimit) : new Map();
    this.onItemEviction = onItemEviction;

    if (this.store instanceof LRUMap && typeof onItemEviction === "function") {
      this.store.shift = function () {
        const entry = LRUMap.prototype.shift.call(this);
        if (entry !== undefined) {
          // Call onItemEviction after the item's been removed in the shift call
          onItemEviction(entry[1].value, entry[0]).catch((_e) => {});
          return entry;
        }
        return undefined;
      };
    }

    // Set up a job that runs periodically to reclaim memory from expired items.
    //
    // There are a few possible approaches here:
    //
    // 1. Use an iterator to go over the whole map but, b/c that might block the
    //    event loop for a long time, only go over a few items per cleanup job
    //    run and then yield. This will eventually go over all the items, but
    //    I'm just not sure how performant iterators are like this (esp if the
    //    map is changing during iteration.). Meanwhile, the iterator returned
    //    by lru_map doesn't document how it's supposed to behave when items are
    //    added, deleted, or (potentially relevant b/c access changes the order
    //    in which items were last used) accessed during iteration. From some
    //    testing, though, it looks like the behavior of the lru_map iterators
    //    will work well enough.
    //
    // 2. We could try to randomly test a few items on a frequent interval, and
    //    repeat immediately if we find that a sizable percentage were expired.
    //    (Cf https://redis.io/commands/expire/#how-redis-expires-keys, as Redis
    //    basically uses this approach). However, Redis is able to get random
    //    samples from its map very efficiently, because it has access to the
    //    underlying hash buckets.In JS, we can't do this without iterating to
    //    list all the keys, or maintaing a separate list of keys that we sync
    //    every time an item is added or deleted, which is cumbersome and uses
    //    extra memory.
    //
    // 3. We could keep a min-heap of (key, expirationTime) pairs. Compared to
    //    option (2), it seems like that'd be only slightly more work on
    //    adding/deleting keys [plus a bit more memory], but would let this
    //    expiration job look at _exactly_ the right set of keys (i.e., those
    //    that are closest to expiring).
    //
    // For now, we go with option 1

    // `getIterator` is needed because of a bug in the LRUMap code/type
    // definitions, in which entries() doesn't actually return an iterator.
    // See https://github.com/rsms/js-lru/pull/42
    const getIterator = () =>
      this.store instanceof LRUMap
        ? this.store[Symbol.iterator]()
        : this.store.entries();

    this.cleanupIterator = getIterator();

    const cleanupInterval = 2_000;
    const numItemsPerInterval = 20;
    const cleanupJob = () => {
      const now = Date.now();
      for (let i = 0; i < numItemsPerInterval; i++) {
        const { done, value: item } = this.cleanupIterator.next();
        if (done) {
          this.cleanupIterator = getIterator();
          break;
        }
        const [key, { expiration, value }] = item;
        if (expiration <= now) {
          this.store.delete(key);
          // Call onItemEviction after the item's been removed
          this.onItemEviction?.(value, key).catch((_e) => {});
        }
      }

      this.cleanupJobTimer = setTimeout(cleanupJob, cleanupInterval);
    };

    this.cleanupJobTimer = setTimeout(cleanupJob, cleanupInterval);
  }

  get(key: K) {
    const item = this.store.get(key);
    if (item === undefined) {
      return undefined;
    } else if (item.expiration > Date.now()) {
      return item.value;
    } else {
      this.delete(key);
      return undefined;
    }
  }

  set(key: K, value: V, ttl: number) {
    this.store.set(key, { value, expiration: Date.now() + ttl });
    return this;
  }

  has(key: K) {
    return this.store.has(key);
  }

  delete(key: K) {
    // LRUMap and Map return different values for delete. Only one actually
    // gives us the deleted value, so we have to fetch that ourselves pre-delete
    // if we're gonna need to give it to onItemEviction.
    const value = this.onItemEviction ? this.store.get(key) : undefined;
    const existedBoolOrPriorVal = this.store.delete(key);

    if (value !== undefined) {
      // Call onItemEviction after the item's been deleted from the cache
      this.onItemEviction?.(value.value, key).catch((_e) => {});
    }

    return typeof existedBoolOrPriorVal === "boolean"
      ? existedBoolOrPriorVal
      : existedBoolOrPriorVal !== undefined;
  }

  close() {
    clearTimeout(this.cleanupJobTimer);
  }
}
