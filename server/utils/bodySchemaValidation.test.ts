import * as v from 'valibot';
import { vi } from 'vitest';

import reportingRoutes from '../routes/reporting/ReportingRoutes.js';
import { rawItemSubmissionSchema } from '../services/itemProcessingService/index.js';
import { makeHandlerContext } from '../test/adonisTestHelpers.js';
import { createBodySchemaValidator, jsonBody } from './bodySchemaValidation.js';
import { CoopError } from './errors.js';
import { route } from './route-helpers.js';

const schema = v.object({
  name: v.string(),
  count: v.optional(v.pipe(v.number(), v.integer())),
});

/**
 * Runs the middleware on a JSON request with `body` (no body at all when it's
 * `undefined`), reporting a thrown error to `next` as Express middleware did.
 */
async function invoke(
  middleware: ReturnType<typeof createBodySchemaValidator>,
  body: unknown,
) {
  const ctx = makeHandlerContext({
    headers:
      body === undefined
        ? {}
        : { 'content-type': 'application/json', 'content-length': '1' },
  });
  ctx.request.updateBody(body as Record<string, unknown>);
  const next = vi.fn();
  try {
    await middleware(ctx, async () => next());
  } catch (e) {
    next(e);
  }
  return { next, body: jsonBody(ctx) };
}

function firstNextArg(next: ReturnType<typeof vi.fn>): unknown {
  return next.mock.calls[0]?.[0];
}

