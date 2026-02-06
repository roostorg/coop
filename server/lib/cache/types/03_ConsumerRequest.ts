import { type AnyParams } from "./01_Params.js";

/**
 * A consumer's request. Not surprising.
 *
 * For convenience, some code may make `params` and `directives` optional, and
 * handle filling in these values itself.
 *
 * We use partial for the params because, even if the Params type indicates that
 * some parameter is required, the semantics of params explicitly preclude
 * required params. See {@link AnyParams}.
 */
export type ConsumerRequest<
  Params extends AnyParams,
  Id extends string = string,
> = {
  id: Id;
  params: Partial<Params>;
  directives: ConsumerDirectives;
};

/**
 * Supported consumer directives. All are optional.
 *
 * - maxAge: The maximum age of a cached response that the consumer will accept,
 *   in seconds. If provided, the cache will never return a value older than
 *   this. If omitted, there's no age limit on used responses; however, the
 *   defaults for `maxStale` (see below), mean that the default behavior is for
 *   stored responses to be returned from the cache if & only if they're fresh.
 *
 * - maxStale: An array of three numbers, `[a, b, c]`. Each number indicates
 *   that the consumer is willing to accept a response that's been stale for no
 *   more than that number of seconds, but the three numbers apply in different
 *   circumstances. The first number indicates how stale a response the consumer
 *   will accept without the cache even having to attempt to revalidate the
 *   response. The second number indicates how stale a response the consumer
 *   will accept if the cache makes an effort to revalidate that response
 *   asynchronously. And, finally, the third number indicates how stale a
 *   response the consumer will accept if the cache is unable to reach the
 *   origin to revalidate the response. It must be that `0 <= a <= b <= c`.
 *   (If this isn't the case, each number in violation of the inequality will
 *   be given the value of the number before it.)
 *       To make this more concrete, suppose the consumer provides a `maxStale`
 *   value of `[10, 15, 45]`. That means it's willing to accept a response
 *   that's been stale for up to 10 seconds, without the cache even having to
 *   contact the origin to revalidate. Additionally, if the response is stale
 *   between 10 and 15 seconds, the consumer will still accept it, but only if
 *   the cache attempts to revalidate it in the background (so that a fresher
 *   response is available to use on subsequent requests). Finally, if the
 *   response is greater than 15 seconds stale, it is not usable unless the
 *   cache revalidates it. However, if that revalidation fails because the cache
 *   can't reach the origin, and the response is still less than 45 seconds
 *   stale, the consumer will accept it.
 *       If this directive is missing, the cache -- when processing each stored
 *   response to determine if that response is suitable -- acts as though the
 *   consumer provided a `maxStale` value of: 1) `[0, 0, 0]` if the producer did
 *   not provide a `maxStale` directive along with the response being processed;
 *   or 2) `[0, producerB, producerC]`, if the producer did provide a `maxStale`
 *   directive, and we represent its directive as
 *   `[producerA, producerB, producerC]`.
 *       This rather convoluted logic for synthesizing consumer `maxStale`
 *   values when the directive isn't provided explicitly is designed to match
 *   the default behavior employed by HTTP in the absence of the a consumer
 *   `max-stale` directive.
 *
 * - TODO: bring back consumer storeFor and apply it when sending resources to
 *   the store. Its meaning would be: "the maximum number of seconds that the
 *   cache may store data from the consumer's request and the resulting
 *   response. If not provided, the cache may store information indefinitely."
 *   The reason to have this is to match the consumer no-store directive in HTTP,
 *   as a privacy "nice-to-have".
 *
 * Note: when resolving directives, the cache will only return responses that
 * satisfy all directives. So, for example, if a stale response is within the
 * consumer's `maxStale` window, but older than its provided `maxAge`, that
 * response is not considered suitable. Likewise, all producer directives must
 * also be satisfied. So, if the producer indicates that a stale response is
 * usable for A seconds, whereas the consumer would accept it for B seconds,
 * the cache will serve it for `Math.min(A, B)` seconds.
 */
export type ConsumerDirectives = {
  maxAge?: number;
  maxStale?: [number, number, number];
};
