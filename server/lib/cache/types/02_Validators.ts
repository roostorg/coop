import { type JSON } from "./utils.js";

/**
 * Validators are identifiers (like a last-modified date, etag, or row version)
 * that can be returned with a value-to-cache to describe the value/capture the
 * current state of the underlying identity whose value is being cached.
 *
 * Users can define their own validators with custom names and value types,
 * so this type actually is used as _the constraint_ on the type of
 * user-defined validators. We require the values be JSON-serializable for the
 * for the same reason we require it of content [see Store type].
 */
export type AnyValidators = { [validatorName: string]: JSON };
