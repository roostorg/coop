import { type RequestHandler } from 'express';
import { type ParamsDictionary, type Query } from 'express-serve-static-core';
import { type JsonObject, type JsonValue, type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../iocContainer/index.js';
import { type JSONSchemaV4 } from './json-schema-types.js';

export type RequestHandlerWithBodies<
  ReqBody extends JsonObject,
  // @ts-ignore Silence error w/ hitting TS max recursion limit before the type param is actually bound.
  ResBody extends ReadonlyDeep<JsonValue> | undefined, // undefined is used to indicate a 204 response
> = RequestHandler<
  ParamsDictionary,
  ResBody,
  ReqBody,
  Query,
  Record<string, unknown>
>;

export type Route<
  ReqBody extends JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined,
> = {
  path: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  handler: (
    deps: Dependencies,
  ) =>
    | RequestHandlerWithBodies<ReqBody, ResBody>
    | RequestHandlerWithBodies<ReqBody, ResBody>[];
  name?: string;
  bodySchema?: JSONSchemaV4<ReqBody>;
};

type RouteOpts<ReqBody extends JsonObject> = Pick<
  Route<ReqBody, ReadonlyDeep<JsonValue> | undefined>,
  'name' | 'bodySchema'
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

// Some helpers function for making route objects, to bring back the ergonomics
// of app.get('/', ...handlers) while still getting the benefits of returned
// route objects (whereas app[method]() just triggers the side effect of
// registering a route with the internal express router).
// We don't use partial application here to help TS.
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
