import { type JSON } from "./utils.js";

/**
 * A request for a potentially-cached value can include a set of "params" (i.e.,
 * named options). The `AnyParams` type represents all possible, legal sets of
 * params.
 *
 * In practice, though, every system will have a different set of params that it
 * accepts; therefore, it's expected that each system will define its own params
 * type, constrained to this type, enumerating the names and value types for the
 * params it accepts.
 *
 * Every param is always optional. The reasoning is that any "required" param
 * could simply be part of the primary cache key (i.e., the request "id").
 *
 * Upon receiving a request with params, the producer may use some of the param
 * values to influence its result (while ignoring others). If the producer does
 * change its result on the basis of some params, it can indicate which params
 * it used. This will change the cache key, but a request's params aren't part
 * of the cache key by default.
 *
 * In HTTP, "params" in this sense are request headers, and the `Vary` response
 * header is used to indicate which params had an effect on the cache key. This
 * whole setup is needed so that the client can send headers that the server can
 * ignore, without driving cache hit rate to zero.
 *
 * If the client wants to omit a param entriely on their request, ideally they
 * would simply leave out its key in params object at runtime; including the
 * key, but with an `undefined` value, would be forbidden. However, enforcing
 * that in Typescript is impossible: even under TS' `exactOptionalPropertyTypes`
 * flag, which is meant for use cases like this, there's currently no way to
 * indicate that the values in an index signature cannot include undefined. See
 * https://github.com/microsoft/TypeScript/issues/46969. Therefore, we bite the
 * bullet and just handle params having an undefined value, which is good
 * defensive programming anyway.
 *
 * Per the above, `undefined` isn't intended to be a legal ParamValue, and it
 * will be ignored. We just keep it here to make TS happy.
 */
export type AnyParams = { [paramName: string]: AnyParamValue | undefined };

/**
 * The type (used as a type constraint) for all parameter values.
 * Params cannot have the value `null`, because that's used to indicate
 * the absence of a param on a request, when that absence is significant to the
 * cache key. For example, imagine a producer indicating that param "x" is a
 * siginicant part of the cache key, and imagine this being indicated in
 * response to a request that _did not include param x_. This means the server
 * is asserting that param "x" must be missing in future requests for the
 * cached value to be usable. So, since backing stores are only expected to
 * be able to store json-serializable values, they'd be asked to represent this
 * by storing { "x": null } as the part of the vary requirements, which would
 * be ambiguous if null could also be a legal value for a parameter.
 */
export type AnyParamValue = Exclude<JSON, null>;
