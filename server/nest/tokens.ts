import 'reflect-metadata';

import { Inject, type Provider } from '@nestjs/common';

import { type Dependencies } from '../iocContainer/index.js';

/**
 * The BottleJS container. Its services are created lazily on first access, so
 * the Nest app gets the container itself and exposes as providers only the
 * services that Nest-managed classes inject (Nest instantiates every provider
 * at startup, which would otherwise connect to every backing store).
 */
export const COOP_DEPS = Symbol('COOP_DEPS');

export const InjectDeps = () => Inject(COOP_DEPS);

/** Injects one BottleJS service by its container name. */
export const InjectDep = (name: keyof Dependencies) => Inject(name);

export function depProvider(name: keyof Dependencies): Provider {
  return {
    provide: name,
    useFactory: (deps: Dependencies) => deps[name],
    inject: [COOP_DEPS],
  };
}
