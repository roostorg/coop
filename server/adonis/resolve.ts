import { type HttpContext } from '@adonisjs/core/http';
import type { ContainerBindings } from '@adonisjs/core/types';
import { type ApolloServer } from '@apollo/server';

import { type AuthStack } from '../app/middleware/session_bridge_middleware.js';
import { type Context } from '../graphql/resolvers.js';
import { type Dependencies } from '../iocContainer/index.js';

/**
 * Typed `ctx.containerResolver.make(key)`. AdonisJS v6 types the request's
 * resolver as `ContainerResolver<any>`, so string-keyed bindings resolve to
 * `any` without this.
 */
export async function resolve<K extends keyof ContainerBindings>(
  ctx: HttpContext,
  key: K,
): Promise<ContainerBindings[K]> {
  return ctx.containerResolver.make(key);
}

declare module '@adonisjs/core/types' {
  // Every service in Coop's service graph is also an AdonisJS container
  // binding with the same name, so `await container.make('RuleEngine')` is
  // typed. `coop.deps` is the whole graph, for code that still takes a
  // `Dependencies` object.
  interface ContainerBindings extends Dependencies {
    'coop.deps': Dependencies;
    'coop.auth': AuthStack;
    'coop.apollo': ApolloServer<Context>;
  }
}
