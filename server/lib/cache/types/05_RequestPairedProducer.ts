import { type AnyParams } from "./01_Params.js";
import { type AnyValidators } from "./02_Validators.js";
import { type ConsumerRequest } from "./03_ConsumerRequest.js";
import { type ProducerResult } from "./04_ProducerResult.js";

/**
 * Helper type combining ConsumerRequest and RequestPairedProducerResult.
 */
export type RequestPairedProducer<
  T,
  Validators extends AnyValidators = AnyValidators,
  Params extends AnyParams = AnyParams,
  Id extends string = string,
> = (
  req: ConsumerRequest<Params, Id>,
) => Promise<RequestPairedProducerResult<T, Validators, Params>>;

/**
 * A producer result that will be processed along with a corresponding request.
 * Because the request will have indicated the id, the producer can leave that
 * out. However, it must still set `vary`, if the result varied on any request
 * params.
 */
export type RequestPairedProducerResult<
  T,
  U extends AnyValidators,
  V extends AnyParams,
> = Omit<ProducerResult<T, U, V>, "id"> & {
  id?: ProducerResult<T, U, V>["id"];
};
