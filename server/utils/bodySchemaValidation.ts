import type { RequestHandler } from 'express';
import type { JsonObject } from 'type-fest';
import {
  getMetadata,
  safeParse,
  type GenericIssue,
  type GenericSchema,
} from 'valibot';

import { makeBadRequestError } from './errors.js';

/**
 * Build an Express middleware that validates `req.body` against `schema`.
 *
 * On failure the middleware forwards a `BadRequestError` (a `CoopError`) to the
 * standard Express error handler, which serializes it into the project's
 * canonical `{ errors: [...] }` shape. The parsed output is intentionally
 * discarded so transformations and object-key handling do not alter the body
 * received by the route handler.
 */
export function createBodySchemaValidator<ReqBody extends JsonObject>(
  schema: GenericSchema<ReqBody, unknown>,
): RequestHandler {
  return (req, _res, next) => {
    const result = safeParse(schema, req.body, { abortEarly: false });
    if (result.success) {
      next();
      return;
    }

    next(
      makeBadRequestError('Request body failed schema validation.', {
        shouldErrorSpan: false,
        ...formatValidationIssues(result.issues, schema, req.body),
      }),
    );
  };
}

function escapeJsonPointerSegment(segment: unknown): string {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

type ErrorSchema = GenericSchema & {
  entries?: Record<string, ErrorSchema>;
  item?: ErrorSchema;
  items?: readonly ErrorSchema[];
  rest?: ErrorSchema;
  wrapped?: ErrorSchema;
  options?: readonly ErrorSchema[];
  pipe?: readonly (ErrorSchema | { kind: string; type: string })[];
};

export function formatValidationIssues(
  issues: readonly GenericIssue[],
  schema: GenericSchema,
  input: unknown,
): { pointer: string | undefined; detail: string } {
  const errors = validationErrors(schema, input, '', issues);
  return {
    pointer: errors[0]?.path || undefined,
    detail: errors
      .map(({ path, message }) => `${path || '/'}: ${message}`)
      .join('; '),
  };
}

type ValidationError = { path: string; message: string };

/**
 * Public errors use JSON Schema wording and ordering: object constraints,
 * missing keys, extra keys, then field errors. Schema traversal also exposes
 * every union branch and extra key, which Valibot can omit from its issues.
 */
function validationErrors(
  schema: ErrorSchema,
  input: unknown,
  path: string,
  issues: readonly GenericIssue[] = safeParse(schema, input, {
    abortEarly: false,
  }).issues ?? [],
): ValidationError[] {
  if (issues.length === 0) return [];
  while (schema.type === 'optional' && schema.wrapped) schema = schema.wrapped;
  const nullable = schema.type === 'nullable';
  if (nullable && schema.wrapped) schema = schema.wrapped;
  const base =
    schema.pipe
      ?.filter((step): step is ErrorSchema => step.kind === 'schema')
      .at(-1) ?? schema;
  const error = (message: string): ValidationError => ({ path, message });

  if (
    base.entries &&
    (typeof input !== 'object' || input === null || Array.isArray(input))
  ) {
    return [error(`must be object${nullable ? ',null' : ''}`)];
  }

  if (base.type === 'union' && base.options) {
    const branches = base.options.map((option) =>
      validationErrors(option, input, path),
    );
    return [
      ...(branches.filter((branch) => branch.length === 0).length > 1
        ? []
        : branches.flat()),
      error('must match exactly one schema in oneOf'),
    ];
  }

  if (
    base.entries &&
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input)
  ) {
    const object = input as Record<string, unknown>;
    const properties = base.entries;
    const entries = Object.entries(properties);
    const requiredOrder = getMetadata(schema).requiredOrder as
      readonly string[] | undefined;
    const required = (
      requiredOrder ??
      entries
        .filter(([, field]) => field.type !== 'optional')
        .map(([key]) => key)
    ).filter((key) => object[key] === undefined);
    return [
      ...issues
        .filter((issue) => !issue.path)
        .map((issue) => error(formatIssue(issue, schema))),
      ...required.map((key) => error(`must have required property '${key}'`)),
      ...(base.type === 'strict_object'
        ? Object.keys(object)
            .filter((key) => !(key in properties))
            .map(() => error('must NOT have additional properties'))
        : []),
      ...entries.flatMap(([key, field]) =>
        object[key] === undefined
          ? []
          : validationErrors(
              field,
              object[key],
              `${path}/${escapeJsonPointerSegment(key)}`,
            ),
      ),
    ];
  }

  if ((base.item || base.items) && Array.isArray(input)) {
    return [
      ...(base.items && input.length < base.items.length
        ? [error(`must NOT have fewer than ${base.items.length} items`)]
        : []),
      ...issues
        .filter((issue) => !issue.path)
        .map((issue) => error(formatIssue(issue, schema))),
      ...input.flatMap((item, index) => {
        const field = base.item ?? base.items?.[index] ?? base.rest;
        return field ? validationErrors(field, item, `${path}/${index}`) : [];
      }),
    ];
  }

  return [
    ...(getMetadata(schema).jsonSchemaType === 'string' &&
    typeof input !== 'string'
      ? [error('must be string')]
      : []),
    ...issues.map((issue) => {
      const message = formatIssue(issue, schema);
      return error(
        `${message}${nullable && /^must be (string|number|integer|boolean|object|array|null)$/.test(message) ? ',null' : ''}`,
      );
    }),
  ];
}

function formatIssue(issue: GenericIssue, schema: ErrorSchema): string {
  if (issue.message.startsWith('must ')) return issue.message;
  if (['object', 'strict_object', 'loose_object'].includes(issue.type)) {
    return 'must be object';
  }
  if (['array', 'tuple_with_rest'].includes(issue.type)) return 'must be array';
  if (['string', 'number', 'boolean', 'null', 'integer'].includes(issue.type)) {
    const type = schema.pipe?.some((step) => step.type === 'integer')
      ? 'integer'
      : issue.type;
    return `must be ${type}`;
  }

  switch (issue.type) {
    case 'picklist':
    case 'enum':
    case 'literal':
      return 'must be equal to one of the allowed values';
    case 'min_length':
    case 'max_length': {
      const comparison = issue.type === 'min_length' ? 'fewer' : 'more';
      const unit = Array.isArray(issue.input) ? 'items' : 'characters';
      return `must NOT have ${comparison} than ${String(issue.requirement)} ${unit}`;
    }
    case 'min_value':
    case 'max_value':
      return `must be ${issue.type === 'min_value' ? '>=' : '<='} ${String(issue.requirement)}`;
    case 'regex':
      return `must match pattern "${(issue.requirement as RegExp).source}"`;
    default:
      return 'invalid value';
  }
}
