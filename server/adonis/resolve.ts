import { type HttpContext } from '@adonisjs/core/http';
import type { ContainerBindings } from '@adonisjs/core/types';

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
