import stableStringify from "safe-stable-stringify";

import type Cache from "../Cache.js";
import { type NormalizedProducerResult } from "../types/06_Normalization.js";
import {
  type Vary,
  type AnyParams,
  type AnyValidators,
  type ConsumerRequest,
  type Logger,
  type RequestPairedProducer,
} from "../types/index.js";
import collapsedTaskCreator from "./collapsedTaskCreator.js";
import { normalizeProducerResult, normalizeVary } from "./normalization.js";
import { defaultLoggersByComponent } from "./utils.js";

export type WrapProducerOptions<V extends AnyParams> = {
  isCacheable?(this: void, id: string, params: Partial<V>): boolean;
  collapseOverlappingRequestsTime?: number;
  logger?: Logger;
};

/**
 * Fundamentally, this function takes a function that returns values [likely
 * w/o the help of a cache], and returns another function that's a drop-in
 * replacement for the first, except that it looks up some of its results
 * from a cache, rather than calling the underlying user-provided function.
 *
 * @param {Cache} cache - An instance of the cache class. This is where
 *   values returned by the producer (see below) will actually be stored.
 *
 * @param {Function} options.isCacheable - A function returning whether a
 *   given request can have its response cached. Defaults to assuming all
 *   requests are cacheable (i.e., always returning true). Of course,
 *   producers can indicate in their individual responses that the response
 *   is not cachable (e.g., through the `maxAge: 0, storeFor: 0` directives),
 *   but this function allows the cache to always pass-through whole classes
 *   of requests. E.g., an HTTP cache built with this would return false for
 *   all requests where a `method` request parameter is POST.
 *
 * @param {number} options.collapseOverlappingRequestsTime - If multiple,
 *   identical requests (i.e., calls to the function returned by wrapProducer)
 *   are made that overlap in time (i.e., one has started, but not yet finished,
 *   at the time another starts), and multiple of these requests would be
 *   forwarded to the wrapped producer [because there's no cached value to
 *   satisfy them], these requests can be "deduplicated", so that only one
 *   request is made to the underlying producer, and its response is used for
 *   all the overlapping requests. This setting controls the maximum number of
 *   seconds that are allowed to have elapsed between the current request and
 *   the first of the overlapping requests, if this deduplication is to occur.
 *   I.e., if a request occurred greater than `collapseOverlappingRequestsTime`
 *   seconds after the earliest, identical, overlapping request, it will not be
 *   merged with the prior one, and instead a new request will go to the producer.
 *
 * @param {Logger} options.logger - A custom logger to use (optional).
 *
 * @param {Function} producer - The function that's actually responsible for
 *   returning the result that will be sent to the user and/or stored in the
 *   cache. It acts as the origin or "producer" for the cache. This function
 *   is passed the request (id and params) along with the caller's cache
 *   directives, which may be needed in case this producer function is itself
 *   backed by a cache, and it needs to decide whether to contact its origin.
 */
export default function wrapProducer<
  Id extends string,
  Content,
  Validators extends AnyValidators = AnyValidators,
  Params extends AnyParams = AnyParams,
