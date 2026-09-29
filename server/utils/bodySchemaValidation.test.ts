import type { Request, Response } from 'express';
import * as v from 'valibot';
import { vi } from 'vitest';

import { createBodySchemaValidator } from './bodySchemaValidation.js';
import { CoopError } from './errors.js';
import { route } from './route-helpers.js';

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
      pointer: undefined,
      detail: '/: invalid value',
    });
  });

  test('points a nested missing field at its containing object', () => {
    const middleware = createBodySchemaValidator(
      v.object({ parent: v.object({ child: v.string() }) }),
    );
    const { next } = invoke(middleware, { parent: {} });

    expect(firstNextArg(next)).toMatchObject({
      pointer: '/parent',
      detail: '/parent: invalid value',
    });
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
      detail: '/count: invalid value',
    });
  });

  test('reports a numeric-constraint failure without echoing its value', () => {
    const middleware = createBodySchemaValidator(
      v.object({ count: v.pipe(v.number(), v.minValue(2)) }),
    );
    const { next } = invoke(middleware, { count: 1 });

    expect(firstNextArg(next)).toMatchObject({
      pointer: '/count',
      detail: '/count: invalid value',
    });
  });

  test('reports an unknown property at its containing object', () => {
    const middleware = createBodySchemaValidator(
      v.strictObject({ name: v.string() }),
    );
    const { next } = invoke(middleware, { name: 'ok', extra: 'secret' });

    expect(firstNextArg(next)).toMatchObject({
      pointer: undefined,
      detail: '/: invalid value',
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

describe('route body schema typing', () => {
  test('types the handler body as the original input of a transforming/defaulting schema', () => {
    const transformingSchema = v.object({
      count: v.pipe(
        v.string(),
        v.transform((value) => Number(value)),
      ),
      label: v.optional(v.string(), 'default label'),
    });

    route.post(
      '/typed',
      { bodySchema: transformingSchema },
      () => (req, res) => {
        expectTypeOf(req.body).toEqualTypeOf<
          v.InferInput<typeof transformingSchema>
        >();
        expectTypeOf(req.body).not.toEqualTypeOf<
          v.InferOutput<typeof transformingSchema>
        >();
        res.sendStatus(204);
      },
    );
  });
});
