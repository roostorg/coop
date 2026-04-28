import type { Request, Response } from 'express';

import { createBodySchemaValidator } from './bodySchemaValidation.js';
import { CoopError } from './errors.js';

const schema: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  type: 'object',
  properties: {
    name: { type: 'string' },
    count: { type: 'integer' },
  },
  required: ['name'],
  additionalProperties: false,
};

function invoke(
  middleware: ReturnType<typeof createBodySchemaValidator>,
  body: unknown,
) {
  const req: Partial<Request> = { body };
  const res: Partial<Response> = {};
  const next = jest.fn();
  middleware(req as Request, res as Response, next);
  return { next };
}

function firstNextArg(next: ReturnType<typeof jest.fn>): unknown {
  return next.mock.calls[0]?.[0];
}

describe('createBodySchemaValidator', () => {
  test('passes valid bodies through to next()', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { name: 'ok', count: 3 });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('allows optional fields to be omitted', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { name: 'ok' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('forwards a BadRequestError when a required field is missing', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { count: 3 });

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({
      name: 'BadRequestError',
      status: 400,
      title: 'Request body failed schema validation.',
    });
    // Error message should reference the missing field, not crash.
    expect((err as CoopError).detail).toContain('name');
  });

  test('forwards a BadRequestError when a field has the wrong type', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { name: 'ok', count: 'not-a-number' });

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({
      name: 'BadRequestError',
      status: 400,
      pointer: '/count',
    });
  });

  test('rejects unknown additional properties when the schema forbids them', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { name: 'ok', surprise: true });

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({ name: 'BadRequestError', status: 400 });
  });

  test('rejects non-object bodies (e.g., undefined from a request with no body)', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, undefined);

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({ name: 'BadRequestError', status: 400 });
  });

  test('does not leak Ajv internals (schemaPath / params) in the error detail', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, { name: 42 });

    const err = firstNextArg(next) as CoopError;
    expect(err.detail ?? '').not.toContain('schemaPath');
    expect(err.detail ?? '').not.toContain('params');
  });
});
