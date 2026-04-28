import type { RequestHandler } from 'express';
import _Ajv, { type ErrorObject } from 'ajv-draft-04';

import { makeBadRequestError } from './errors.js';

// `ajv-draft-04` is a CJS module; under our `"module": "NodeNext"` ESM setup
// the real constructor ends up at `_Ajv.default`. This matches the pattern
// used elsewhere in this codebase (see `services/ncmecService/ncmecService.ts`
// and `services/partialItemsService/partialItemsService.ts`).
const Ajv = _Ajv as unknown as typeof _Ajv.default;

// Module-level singleton: Ajv internally caches compiled schemas by reference,
// and `ajv.compile` is idempotent per schema object.
const ajv = new Ajv({
  // Report every validation error, not just the first one, so the response
  // tells the caller about all their mistakes at once.
  allErrors: true,
  // Fail loudly if a schema uses keywords Ajv doesn't understand — that's
  // almost always a bug in the route definition rather than something we
  // want to silently ignore at runtime.
  strictSchema: true,
});

/**
 * Build an Express middleware that validates `req.body` against `schema`.
 *
 * On failure the middleware forwards a `BadRequestError` (a `CoopError`) to the
 * standard Express error handler, which serializes it into the project's
 * canonical `{ errors: [...] }` shape. We intentionally do NOT echo the raw
 * Ajv error objects back to the client: those include `params`, `schemaPath`,
 * and sometimes slices of the request body, which can leak implementation
 * details or user-supplied data back in the response.
 */
export function createBodySchemaValidator(
  // We intentionally take a permissive schema type here. The `Route.bodySchema`
  // field is already typed against its specific `ReqBody` at route-definition
  // sites; this middleware only forwards the schema to Ajv at runtime, which
  // doesn't care about the TS-side body type.
  schema: Record<string, unknown>,
): RequestHandler {
  const validate = ajv.compile(schema);

  return (req, _res, next) => {
    if (validate(req.body)) {
      next();
      return;
    }

    const errors = validate.errors ?? [];
    next(
      makeBadRequestError('Request body failed schema validation.', {
        shouldErrorSpan: false,
        pointer: errors[0] && toJsonPointer(errors[0]),
        detail: formatErrors(errors),
      }),
    );
  };
}

/**
 * Ajv's `instancePath` is already a JSON Pointer (e.g. `/items/0/name`), so we
 * just normalise an empty string (root) to `undefined` and return it.
 */
function toJsonPointer(err: ErrorObject): string | undefined {
  return err.instancePath.length > 0 ? err.instancePath : undefined;
}

/**
 * Build a short human-readable summary of the validation errors. We only
 * include Ajv's own `message` (which is derived from the schema, not the
 * request body) and the JSON Pointer into the request. No `params`,
 * `schemaPath`, or raw input data are exposed.
 */
function formatErrors(errors: readonly ErrorObject[]): string {
  if (errors.length === 0) return 'Unknown validation error.';
  return errors
    .map((err) => {
      const loc = err.instancePath || '/';
      return `${loc}: ${err.message ?? 'invalid value'}`;
    })
    .join('; ');
}
