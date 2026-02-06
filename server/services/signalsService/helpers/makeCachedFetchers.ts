import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../../iocContainer/index.js';
import { cached } from '../../../utils/caching.js';
import {
  jsonParse,
  jsonStringify,
  type JsonOf,
} from '../../../utils/encoding.js';
import { isCoopErrorOfType, type CoopError } from '../../../utils/errors.js';
import { type JSON } from '../../../utils/json-schema-types.js';
import { getOpenAiModerationScores } from '../signals/third_party_signals/open_ai/moderation/openAIModerationUtils.js';
import { getOpenAiTranscription } from '../signals/third_party_signals/open_ai/whisper/OpenAiWhisperTranscriptionSignal.js';

export type CachedFetchers = ReturnType<typeof makeCachedFetchers>;

export function makeCachedFetchers(
  fetchHTTP: Dependencies['fetchHTTP'],
  tracer: Dependencies['Tracer'],
) {
  // NB: these caches last for the full duration of the Node process, so it's
  // worth thinking about their memory usage. Assuming Coop is processing
  // 10 million pieces of content a day, each server instance might see 2-4
  // million a day, which means ~2500 pieces of content per minute. So, that
  // should be the rough, ongoing size of each of these maps. That'll mean
  // 12 expensive resize operations (as the map grows to its final size), but
  // those'll only happen once (I think), at least while the map is hot. The
  // items in the maps are small objects, which should share a hidden class
  // and (even with the hash) not use too much memory. If we say 1kb per
  // entry, which seems conservative, that's only a meager ~2mb per cache.

  return {
    openAiModerationFetcher: toCachedFetcher(
      getOpenAiModerationScores.bind(null, fetchHTTP, tracer),
    ),
    openAiWhisperTranscriptionFetcher: toCachedFetcher(
      getOpenAiTranscription.bind(null, fetchHTTP),
    ),
  };
}

/**
 * Returns a cached version of `fetcher` that stores the results for 30 seconds
 * but doesn't cache the result if the fetcher rejects (so those requests can be
 * retried), unless it explicitly rejects with a `SignalPermanentError`.
 */
function toCachedFetcher<T extends ReadonlyDeep<JSON>, U extends unknown>(
  fetcher: (key: T) => Promise<U>,
) {
  const cachedFetcher = cached<
    T,
    | { fromRejection: true; value: CoopError<'SignalPermanentError'> }
    | { fromRejection: false; value: U }
  >({
    producer: async (k) =>
      fetcher(k).then(
        (value) => ({ fromRejection: false, value }),
        (e) => {
          // If the fetcher returned a Promise that rejected with a
          // SignalPermanentError, we have to convert that to a promise that
          // resolves with the error, because our `cached` helper will only cache
          // the value from promises that resolve (i.e., succeed). Then, we have
          // to record that we've converted this rejection into a resolution, so
          // that we can throw in the returned `finalFetcher`, to make its
          // behavior match the behavior of the original `fetcher`.
          if (isCoopErrorOfType(e, 'SignalPermanentError')) {
            return { fromRejection: true, value: e };
          } else {
            throw e;
          }
        },
      ),
    keyGeneration: {
      toString: jsonStringify<T>,
      fromString: jsonParse<JsonOf<T>>,
    },
    // NB: this is designed to roughly match the time it takes to process a
    // request, i.e., running all the rules (including sequential signal calls)
    // on submitted items, with some buffer. The idea is that the cache results
    // are really only useful for the request that populated the cache, but it's
    // slightly tricky to directly tie the cache lifetime to the request
    // lifetime. Therefore, if the time it takes to process an item goes up --
    // say, because we add more signal retries -- we may need to bump up this
    // value, but that might not be scalable (as memory usage will grow
    // commensurately), so we might have to rework this more fundamentally to
    // indeed be tied to the request lifecycle through (e.g.) AsyncLocalStorage
    // + a WeakMap to cache instances.
    directives: { freshUntilAge: 30 },
  });

  const finalFetcher = async (k: T) => {
    const res = await cachedFetcher(k);
    if (res.fromRejection) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw res.value;
    }
    return res.value;
  };

  finalFetcher.close = async () => cachedFetcher.close();
  return finalFetcher;
}