>(
  cache: Cache<Content, Validators, Params, Id>,
  options: WrapProducerOptions<Params> | undefined,
  producer: RequestPairedProducer<Content, Validators, Params, Id>,
) {
  const {
    isCacheable = () => true,
    collapseOverlappingRequestsTime = 3,
    logger = defaultLoggersByComponent["wrap-producer"],
  } = options ?? {};

  const logTrace = logger.bind(null, "wrap-producer", "trace");
  const logWarning = logger.bind(null, "wrap-producer", "warn");

  // Suppose the caller is requesting a resource, and we're already in the
  // process of requesting that resource from the producer (or storing the
  // response), and our pending request had the same id and the same params.
  // This can happen in practice, e.g.: a user signs in; that triggers 10 items
  // to load to show on home screen; but each of those 10 depend on some
  // cache-managed resource, so 10 requests hit the cache for that resource
  // essentially at once; one will start first, and the other 9 will be in the
  // situation of asking the cache to request data for which the same request is
  // already pending.
  //
  // In a situation like the above, what are we to do? Technically, it is
  // _posssible_ for the resource at the origin to change after the 10th request
  // came in to the cache, but before the origin's response to the cache's first
  // outbound request arrived. Therefore, there's an argument that the cache
  // technically should issue a new request to the origin for each of the 10
  // requests described in our hypothetical above.
  //
  // In practice, though, such behavior would risk bombarding the origin and
  // surprising users (who, by virtue of using a cache, might only be expecting
  // one request to the origin) for very little gain, as it's highly unlikely
  // that the resource will change at the origin just in the window of time that
  // the origin's response to an identical request is in transit.
  //
  // In other words, its not usually our job to add layers of caching that the
  // caller didn't ask for [which is what not hitting the origin 10 times would
  // be], but this case is special because the fact that the response hasn't
  // finished saving to the store yet means that, even if the user _does_ want
  // caching here (and they probably do), there's no directive they can use to
  // request it.
  //
  // So, here, we decide to keep track of the in-flight requests to the origin
  // (and their pending saves to the store), and, if there is an identical
  // request pending that was issued less than `collapseOverlappingRequestsTime`
  // seconds ago, we wait for and use the response of the already-pending
  // request, rather than issuing a new one. We make
  // `collapseOverlappingRequestsTime` configurable to placate any user worried
  // about the miniscule risk of inconsistency from this caching.
  //
  // We do this using the getCollapsedTask utility. That utility does track the
  // pending tasks in memory, so this optimzation will be hindered a bit if the
  // cache frontend is horizontally-scaled across more than one server, but
  // that's fine. We _could_ put this data in the backing store, but that seems
  // like it could create more race conditions? And since batching identical
  // requests at all is an optimization, putting this in the store would
  // probably be overkill.
  //
  // Finally, note is that we only collapse requests that target the same id
  // _with the same parameters_. If we didn't require the params to match, we
  // could get back a response to the first/pending request, only to find out
  // that it includes a `varyKeys` value that makes it unsuitable to serve the
  // second request (that we were trying to avoid making). So we'd have to add
  // fallback logic to handle actually issuing the second request in that case,
  // and that would be too much extra complexity to be worth it. We're in a
  // similar situation with directives, which must also match.
  //
  // Of course, we can only use this IF THE REQUEST IS CACHEABLE.
  const callProducerAndLog: typeof producer = async (req) => {
    logTrace("contacting producer", req);
    const resp = await producer(req);
    logTrace("got response from producer", resp);
    return resp;
  };

  const callProducerAndStore: typeof producer = async (req) => {
    const requestPairedProducerResult = await callProducerAndLog(req);
    const { supplementalResources, ...rest } = requestPairedProducerResult;
    const mainResourceResult = { id: req.id, ...rest };
    logTrace(`attempting to store response.`);
    cache
      .store([...(supplementalResources ?? []), mainResourceResult])
      .then(() => {
        logTrace(`successfully stored producer's response`);
      })
      .catch((e) => {
        logTrace(`error storing producer's response`, e);
      });

    return requestPairedProducerResult;
  };

  const collapsedCallProducerAndStore = collapsedTaskCreator(
    callProducerAndStore,
    collapseOverlappingRequestsTime * 1000,
    stableStringify,
  );

  const normalizeVaryBound = (vary: Vary<Params>) =>
    normalizeVary(cache.normalizeParamName, cache.normalizeParamValue, vary);

  const wrappedProducer = async function (
    req: Omit<ConsumerRequest<Params, Id>, "directives" | "params"> &
      Partial<Pick<ConsumerRequest<Params, Id>, "directives" | "params">>,
  ): Promise<NormalizedProducerResult<Content, Validators, Params>> {
    const { id, params = {}, directives = {} } = req;
    // replace undefined params + direcvites w/ empty objects
    const finalRequest = { id, params, directives };

    const reqIsCacheable = isCacheable(id, params);
    logTrace(
      reqIsCacheable
        ? `deemed that request is cacheable; asking the cache for a response`
        : `deemed that request is NOT cacheable; skipping contacting the cache`,
      { id, params },
    );

    // If this request is not cacheable, we absolutely must contact the origin,
    // without any collapsing of concurrent requests, as the request could be
    // being made for its side effects.
    if (!reqIsCacheable) {
      const unnormalizedResult = await callProducerAndLog(finalRequest);
      return normalizeProducerResult(normalizeVaryBound, {
        id,
        ...unnormalizedResult,
      });
    }

    const cacheRes = await cache.get(finalRequest);
    const { usable, usableIfError, usableWhileRevalidate } = cacheRes;

    // We have ready-to-go content from the cache, w/ no refresh required.
    if (usable) {
      return usable;
    }

    // If we're here, we either don't have usable content at all, or we have
    // content that's only usable in the event of an origin error, or if we
    // make a background request to revalidate it. In any case, we're gonna
    // need to contact the origin for the result.
    //
    // TODO: Support validation requests and invalidation. How to do this is
    // actually tricker than it seems. There are questions like does the
    // validation response create a new Entry [potentially leaving the old entry
    // still there to match on other requests], or should it update an existing
    // one? [Does this mean entries need some notion of an id? Who generates
    // that?] What if the existing entry has since been deleted or aged out of
    // the store? Can the response update more than one entry? Can it update
    // things about it beyond reseting age to zero (e.g., changing the producer
    // directives)? Etc. For some HTTP context, see https://tools.ietf.org/html/rfc7234#section-4.3.4
    // For invalidation, the idea would be to somehow let request A passing
    // through the producer trigger the invalidation of other cached results [a
    // la a POST invalidating a GET in HTTP], but how? Call a user-provided
    // invalidate function and pass it the just-made request, the promise for
    // its response, and the entry store, and can delete entries made invalid by
    // the request that just passed through [once Store interface supports
    // deletion].
    const newContentPromise = collapsedCallProducerAndStore(finalRequest).then(
      (it) => normalizeProducerResult(normalizeVaryBound, { id, ...it }),
    );

    if (usableWhileRevalidate) {
      // swallow error rather than crash.
      newContentPromise.catch(() => {
        logWarning(
          "error asynchronously requesting refreshed content from producer",
          { id, params, directives },
        );
      });
      return usableWhileRevalidate;
    }

    return usableIfError
      ? newContentPromise.catch((error) => {
          logWarning(
            "error calling producer; falling back to a cached value, as permitted",
            { error, entry: usableIfError },
          );

          return usableIfError;
        })
      : newContentPromise;
  };

  // Expose the cache on the returned function
  // (for convenience, e.g., in closing it).
  wrappedProducer.cache = cache;

  return wrappedProducer;
}
