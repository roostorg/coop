/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Container } from '@adonisjs/core/container';
import type { ContainerBindings } from '@adonisjs/core/types';

import { type Dependencies } from '../iocContainer/index.js';
import {
  describeInjectedFactory,
  type AnnotatedFactory,
} from '../iocContainer/utils.js';

/**
 * Registers a service natively in the AdonisJS container from the same
 * `inject([...deps], factory)` annotation that `register()` gives Bottle:
 * each dependency is resolved from the AdonisJS container (asynchronously),
 * then the factory or class is called with them.
 *
 * This works mechanically for the ~70 services registered with `register()`.
 * The ~36 `bottle.factory()` closures in `iocContainer/index.ts` read
 * `container.X` synchronously and need rewriting by hand, as does every
 * consumer that reads `deps.X` synchronously.
 */
export function registerNative<T extends keyof Dependencies & string>(
  container: Container<ContainerBindings>,
  name: T,
  factory: AnnotatedFactory<Dependencies[T]>,
) {
  const { deps, isClass } = describeInjectedFactory(factory);
  // `singleton`'s conditional key type doesn't narrow for a generic `T`.
  container.singleton(name as keyof ContainerBindings, async (resolver) => {
    const args = await Promise.all(
      deps.map(async (dep) => resolver.make(dep as keyof ContainerBindings)),
    );
    return isClass ? new (factory as any)(...args) : (factory as any)(...args);
  });
}
