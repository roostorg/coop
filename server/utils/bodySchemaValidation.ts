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
  knownIssues?: readonly GenericIssue[],
): ValidationError[] {
  const issues =
    knownIssues ?? safeParse(schema, input, { abortEarly: false }).issues ?? [];
  if (issues.length === 0) return [];

  const { schema: messageSchema, base, nullable } = unwrapSchema(schema);

  if (base.entries) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return [
        { path, message: nullable ? 'must be object,null' : 'must be object' },
      ];
    }
    return objectValidationErrors(
      messageSchema,
      base.entries,
      base.type === 'strict_object',
      input as Record<string, unknown>,
      path,
      issues,
    );
  }

  if (base.type === 'union' && base.options) {
    return unionValidationErrors(base.options, input, path);
  }

  if ((base.item || base.items) && Array.isArray(input)) {
    return arrayValidationErrors(messageSchema, base, input, path, issues);
  }

  const errors: ValidationError[] = [];
  if (
    getMetadata(messageSchema).jsonSchemaType === 'string' &&
    typeof input !== 'string'
  ) {
    errors.push({ path, message: 'must be string' });
  }

  for (const issue of issues) {
    let message = formatIssue(issue, messageSchema);
    if (
      nullable &&
      /^must be (string|number|integer|boolean|object|array|null)$/.test(
        message,
      )
    ) {
      message += ',null';
    }
    errors.push({ path, message });
  }
  return errors;
}

function unwrapSchema(schema: ErrorSchema) {
  while (schema.type === 'optional' && schema.wrapped) {
    schema = schema.wrapped;
  }
  const nullable = schema.type === 'nullable';
  if (nullable && schema.wrapped) {
    schema = schema.wrapped;
  }

  // Keep the pipeline for messages and metadata; its last schema defines the structure.
  let base = schema;
  for (const step of schema.pipe ?? []) {
    if (step.kind === 'schema') {
      base = step as ErrorSchema;
    }
  }
  return { schema, base, nullable };
}

function objectValidationErrors(
  schema: ErrorSchema,
  properties: Record<string, ErrorSchema>,
  strict: boolean,
  input: Record<string, unknown>,
  path: string,
  issues: readonly GenericIssue[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const issue of issues) {
    if (!issue.path) {
      errors.push({ path, message: formatIssue(issue, schema) });
    }
  }

  const entries = Object.entries(properties);
  const requiredOrder = getMetadata(schema).requiredOrder as
    readonly string[] | undefined;
  const requiredKeys =
    requiredOrder ??
    entries
      .filter(([, field]) => field.type !== 'optional')
      .map(([key]) => key);
  for (const key of requiredKeys) {
    if (input[key] === undefined) {
      errors.push({ path, message: `must have required property '${key}'` });
    }
  }

  if (strict) {
    for (const key of Object.keys(input)) {
      if (!(key in properties)) {
        errors.push({ path, message: 'must NOT have additional properties' });
      }
    }
  }

  for (const [key, field] of entries) {
    if (input[key] !== undefined) {
      const fieldPath = `${path}/${escapeJsonPointerSegment(key)}`;
      errors.push(...validationErrors(field, input[key], fieldPath));
    }
  }
  return errors;
}

function arrayValidationErrors(
  schema: ErrorSchema,
  base: ErrorSchema,
  input: unknown[],
  path: string,
  issues: readonly GenericIssue[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (base.items && input.length < base.items.length) {
    errors.push({
      path,
      message: `must NOT have fewer than ${base.items.length} items`,
    });
  }
  for (const issue of issues) {
    if (!issue.path) {
      errors.push({ path, message: formatIssue(issue, schema) });
    }
  }
  input.forEach((item, index) => {
    const field = base.item ?? base.items?.[index] ?? base.rest;
    if (field) {
      errors.push(...validationErrors(field, item, `${path}/${index}`));
    }
  });
  return errors;
}

function unionValidationErrors(
  options: readonly ErrorSchema[],
  input: unknown,
  path: string,
): ValidationError[] {
  let errors: ValidationError[] = [];
  let matchingBranches = 0;
  for (const option of options) {
    const branchErrors = validationErrors(option, input, path);
    if (branchErrors.length === 0) {
      matchingBranches++;
    } else {
      errors.push(...branchErrors);
    }
  }
  if (matchingBranches > 1) {
    errors = [];
  }
  errors.push({ path, message: 'must match exactly one schema in oneOf' });
  return errors;
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
