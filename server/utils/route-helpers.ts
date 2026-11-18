import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import { type JsonObject, type JsonValue, type ReadonlyDeep } from 'type-fest';
import { type GenericSchema } from 'valibot';

import { type Dependencies } from '../iocContainer/index.js';

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** Set by the API key middleware (`utils/apiKeyMiddleware.ts`). */
    orgId?: string;
  }
}

/**
 * A route handler. It returns the response body (`undefined` for an empty
 * response), so the body is type checked against `ResBody` the way
 * `res.json()` was under Express. Status and headers go on `ctx.response`.
 *
 * AdonisJS writes the response only after the handler's promise settles.
 * A handler that must reply first and keep working afterwards calls
 * `ctx.response.finish()` to flush the response early.
 */
export type RouteHandler<
  ReqBody extends JsonObject,
  // @ts-ignore Silence error w/ hitting TS max recursion limit before the type param is actually bound.
  ResBody extends ReadonlyDeep<JsonValue> | undefined, // undefined is used to indicate an empty response
> = (
  ctx: HttpContext,
  body: ReqBody,
) => Promise<ResBody | void> | ResBody | void;

export type RouteMiddleware = (
  ctx: HttpContext,
  next: NextFn,
) => Promise<unknown> | unknown;

export type Route<
  ReqBody extends JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined,
> = {
  path: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  handler: (deps: Dependencies) => RouteHandler<ReqBody, ResBody>;
  /** Runs before the handler, after body validation. */
  middleware?: (deps: Dependencies) => RouteMiddleware[];
  name?: string;
  bodySchema?: GenericSchema<ReqBody, unknown>;
};

type RouteOpts<ReqBody extends JsonObject> = Pick<
  Route<ReqBody, ReadonlyDeep<JsonValue> | undefined>,
  'name' | 'bodySchema' | 'middleware'
>;

function makeRoute<
  ReqBody extends JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined,
>(
  method: Route<ReqBody, ResBody>['method'],
  path: Route<ReqBody, ResBody>['path'],
  ...rest:
    | [RouteOpts<ReqBody>, Route<ReqBody, ResBody>['handler']]
    | [Route<ReqBody, ResBody>['handler']]
) {
  return {
    method,
    path,
    ...(typeof rest[0] === 'function'
      ? { handler: rest[0] }
      : { ...rest[0], handler: rest[1] }),
  };
}

type MakeRouteBoundArgs<
  ReqBody extends JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined,
> =
  | [
      path: Route<ReqBody, ResBody>['path'],
      opts: RouteOpts<ReqBody>,
      handler: Route<ReqBody, ResBody>['handler'],
    ]
  | [
      path: Route<ReqBody, ResBody>['path'],
      handler: Route<ReqBody, ResBody>['handler'],
    ];

// Route objects (rather than calling `router.post()` directly) keep each
// controller's routes as data, registered in one place by `start/routes.ts`.
export const route = {
  // @ts-ignore Silence error w/ hitting TS max recursion limit before the type param is actually bound.
  get<ResBody extends ReadonlyDeep<JsonValue> | undefined>(
    ...args: MakeRouteBoundArgs<never, ResBody>
  ) {
    // any cast is to work around https://github.com/microsoft/TypeScript/issues/42508
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (makeRoute as any)('get', ...args) as Route<never, ResBody>;
  },
  post<
    ReqBody extends JsonObject,
    ResBody extends ReadonlyDeep<JsonValue> | undefined,
  >(...args: MakeRouteBoundArgs<ReqBody, ResBody>) {
    // any cast is to work around https://github.com/microsoft/TypeScript/issues/42508
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (makeRoute as any)('post', ...args) as Route<ReqBody, ResBody>;
  },
  patch<
    ReqBody extends JsonObject,
    ResBody extends ReadonlyDeep<JsonValue> | undefined,
  >(...args: MakeRouteBoundArgs<ReqBody, ResBody>) {
    // any cast is to work around https://github.com/microsoft/TypeScript/issues/42508
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (makeRoute as any)('patch', ...args) as Route<ReqBody, ResBody>;
  },
  del<ResBody extends ReadonlyDeep<JsonValue> | undefined>(
    ...args: MakeRouteBoundArgs<never, ResBody>
  ) {
    // any cast is to work around https://github.com/microsoft/TypeScript/issues/42508
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (makeRoute as any)('delete', ...args) as Route<never, ResBody>;
  },
};
