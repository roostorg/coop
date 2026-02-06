import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import path, { dirname } from "path";
import { type Pipeline, type Redis } from "ioredis";
import _InternalIORedisScript from "ioredis/built/Script.js";
import { type Transaction } from "ioredis/built/transaction.js";
import _ from "lodash";
import Segment, { TypedStringCmd } from "pipeline-segment";
import { type Jsonify } from "type-fest";

import {
  type AnyParams,
  type AnyValidators,
  type Logger,
  type NormalizedParams,
  type NormalizedProducerDirectives,
  type NormalizedProducerResultResource,
  type NormalizedVary,
  type Store,
  type StoreEntryInput,
  type Vary,
} from "../../types/index.js";
import { type Bind2, type JSON } from "../../types/utils.js";
import collapsedTaskCreator from "../../utils/collapsedTaskCreator.js";
import * as entryUtils from "../../utils/normalizedProducerResultResourceHelpers.js";
import TimerSet from "../../utils/TimerSet.js";
import { defaultLoggersByComponent, withRetries } from "../../utils/utils.js";
import {
  requestVariantKeyForVaryKeys,
  resultVariantKey,
  type VaryKeys,
} from "../../utils/varyHelpers.js";

const { throttle } = _;
const Script = _InternalIORedisScript.default;

const EMPTY_VARY_VARIANT_KEY = resultVariantKey(
  {} as NormalizedVary<AnyParams>,
);

/**
 * This class implements a store for cache entries, backed by Redis.
 * For details on each method, see the Store interface.
 *
 * It is implemented using all of the assumptions discussed in the general
 * guidelines for implementing a store (see the docs). Per those considerations,
 * it tracks all the sets of param names that each resource has been seen to
 * vary in a redis set. Within that set, the sets of param names are stored as
 * JSON (see {@link getVaryKeysString}), as Redis doesn't support nested sets.
 * The name for this key is given by {@link RedisStore.redisKeyForVaryKeysSets}.
 * (There is one exception to this, discussed below.)
 *
 * Each entry is stored in a dedicated redis key, so that Redis can do the
 * expiration of entries for us. We assume that leveraging redis' built-in
 * features for exipry will be simpler and more reliable than deleting entries
 * ourselves. A dedciated key per entry is needed becasue Redis doesn't support
 * setting a TTL on anything but top-level keys. Each entry's key is named by
 * the entry's resource id and "variant key"; see the {@link resultVariantKey}
 * function and {@link RedisStore.redisEntryKeyForVariant}. Note that, with this
 * design, we're limiting ourselves to only storing one entry per variant, but
 * that's adequate -- we really only need the latest one. See
 * {@link RedisStore.store} for details.
 *
 * Moreover, in order to support `delete(resourceId)`, we need to be able to
 * quickly find all the stored variants for a resource. Unfortunately, redis
 * doesn't support a performant way to find/delete keys by prefix (see
 * https://github.com/redis/redis/pull/717), which would've been the natural way
 * to do this (exploiting the variant key naming scheme discussed above).
 * Therefore, we also store a Redis set of all the Redis keys holding entries
 * for a given resource. This is called the entryKeys set, and its key name is
 * given by {@link RedisStore.redisKeyForEntryKeys}.
 *
 * Note that the entryKeys set and the varyKeysSets set both exclude data (the
 * entry key and `vary` value, respectively) for the "empty vary variant". This
 * is because most resources will only have one variant (the empty vary
 * variant), and we don't want to have the overhead of two extra redis keys per
 * resource in this case! This means that, when we get or delete entries for a
 * resource, we unconditionally try to get or delete the empty vary variant too,
 * as its absence from the entryKeys set key doesn't signal anything. Similar
 * considerations apply to using the varyKeysSets key.
 *
 * As entries expire, these two extra keys (that exist for resources with
 * multiple variants) need to be kept in sync with the entries and sets of vary
 * keys that actually are still present among the stored entries. If Redis could
 * notify us when an entry expires, we could use that notifcation to keep these
 * keys in sync. Unfortunately, the Redis pub-sub mechanism for expiry
 * notifications is fire-and-forget, so the notification will be missed if
 * there's no store connected to redis at the time of the notification (which
 * might happen, e.g., if this store is used in serverless contexts). There is a
 * potential solution using [keyspace
   triggers](https://redis.io/docs/interact/programmability/triggers-and-functions/concepts/triggers/keyspace_triggers/),
 * but those are not available in the default, open-source Redis. Therefore, we
 * use a cleanup approach which is described elsewhere.
 *
 * Finally, note that all the keys created by this store are prefixed by a
 * user-provided `keyPrefix`. This prevent the generated keys from clashing with
 * other redis data, and allows different copies of the store to manage
 * different sets of resources, with the cleanup process being scoped to only
 * keys with the given prefix.
 *
 * To recap, we end up creating the following keys per resource/id:
 *
 * 1. `${keyPrefix}:r:${id}:entryKeys`, iff we have entries with a non-empty
 *     variant key
 * 2. `${keyPrefix}:r:${id}:varyKeysSets`, iff we have entries with a non-empty
 *    variant key
 * 3. For each variant, `${keyPrefix}:r:${id}:v:${variantKey}`
 */
