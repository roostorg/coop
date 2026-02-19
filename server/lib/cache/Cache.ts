import { EventEmitter } from "events";
import _ from "lodash";

import {
  type Entry,
  type NormalizeParamName,
  type NormalizeParamValue,
} from "./types/06_Normalization.js";
import {
  type AnyParams,
  type AnyParamValue,
  type AnyValidators,
  type ConsumerRequest,
  type Logger,
  type ProducerResultResource,
  type Store,
  type Vary,
} from "./types/index.js";
import { type Bind1 } from "./types/utils.js";
import {
  normalizeParams,
  normalizeProducerResultResource,
  normalizeVary,
} from "./utils/normalization.js";
import * as entryUtils from "./utils/normalizedProducerResultResourceHelpers.js";
import { defaultLoggersByComponent } from "./utils/utils.js";

const { sortBy, groupBy } = _;

type OnRequestAfterClose = "throw" | "return-nothing";

/**
 * This class implements a cache using a generalized version of HTTP's
 * underlying caching model, but w/o encoding HTTP-specific details (like header
 * parsing), so that it can be useful in more contexts. As part of this
 * generalization, this class talks about a cached value's "id and request
 * params" rather than its "URI and request headers", and cache directives are
 * provided as explicit arguments (not header strings). Similarly, it refers to
 * the "producer and consumer" of cached values, rather than the "server and the
 * client". Beyond renaming, it leaves open the set of available validators for
 * users to define (e.g., db row version numbers), rather than hard-coding HTTP
 * validators like etags and last-modified dates, and it supports a set of
 * directives somewhat more general than their HTTP equivalents.
 *
 * For (critical) background details on the HTTP caching model, see the docs.
 *
 * TODO: support the concept of warnings.
 * See https://tools.ietf.org/html/rfc7234#section-5.5
 */
export default class Cache<
  Content,
  Validators extends AnyValidators = AnyValidators,
  Params extends AnyParams = AnyParams,
  Id extends string = string,