describe('createBodySchemaValidator', () => {
  test('passes valid bodies through to next()', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, { name: 'ok', count: 3 });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('allows optional fields to be omitted', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, { name: 'ok' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('forwards a BadRequestError when a required field is missing', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, { count: 3 });

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({
      name: 'BadRequestError',
      status: 400,
      title: 'Request body failed schema validation.',
      pointer: undefined,
      detail: "/: must have required property 'name'",
    });
  });

  test('points a nested missing field at its containing object', async () => {
    const middleware = createBodySchemaValidator(
      v.object({ parent: v.object({ child: v.string() }) }),
    );
    const { next } = await invoke(middleware, { parent: {} });

    expect(firstNextArg(next)).toMatchObject({
      pointer: '/parent',
      detail: "/parent: must have required property 'child'",
    });
  });

  test('forwards a BadRequestError when a field has the wrong type', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, {
      name: 'ok',
      count: 'not-a-number',
    });

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({
      name: 'BadRequestError',
      status: 400,
      pointer: '/count',
      detail: '/count: must be integer',
    });
  });

  test('reports a numeric-constraint failure without echoing its value', async () => {
    const middleware = createBodySchemaValidator(
      v.object({ count: v.pipe(v.number(), v.minValue(2)) }),
    );
    const { next } = await invoke(middleware, { count: 1 });

    expect(firstNextArg(next)).toMatchObject({
      pointer: '/count',
      detail: '/count: must be >= 2',
    });
  });

  test('reports an unknown property at its containing object', async () => {
    const middleware = createBodySchemaValidator(
      v.strictObject({ name: v.string() }),
    );
    const { next } = await invoke(middleware, { name: 'ok', extra: 'secret' });

    expect(firstNextArg(next)).toMatchObject({
      pointer: undefined,
      detail: '/: must NOT have additional properties',
    });
  });

  test.each([
    [v.string(), 42, 'must be string'],
    [v.object({ name: v.string() }), null, 'must be object'],
    [
      v.pipe(v.string(), v.minLength(2)),
      '',
      'must NOT have fewer than 2 characters',
    ],
    [
      v.pipe(v.string(), v.maxLength(2)),
      'abc',
      'must NOT have more than 2 characters',
    ],
    [
      v.pipe(v.string(), v.minCodePoints(2)),
      '😀',
      'must NOT have fewer than 2 characters',
    ],
    [
      v.pipe(v.string(), v.maxCodePoints(2)),
      '😀e\u0301',
      'must NOT have more than 2 characters',
    ],
    [
      v.pipe(v.array(v.string()), v.minLength(1)),
      [],
      'must NOT have fewer than 1 items',
    ],
    [v.picklist(['a', 'b']), 'c', 'must be equal to one of the allowed values'],
    [v.nullable(v.string()), 42, 'must be string,null'],
  ])(
    'preserves validation wording for %s',
    async (fieldSchema, value, message) => {
      const { next } = await invoke(
        createBodySchemaValidator(v.object({ field: fieldSchema })),
        { field: value },
      );

      expect(firstNextArg(next)).toMatchObject({
        pointer: '/field',
        detail: `/field: ${message}`,
      });
    },
  );

  test('reports required fields and every extra property before field errors', async () => {
    const { next } = await invoke(
      createBodySchemaValidator(
        v.strictObject({ name: v.string(), count: v.number() }),
      ),
      { name: 42, extra: true, other: false },
    );
    expect(firstNextArg(next)).toMatchObject({
      pointer: undefined,
      detail:
        "/: must have required property 'count'; /: must NOT have additional properties; /: must NOT have additional properties; /name: must be string",
    });
  });

  test('preserves item-submission alternative diagnostics', async () => {
    const { next } = await invoke(
      createBodySchemaValidator(v.object({ item: rawItemSubmissionSchema })),
      { item: { id: 'i', typeId: 't' } },
    );
    expect(firstNextArg(next)).toMatchObject({
      pointer: '/item',
      detail:
        "/item: must have required property 'data'; /item: must have required property 'data'; /item: must have required property 'type'; /item: must match exactly one schema in oneOf",
    });
  });

  test('preserves the required-field order for appeals', async () => {
    const { next } = await invoke(
      createBodySchemaValidator(reportingRoutes.routes[1].bodySchema!),
      {},
    );
    expect(firstNextArg(next)).toMatchObject({
      pointer: undefined,
      detail:
        "/: must have required property 'appealId'; /: must have required property 'appealedAt'; /: must have required property 'actionedItem'; /: must have required property 'appealedBy'; /: must have required property 'actionsTaken'",
    });
  });

  test('rejects arrays for an optional report reason object', async () => {
    const { next } = await invoke(
      createBodySchemaValidator(reportingRoutes.routes[0].bodySchema!),
      {
        reporter: { kind: 'user', typeId: 'user', id: 'reporter' },
        reportedAt: '2026-01-01',
        reportedItem: { id: 'item', typeId: 'post', data: {} },
        reportedForReason: [],
      },
    );
    expect(firstNextArg(next)).toMatchObject({
      pointer: '/reportedForReason',
      detail: '/reportedForReason: must be object',
    });
  });

  test('passes an accepted extra-property body to the handler unchanged', async () => {
    const middleware = createBodySchemaValidator(schema);
    const body = { name: 'ok', surprise: true };
    const { next, body: handlerBody } = await invoke(middleware, body);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(handlerBody).toBe(body);
    expect(handlerBody).toEqual({ name: 'ok', surprise: true });
  });

  test('rejects non-object bodies (e.g., undefined from a request with no body)', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, undefined);

    expect(next).toHaveBeenCalledTimes(1);
    const err = firstNextArg(next);
    expect(err).toBeInstanceOf(CoopError);
    expect(err).toMatchObject({ name: 'BadRequestError', status: 400 });
  });

  test('escapes issue path segments as a JSON Pointer', async () => {
    const middleware = createBodySchemaValidator(
      v.object({ 'a/b~c': v.string() }),
    );
    const { next } = await invoke(middleware, { 'a/b~c': 42 });

    expect(firstNextArg(next)).toMatchObject({ pointer: '/a~1b~0c' });
  });

  test('does not leak validator internals or request values in the error detail', async () => {
    const middleware = createBodySchemaValidator(schema);
    const { next } = await invoke(middleware, {
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
  test('types the handler body as the original input of a transforming/defaulting schema', async () => {
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
      () => (_ctx, body) => {
        expectTypeOf(body).toEqualTypeOf<
          v.InferInput<typeof transformingSchema>
        >();
        expectTypeOf(body).not.toEqualTypeOf<
          v.InferOutput<typeof transformingSchema>
        >();
      },
    );
  });
});
