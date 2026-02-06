import { variantMatchesRequest } from "../utils/varyHelpers.js";
import { type AnyParams } from "./01_Params.js";
import { type AnyValidators } from "./02_Validators.js";
import { type Entry, type NormalizedParams } from "./06_Normalization.js";

/**
 * NB: The store shouldn't mutate its input here at all, but we can't use
 * ReadonlyDeep on each entry because TS can't prove, when the cache invokes
 * store(), that the content type `T` is assignable to `ReadonlyDeep<T>` for
 * all `T` (even though we know it clearly should be).
 */
export type StoreEntryInput<
  T,
  Validators extends AnyValidators,
  Params extends AnyParams,
> = {
  readonly entry: Entry<T, Validators, Params>;
  readonly maxStoreForSeconds: number;
};

/**
 * This interfaces defines the methods that must be supported by "stores",
 * which are instances responsible for actually storing/querying cache entries
 * (on disk, in memory, in a database, etc). The type params have the same
 * meanings as in the ProducerResult type.
 *
 * Note: more methods will be added here over time (e.g., a `delete` will
 * presumably be needed for invalidation, and it might accept criteria
 * [like the resource id and optional normalizedParams, to mirror get] or a
 * list of Entries, although for that to work entries would themselves need
 * to start carrying an id), and these may be required. For now, it's up to
 * the store to remove resources whenever it sees fit (as in HTTP).
 */
export interface Store<
  T,
  Validators extends AnyValidators,
  Params extends AnyParams,
> {
  /**
   * This method returns stored cache entries -- regardless of whether they're
   * fresh -- that are associated with the provided `id` and for which the
   * `vary` value of the entry is _a subset_ of the parameters in `params`. In
   * other words, entries for which the ids match and the request contained at
   * least all the same params with the same values as the producer indicated
   * the entry varies on. This is the primary method called to find cache
   * entries that could satisfy a consumer's request.
   *
   * Stores aren't required to return every matching entry that's ever been
   * passed to them for storage (e.g., because stores may have to evict entries
   * from time to time), but all the returned entries must match per above.
   *
   * Note: one could imagine this method only receiving the resource `id`, and
   * being tasked only with returning all entries matching that `id`; then, the
   * `Cache` class would filter down those entries to the ones that match the
   * incoming request's parameters, in the same way the `Cache` class determines
   * which returned entries satisfy the request's `ConsumerDirectives`. However,
   * structuring the code that way would've precluded Store implementations from
   * using the request params to optimize their implementations -- e.g., by
   * pushing some filters derived from the request params into the queries the
   * Store issues to the underlying db, to avoid having to transfer irrelevant
   * variants' entries over the network at all or keep them in JS memory.
   *
   * Therefore, this design gives stores a higher performance ceiling -- but the
   * cost is that store implementations have to make sure that they don't return
   * entries whose variants are incompatible with the incoming params. Doing
   * that in a way that's more performant than simply fetching stored entries by
   * resource `id` and then filtering them in memory turns out to be quite hard
   * in most cases. So, stores that don't care about this last bit of
   * performance (and are confident they won't have to deal with a huge number
   * of variants per resource), can simply fetch all entries by resource id and
   * then use the exported {@link variantMatchesRequest} function to provide all
   * the logic for filtering down those entries in memory before returning them.
   *
   * @param id The id of the resource whose cache entries should be returned.
   * @param params The request parameters, with both the names and values of the
   *   params normalized.
   */
  get(
    id: string,
    params: Readonly<NormalizedParams<Params>>,
  ): Promise<Entry<T, Validators, Params>[]>;

  /**
   * This method stores a list of cache entries. This method's return promise
   * should reject if storage fails, but specific errors are not currently
   * defined.
   */
  store(
    entries: readonly StoreEntryInput<T, Validators, Params>[],
  ): Promise<void>;

  /**
   * Deletes all stored entries for resources with the given id.
   * Used to support cache invalidation, which usually requires deleting all of
   * a resource's cached entries, regardless of variant. For example, in HTTP a
   * `POST /x` request has to invalidate all stored variants of `GET /x`,
   * whether they had `Content-Language: en-US` or `Content-Language: de-DE`.
   */
  delete(id: string): Promise<void>;

  /**
   * This method should lead the store to free any resources that it's managing,
   * in preparation for a graceful shutdown. The promise it returns should
   * resolve when those resources have been freed. If the store owns a database
   * connection, closing that is part of this function's responsibility; however,
   * if the store has a db client/connection passed in, it's up to the caller to
   * manage that.
   */
  close(timeout?: number): Promise<void>;
}