export default class RedisStore<
  T extends JSON,
  U extends AnyValidators,
  V extends AnyParams,
> implements Store<T, U, V>
{
  private readonly keyPrefix: string;
  private readonly expectedClockSkew: number;
  private readonly timerSet = new TimerSet();

  private readonly logWarn: Bind2<Logger, "redis-store", "warn">;
  private readonly logTrace: Bind2<Logger, "redis-store", "trace">;
  private readonly logError: Bind2<Logger, "redis-store", "error">;

  /**
   * @param redis An ioredis instance.
   * @param options.keyPrefix An optional string to use as the prefix for all
   *   keys created by this class, to prevent contflicts with keys created by
   *   other code.
   * @param options.logger A custom logger to use (optional). Defaults to using
   *   the debug module, with the @ethanresnick/cache:redis-store namespace.
   * @param options.expectedClockSkew A reasonable (positive) number of seconds
   *   that you think the clocks might differ by on different Node servers
   *   running this Store (i.e. different instances of your app). Some data
   *   cleanup will always be delayed by this amount of time, so you don't want
   *   to make it too large. On the other hand, if it's too small, some data
   *   cleanup operations will fail and then have to be retried, which won't
   *   happen until (expectedClockSkew + 5s) later (and if they fail again, we
   *   make no precise guarantee as to when they'll be tried next). So consider
   *   a value that's unlikely to be exceeded but isn't so long that it poses a
   *   privacy risk. High-quality, but commodity, data centers like EC2 usually
   *   keep the skew to within a few miliseconds, but the amount of skew can
   *   vary a lot depending on hardware + network quality, and ocassional errors
   *   or software misconfigurations can drive it up in exceptional cases.
   *   Defaults to 5s, to be generous.
   */
  constructor(
    private readonly redis: Redis,
    options: {
      keyPrefix?: string;
      logger?: Logger;
      expectedClockSkew?: number;
    } = {},
  ) {
    const unboundLogger =
      options.logger ?? defaultLoggersByComponent["redis-store"];

    this.keyPrefix = options.keyPrefix ?? "";
    this.expectedClockSkew = options.expectedClockSkew ?? 5; // 5s.
    this.logWarn = unboundLogger.bind(null, "redis-store", "warn");
    this.logTrace = unboundLogger.bind(null, "redis-store", "trace");
    this.logError = unboundLogger.bind(null, "redis-store", "error");
  }

  /**
   * A helper function for generating redis keys (strings) that are prefixed
   * with the instance's global keyPrefix and include the passed in segments.
   *
   * This can produce colliding keys if, in one key, parts is: ["a", "b"] and,
   * in another key, parts is ["a:b"], for example. However, in the way we're
   * calling `keys()`, I don't believe this sort of collision is possible, and
   * that is verified in the tests.
   *
   * @param parts Array of string (hierarchical) segments to put into the key.
   */
  private key(parts: readonly string[]) {
    return [this.keyPrefix, ...parts].join(":");
  }

  /**
   * The Redis key returned by this function holds, for a given resource, a set
   * in which each item is a stringified JSON representation of a set (as a JSON
   * Array) of param names on which stored entries vary. This _excludes_ an
   * empty array for variants that varied on no request parameters, as we assume
   * that'll be the most common case and give it special treatment. See README
   * and {@see {@link requestVariantKeyForVaryKeys}}.
   */
  private redisKeyForVaryKeysSets(resourceId: string) {
    return this.key(["r", resourceId, "varyKeysSets"]);
  }

  private redisKeyForEntryKeys(resourceId: string) {
    return this.key(["r", resourceId, "entryKeys"]);
  }

  private redisKeyForVariant(resourceId: string, variantKey: string) {
    return this.key(["r", resourceId, "v", variantKey]);
  }

  /**
   * Returns PipelineSegments that support getting the requested variants
   * as `Entry`s.
   */
  private getVariantsSegment(id: string, variantKeys: string[]) {
    return Segment.from(
      [
        // Pass the array of keys as a single argument, rather than using them
        // as the arguments list, to work around https://github.com/luin/ioredis/issues/801
        TypedStringCmd("mget", [
          variantKeys.map((k) => this.redisKeyForVariant(id, k)),
        ]),
      ],
      // Remove the null results from missing keys and convert to entries.
      // NB: the T, U, V here are essentially a cast, as we're just hoping
      // that's what's actually stored in redis.
      ([entryStringsOrNull]) =>
        entryStringsOrNull
          .filter(Boolean)
          .map((it) => deserializeEntry<T, U, V>(it)),
    );
  }

  public async get(id: string, normalizedParams: NormalizedParams<V>) {
    // Get the varyKeysSets that we need to compute variants, while also
    // attempting to load the entry for when `varyKeys` is empty; this eager
    // load might come back empty in a few cases, but, in most cases, it'll
    // save us from having to make a second call altogether.
    this.logTrace(
      "querying for default variant and param name sets for id",
      id,
    );

    const [varyKeysSets, emptyVaryVariant] = await Segment.from(
      [TypedStringCmd("smembers", [this.redisKeyForVaryKeysSets(id)])],
      ([varyKeysSetsResult]) => {
        // If we got an empty varyKeysSetsResult, handle the fact that that
        // could be because we don't store the varyKeysSets key in redis at all
        // when its only value would be the empty param name set (since that's
        // super common and we want to be more memory and key conscious). In
        // other words, we have to assume that the empty paramNameSet variant is
        // potentially there as an entry if we get back an empty array.
        return varyKeysSetsResult.length
          ? [varyKeysSetsResult.map((it) => JSON.parse(it) as VaryKeys)]
          : [[[]]];
      },
    )
      .append(this.getVariantsSegment(id, [EMPTY_VARY_VARIANT_KEY]))
      .run(this.redis);

    this.logTrace("got (processed) results", {
      emptyVaryVariant,
      varyKeysSets,
    });

    const variantKeys = varyKeysSets.map((it) =>
      requestVariantKeyForVaryKeys(normalizedParams, it),
    );

    this.logTrace("computed potential variant keys", {
      variantKeys,
      normalizedParams,
    });

    // Figure out what other variants we need to fetch, if any.
    const variantKeysSet = new Set(variantKeys);
    variantKeysSet.delete(EMPTY_VARY_VARIANT_KEY); // TODO: necessary?
    const unfetchedVariantKeys = [...variantKeysSet.values()];
    this.logTrace(
      "if any, fetching unfetched variants (second round trip)",
      unfetchedVariantKeys,
    );

    const extraEntries = unfetchedVariantKeys.length
      ? await this.getVariantsSegment(id, unfetchedVariantKeys).run(this.redis)
      : [];

    const res = [
      ...(emptyVaryVariant ? [emptyVaryVariant] : []),
      ...extraEntries,
    ];

    this.logTrace("returning entries created from found data", res);
    return res;
  }

  public async store(entriesWithTimes: readonly StoreEntryInput<T, U, V>[]) {
    this.logTrace("storing entries", entriesWithTimes);

    // Group the provided entries by their resource id, and, within each
    // resource id, by their variantKey. If multiple entries for the same
    // resource + variantKey were provided, it only keeps the newest (since we
    // only store one entry per resource + variantKey).
    //
    // NB: we're assuming here that the newest entry in `entryWithTimes` for a
    // given variant is newer than any previously-stored entry for that variant,
    // which we'll be unconditionally overwriting. That might be (very
    // ocassionally) untrue, but that doesn't make this store incorrect --
    // stores aren't required to keep any set of entries in particular -- and
    // this is enough of an edge case that it doesn't seem to make sense to
    // handle it now.
    const groupedEntries = entriesWithTimes.reduce(
      (acc, entryWithTime) => {
        const { entry } = entryWithTime;
        const variantKey = resultVariantKey(entry.vary);
        const variantsToStoreForId = (acc[entry.id] ??= {});

        const entryForVariant = variantsToStoreForId[variantKey].entry;
        if (entryForVariant) {
          this.logWarn(
            "unable to store two entries for the same variant; one will be ignored",
            { conflictingEntries: [entryForVariant, entry] },
          );
        }

        if (
          !entryForVariant ||
          entryUtils.birthDate(entryForVariant) < entryUtils.birthDate(entry)
        ) {
          variantsToStoreForId[variantKey] = entryWithTime;
        }
        return acc;
      },
      {} as {
        [id: string]: { [variantKey: string]: StoreEntryInput<T, U, V> };
      },
    );

    const now = Date.now();
    const pipeline = this.redis.pipeline() as Pipeline;
    // update docs if changing these
    const retryAfterMs = 5_000 + this.expectedClockSkew;
    const attemptsBeforeSurrender = 2;
    const throttleMs = 5_000;

    for (const [id, entriesByVariantKey] of Object.entries(groupedEntries)) {
      // Create a function for cleaning up the data associated with this id, but
      // limit it to only run once at a time for the id and only once every five
      // seconds (in case it just ran for this id before and finished quickly).
      // Have it do one retry on failure before bailing and logging an error.
      const cleanupResource = throttle(
        collapsedTaskCreator(
          async () =>
            withRetries(
              async () => this.cleanupResource(id),
              attemptsBeforeSurrender,
              () => retryAfterMs,
            )().catch(this.logError),
          Infinity,
        ),
        throttleMs,
      );

      // For each resource id, we want to write its data -- with all the entries
      // and the new varyKeysSets/entryKeys values -- transactionally, to avoid
      // readers of the derived keys [i.e., varyKeysSets + entryKeys] seeing
      // states that are inconsistent with the actually saved variants, but we
      // don't care about transactions across resource ids. So the code below
      // kicks off a transaction (with `.multi`) in our pipeline that will just
      // cover this resource's data. Transaction also stops interleaved saves
      // from, e.g., mixing one entry's metadata with another's content, and
      // deleting an old set/map/etc but then the command to create a new one
      // failing. TODO: batching to limit pipeline size?
      (pipeline as unknown as Transaction).multi();

      // All the sets of varyKeys for all the entries that we're storing for
      // this resource id, excluding varyKeys that are empty.
      const nonEmptyEntryVaryKeySets = new Set(
        Object.values(entriesByVariantKey)
          .map(({ entry }) => Object.keys(entry.vary))
          .filter((varyKeys) => varyKeys.length)
          .map((varyKeys) => getVaryKeysString(varyKeys)),
      );

      // Add new paramSetKeys, excluding the empty varyKeys key.
      if (nonEmptyEntryVaryKeySets.size > 0) {
        pipeline.sadd(this.redisKeyForVaryKeysSets(id), [
          ...nonEmptyEntryVaryKeySets.values(),
        ]);
      }

      // Save each variant
      for (const [variantKey, { entry, maxStoreForSeconds }] of Object.entries(
        entriesByVariantKey,
      )) {
        const entryString = serializeEntry(entry);
        const redisEntryKeyForVariant = this.redisKeyForVariant(id, variantKey);
        const absoluteExpireTimeMs = Math.round(
          now + maxStoreForSeconds * 1000,
        );

        // Similarly, we only add if this variant to the list of known entryKeys
        // if it isn't the default/empty one, that way, this key is missing in
        // the common case of only dealing with empty vary variants.
        const entryHasNonDefaultVariantKey =
          variantKey !== EMPTY_VARY_VARIANT_KEY;

        if (entryHasNonDefaultVariantKey) {
          pipeline.zadd(
            this.redisKeyForEntryKeys(id),
            maxStoreForSeconds === Infinity
              ? "inf"
              : String(absoluteExpireTimeMs),
            redisEntryKeyForVariant,
          );
        }

        // Store the entry and set the expiry, if any. We set the expiry as an
        // absolute time derived from the JS Date.now() time so that, when
        // expiring the item and when accounting for clock skew during cleanup,
        // we don't have to worry about the time that passed between when the
        // pipeline was created and when it actually reached redis.
        pipeline.set(redisEntryKeyForVariant, entryString);

        // NB: The redis expiration commands can do weird things when the TTL
        // they're given isn't parsable as an integer, so we round the value
        // ourselves before passing it. In order to ensure that the rounding
        // doesn't loose too much precision, though, we store + round it as a
        // millisecond value when we're given a TTL under 1000 seconds.
        if (maxStoreForSeconds < 1000) {
          pipeline.pexpireat(redisEntryKeyForVariant, absoluteExpireTimeMs);
        } else if (maxStoreForSeconds < Infinity) {
          pipeline.expireat(
            redisEntryKeyForVariant,
            Math.round(now / 1000 + maxStoreForSeconds),
          );
        }

        // If this entry had a default variant key, it won't have contributed
        // anything to the resources's `entryKeys` or `varyKeysSets` key, so
        // there's nothing that needs to be cleaned up when it expires.
        // Otherwise, we schedule the resource's cleanup routine to run 2s
        // after we think a variant's entry key should have expired + been
        // removed. We wait 2s to handle the latency between now and when our
        // full pipeline gets to and is run by redis.
        if (maxStoreForSeconds < Infinity && entryHasNonDefaultVariantKey) {
          this.timerSet.setTimeout(
            cleanupResource,
            maxStoreForSeconds * 1000 + 2_000,
          );
        }
      }

      // This exec call isn't actually running the pipeline, since it's w/i a
      // multi. It's just closing the nested transaction for this resource id.
      pipeline.exec();
    }

    // We could actually log the pipeline's contents -- something like:
    // `pipeline._queue.map(({ name, args }: any) => ({ name, args }))`, but
    // that's kinda heavy for this, which is in the performance critical path.
    // Users should look at their redis logs instead.
    this.logTrace("about to run pipeline to store all provided entries");
    await tryPipeline(pipeline);
    this.logTrace("stored entries successfully");
  }

  /**
   * Deletes from the `entryKeys` key for a given resource all variants that
   * no longer have entries stored for them. This also removes items from the
   * `varyKeysSets` key items for which we no longer have stored entries.
   *
   * The point of cleaning up `entryKeys` is to respect data privacy,
   * as `variantKeys` can contain sensitive info (in the paramValues) and
   * so should be deleted when their corresponding entry expires.
   *
   * The point of cleaning up `varyKeysSets` is that having extra items in
   * that key can slow down `get` operations. This will rarely be an issue in
   * practice (since most resources never vary on more than one paramNameSet
   * anyway), but it can't hurt.
   *
   * Note that if items from the `entryKeys` and `varyKeysSets` are deleted
   * prematurely, bad things will happen [namely, some data will become not
   * deletable or not `get`able, respectively]. We use a check in lua to
   * prevent this definitively, but that means that the whole operation can
   * fail, so use the expectedClockSkew option to minimize the chance of that.
   *
   * Note 2: the implementation here is assuming that there aren't so many
   * variants for an entry that it blocks too much to process them all.
   */
  private async cleanupResource(id: string) {
    const args = [
      this.redisKeyForEntryKeys(id),
      this.redisKeyForVaryKeysSets(id),
      Date.now() - this.expectedClockSkew * 1000,
      // This repreresents the index in each entryKey where the variantKey
      // starts, on the assumption that the items in the entryKeys key end with
      // the variantKey. The +2 is +1 to account for lua's 1-based indexing, and
      // +1 again because of the colon.
      this.redisKeyForVariant(id, "").length + 1,
    ];
    const expectedClockSkew = this.expectedClockSkew;
    this.logTrace("cleaning up resource", { id, args, expectedClockSkew });
    return cleanupResourceScript.execute(this.redis, args, {});
  }

  /**
   * Deletes all entries for a given id
   *
   * This, again, needs to read some data and use it to write some other data
   * within a transacation [so we don't delete entries stored/updated after the
   * delete was initiated]
   */
  public async delete(id: string) {
    const args = [
      this.redisKeyForEntryKeys(id),
      this.redisKeyForVaryKeysSets(id),
      this.redisKeyForVariant(id, EMPTY_VARY_VARIANT_KEY),
    ];
    this.logTrace("deleting entries for id", { args });
    return deleteResourceScript.execute(this.redis, args, {});
  }

  public async close(timeout?: number) {
    return this.timerSet.close(timeout);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const deleteResourceScript = new Script(
  readFileSync(path.join(__dirname, "./lua/deleteResource.lua"), {
    encoding: "utf-8",
  }),
  3,
);

const cleanupResourceScript = new Script(
  readFileSync(path.join(__dirname, "./lua/cleanupResource.lua"), {
    encoding: "utf-8",
  }),
  2,
);

const isErorr = (it: unknown): it is Error => it instanceof Error;

/**
 * A helper that runs a redis pipeline and returns a promise that rejects
 * if any of the redis commands errored, and otherwise resolves with an array
 * of command results.
 */
async function tryPipeline<T extends unknown[]>(pipeline: Pipeline) {
  const pipelineResponse = await pipeline.exec();
  const [errorsOrNulls, results] = [
    pipelineResponse!.map((it) => it[0]),
    pipelineResponse!.map((it) => it[1]),
  ];

  const errors = errorsOrNulls.filter(isErorr);

  if (errors.length) {
    throw errors[0];
  }

  return results as T;
}

/**
 * Makes a canonical string for a set of param names, that we can put in a set
 * etc.
 */
function getVaryKeysString(varyKeys: VaryKeys) {
  return JSON.stringify(varyKeys.slice().sort());
}

/**
 * Takes an entry to store and serializes it to a string to put in redis.
 */
function serializeEntry<T, U extends AnyValidators, V extends AnyParams>(
  entry: NormalizedProducerResultResource<T, U, V>,
) {
  return JSON.stringify(entry);
}

/**
 * Takes a string from redis and deserializes it to an entry.
 */
function deserializeEntry<T, U extends AnyValidators, V extends AnyParams>(
  entryString: string,
) {
  // NB: cast here should really be to
  // Jsonify<NormalizedProducerResultResource<T, U, V>>, but that confuses TS,
  // so we do this more general cast so we can get useful safety out of the
  // Jsonify type (e.g., knowing that we need to convert the date back to a
  // Date) and then cast at the end.
  const parsed = JSON.parse(entryString) as Jsonify<
    NormalizedProducerResultResource<JSON, AnyValidators, AnyParams>
  >;

  return {
    ...parsed,
    vary: parsed.vary satisfies Vary<AnyParams> as NormalizedVary<AnyParams>,
    directives: parsed.directives as unknown as NormalizedProducerDirectives,
    date: new Date(parsed.date),
  } satisfies NormalizedProducerResultResource<
    JSON,
    AnyValidators,
    AnyParams
  > as NormalizedProducerResultResource<T, U, V>;
}
