import type { Request, Response } from 'express';
import * as v from 'valibot';
import { vi } from 'vitest';

import { createBodySchemaValidator } from './bodySchemaValidation.js';
import { CoopError } from './errors.js';

const schema = v.object({
  name: v.string(),
  count: v.optional(v.pipe(v.number(), v.integer())),
});

function invoke(
  middleware: ReturnType<typeof createBodySchemaValidator>,
  body: unknown,
) {
  const req: Partial<Request> = { body };
  const res: Partial<Response> = {};
  const next = vi.fn();
  middleware(req as Request, res as Response, next);
  return { next, req };
}

function firstNextArg(next: ReturnType<typeof vi.fn>): unknown {
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

  test('passes an accepted extra-property body to the handler unchanged', () => {
    const middleware = createBodySchemaValidator(schema);
    const body = { name: 'ok', surprise: true };
    const { next, req } = invoke(middleware, body);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toBe(body);
    expect(req.body).toEqual({ name: 'ok', surprise: true });
  });

  test('rejects non-object bodies (e.g., undefined from a request with no body)', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, undefined);

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({ name: 'BadRequestError', status: 400 });
  });

  test('escapes issue path segments as a JSON Pointer', () => {
    const middleware = createBodySchemaValidator(
      v.object({ 'a/b~c': v.string() }),
    );
    const { next } = invoke(middleware, { 'a/b~c': 42 });

    expect(firstNextArg(next)).toMatchObject({ pointer: '/a~1b~0c' });
  });

  test('does not leak validator internals or request values in the error detail', () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = invoke(middleware, {
      name: 'secret-value',
      count: 'wrong',
    });

    const err = firstNextArg(next) as CoopError;
    expect(err.detail ?? '').not.toContain('input');
    expect(err.detail ?? '').not.toContain('received');
    expect(err.detail ?? '').not.toContain('secret-value');
  });
});