> {
  private readonly logger: Bind1<Logger, "cache">;
  public readonly emitter = new EventEmitter();
  private closed = false;
  private readonly onGetAfterClose: OnRequestAfterClose;
  private readonly onStoreAfterClose: OnRequestAfterClose;
  public readonly normalizeParamName: NormalizeParamName<Params>;
  public readonly normalizeParamValue: NormalizeParamValue<Params>;

  /**
   * @param dataStore The backing store that will actually hold cache entries.
   */
  constructor(
    private readonly dataStore: Store<Content, Validators, Params>,
    options: {
      logger?: Logger;
      onGetAfterClose?: OnRequestAfterClose;
      onStoreAfterClose?: OnRequestAfterClose;
      normalizeParamName?: NormalizeParamName<Params>;
      normalizeParamValue?: NormalizeParamValue<Params>;
    } = {},
  ) {
    const unboundLogger = options.logger ?? defaultLoggersByComponent.cache;
    this.logger = unboundLogger.bind(null, "cache");
    this.onGetAfterClose = options.onGetAfterClose ?? "throw";
    this.onStoreAfterClose = options.onStoreAfterClose ?? "throw";
    this.normalizeParamName = options.normalizeParamName ?? ((it) => it);
    this.normalizeParamValue =
      options.normalizeParamValue ??
      (<K extends keyof Params>(_name: K, v: AnyParamValue) =>
        v as Params[K] & AnyParamValue);
  }

  private static bestEntry<
    Content,
    Validators extends AnyValidators,
    Params extends AnyParams,
  >(suitableEntries: readonly Entry<Content, Validators, Params>[]) {
    // "When more than one suitable response is stored, a cache MUST use
    // the most recent response (as determined by the Date header field)."
    // https://tools.ietf.org/html/rfc7234#section-4
    return sortBy(suitableEntries, [(it) => entryUtils.birthDate(it)]).at(-1);
  }

  // Create this as an instance member to get `this` binding
  private normalizeParams = (params: Partial<Params>) =>
    normalizeParams(this.normalizeParamName, this.normalizeParamValue, params);

  // Create this as an instance member to get `this` binding
  private normalizeVary = (vary: Vary<Params>) =>
    normalizeVary(this.normalizeParamName, this.normalizeParamValue, vary);

  /**
   * Gets relevant items from the cache, always returning a promise for an
   * object with four possible keys:
   *
   * - `usable`: this is the cached value (if any) that satisfies the consumer's
   *   request, given its cache directives, without requiring even background
   *   revalidation. **If this key holds a value, all other keys in this object
   *   will be undefined/empty.** This value will almost always be fresh, since
   *   stale values aren't usable by defualt; the exception is if the consumer
   *   allowed stale responses (sans revalidation) through the `maxStale`
   *   directive. If multiple cached values would've have been suitable, this
   *   holds the preferred one (which currently means the newest).
   *
   * - `usableWhileRevalidate`: this holds the preferred response (if any)
   *   that's usable to satisfy the client's request, but that must be
   *   (re-)validated in the background.
   *
   * - `usableIfError`: holds an entry (if any) that's usable only in case of an
   *   error reaching the producer while trying to fetch/revalidate the cached
   *   value. If there's a `usableWhileRevalidate` response, this key will
   *   always be empty [because the usableWhileRevalidate response should be
   *   returned before calling the producer, so there's no chance on an error.]
   *
   * - `validatable`: when validation is necessary (either because no usable
   *    response is held by the cache, or the usable response requires
   *    background re-validation), this array holds all entries in the cache
   *    that have validation info -- including, possibly, responses present in
   *    the other returned keys -- and that would be usable were the producer
   *    to confirm (revalidate) that the resource's current state matches the
   *    state identified by the validation info. Otherwise, this array is empty.
   *    These are returned so that the user can make a conditional request for
   *    the latest content that takes into account the validation info (e.g.,
   *    the etags w/ `If-None-Match`) of these saved responses. These responses
   *    are probably stale, but it's possible they're not (e.g., if consumer
   *    used a maxAge directive shorter than the producer's freshness lifetime).
   */
  public async get(req: ConsumerRequest<Params, Id>): Promise<{
    usable?: Entry<Content, Validators, Params> | undefined;
    usableWhileRevalidate?: Entry<Content, Validators, Params> | undefined;
    usableIfError?: Entry<Content, Validators, Params> | undefined;
    validatable: Entry<Content, Validators, Params>[];
  }> {
    if (this.closed) {
      if (this.onGetAfterClose === "throw") {
        this.logger("trace", "received request when closed and throwing");
        throw new Error("Store has been closed...");
      }
      this.logger(
        "trace",
        "received request when closed, so returning no entries",
      );
      return {
        validatable: [],
      };
    }

    const { id, params, directives } = req;
    const now = new Date();
    const normalizedParams = this.normalizeParams(params);

    this.logger("trace", "received request", { id, params, normalizedParams });
    this.logger("trace", "requested entries from the store");

    const cacheEntries = await this.dataStore.get(id, normalizedParams);
    const classifiedEntries = groupBy(cacheEntries, (it) =>
      entryUtils.classify(it, directives, now),
    );

    this.logger(
      "trace",
      "received entries from the store, and classified them",
      classifiedEntries,
    );

    const usableEntries =
      classifiedEntries[entryUtils.EntryClassification.Usable];

    if (usableEntries) {
      const res = {
        // Non-null assertion is safe because of lodash groupBy mechanics.
        usable: Cache.bestEntry(usableEntries)!,
        validatable: [],
      };

      this.logger("trace", "chose/returned this data", res);
      return res;
    }

    const validatableEntries = cacheEntries.filter(entryUtils.isValidatable);

    const usableWhileRevalidateEntries =
      classifiedEntries[entryUtils.EntryClassification.UsableWhileRevalidate];

    if (usableWhileRevalidateEntries) {
      const res = {
        // Non-null assertion is safe because of lodash groupBy mechanics.
        usableWhileRevalidate: Cache.bestEntry(usableWhileRevalidateEntries)!,
        validatable: validatableEntries,
      };

      this.logger("trace", "chose/returned this data", res);
      return res;
    }

    const usableIfErrorEntries =
      classifiedEntries[entryUtils.EntryClassification.UsableIfError];

    const res = {
      usableIfError: usableIfErrorEntries
        ? // Non-null assertion is safe because of lodash groupBy mechanics.
          Cache.bestEntry(usableIfErrorEntries)!
        : undefined,
      validatable: validatableEntries,
    };

    this.logger("trace", "chose/returned this data", res);
    return res;
  }

  /**
   * Stores ProducerResultResources that it assumes were _just now_ retreived
   * from the producer. If the result wasn't retreived just now, its retreival
   * time can be specified.
   */
  public async store(
    data: readonly ProducerResultResource<Content, Validators, Params>[],
  ) {
    if (this.closed) {
      if (this.onStoreAfterClose === "throw") {
        this.logger("trace", "received store request when closed and throwing");
        throw new Error("Store has been closed...");
      }
      this.logger(
        "trace",
        "received store request after throwing and doing nothing",
      );
      return;
    }

    const now = new Date();
    const entriesWithTimes = data.map((it) => {
      const entry = normalizeProducerResultResource(
        this.normalizeVary,
        it,
        now,
      );
      return { entry, maxStoreForSeconds: calculateStoreFor(entry, now) };
    });

    this.logger(
      "trace",
      "storing the following entries with (possibly inferred) storeFor times",
      entriesWithTimes,
    );

    entriesWithTimes.forEach(({ entry, maxStoreForSeconds }) => {
      this.emitter.emit("store", entry, maxStoreForSeconds);
    });

    return this.dataStore.store(entriesWithTimes);
  }

  /**
   * Deletes all stored entries for the given resource id. Used for cache
   * invalidation (e.g. when a signing key is rotated).
   */
  public async delete(id: Id): Promise<void> {
    return this.dataStore.delete(id);
  }

  public async close(timeout?: number) {
    this.closed = true;
    return this.dataStore.close(timeout);
  }
}

/**
 * Calculates the maximum amount of time -- in seconds! -- that the backing
 * store may store the entry. It considers the producer's requested storeFor
 * time, and when the data will become definitively useless.
 *
 * @param entry The entry who's time-to-store should be calculated
 * @param at The date when the entry will be stored. This effects how long it
 *   should be stored for because, as entries get closer to the end of their
 *   freshness lifetime, the suggested storeFor time may go down (when it isn't
 *   dictated by the producer's directives).
 */
function calculateStoreFor(
  entry: Entry<unknown, AnyValidators, AnyParams>,
  at: Date,
) {
  const producerStoreFor = entry.directives.storeFor;
  const requestedStoreFor =
    producerStoreFor !== undefined
      ? producerStoreFor - entry.initialAge
      : Infinity;

  return Math.max(
    0,
    Math.min(requestedStoreFor, entryUtils.potentiallyUsefulFor(entry, at)),
  );
}
