import type { HttpContext } from '@adonisjs/core/http';
import {
  errors,
  SimpleMessagesProvider,
  type VineValidator,
} from '@vinejs/vine';
import type {
  ErrorReporterContract,
  FieldContext,
  SchemaTypes,
} from '@vinejs/vine/types';

import { jsonBody } from '../../utils/bodySchemaValidation.js';
import { makeBadRequestError } from '../../utils/errors.js';

type FieldError = { path: string; message: string };

/**
 * Coop's public validation errors use JSON Schema (AJV) wording, e.g.
 * `/note: must be string`, with a JSON pointer to the first failing field.
 * VineJS' default reporter (422, `{ errors: [{ field, message, rule }] }`)
 * would change the REST API's error responses, so this reporter turns VineJS
 * errors into Coop's wording; `validateJsonBody` then throws Coop's 400
 * `BadRequestError` (VineJS' types require reporters to return its own
 * `ValidationError`).
 */
export class CoopErrorReporter implements ErrorReporterContract {
  hasErrors = false;
  #errors: FieldError[] = [];

  report(message: string, rule: string, field: FieldContext) {
    this.hasErrors = true;
    const path = toPointer(field.getFieldPath());
    if (rule === 'required') {
      // JSON Schema reports a missing key on the object that lacks it.
      const parent = path.slice(0, path.lastIndexOf('/'));
      this.#errors.push({
        path: parent,
        message: `must have required property '${String(field.name)}'`,
      });
      return;
    }
    this.#errors.push({ path, message });
  }

  createError() {
    return new errors.E_VALIDATION_ERROR(this.#errors);
  }
}

/**
 * Validates the JSON body (not `request.validateUsing()`, which validates the
 * body merged with the query string, params, headers and cookies).
 */
export async function validateJsonBody<Schema extends SchemaTypes>(
  ctx: HttpContext,
  validator: VineValidator<Schema, undefined>,
) {
  const [error, value] = await validator.tryValidate(jsonBody(ctx), {
    errorReporter: () => new CoopErrorReporter(),
    messagesProvider: coopMessages,
    meta: undefined,
  });
  if (error) {
    const fieldErrors = error.messages as FieldError[];
    throw makeBadRequestError('Request body failed schema validation.', {
      shouldErrorSpan: false,
      pointer: fieldErrors[0]?.path || undefined,
      detail: fieldErrors
        .map(({ path, message }) => `${path || '/'}: ${message}`)
        .join('; '),
    });
  }
  return value;
}

function toPointer(fieldPath: string) {
  return fieldPath === ''
    ? ''
    : `/${fieldPath
        .split('.')
        .map((it) => it.replaceAll('~', '~0').replaceAll('/', '~1'))
        .join('/')}`;
}

/** AJV wording for the VineJS rules Coop's REST schemas use. */
export const coopMessages = new SimpleMessagesProvider(
  Object.fromEntries([
    ['string', 'must be string'],
    ['boolean', 'must be boolean'],
    ['number', 'must be number'],
    ['object', 'must be object'],
    ['record', 'must be object'],
    ['array', 'must be array'],
    ['maxCodePoints', 'must NOT have more than {{ max }} characters'],
  ]),
);
