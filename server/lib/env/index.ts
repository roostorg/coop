import { Env as BaseEnv } from '@adonisjs/env';

import { hostList, integer } from './validators.js';

/**
 * `@adonisjs/env`'s `Env` with our own validators folded into `schema`, so a
 * schema literal reads uniformly as `Env.schema.*` regardless of whether a
 * given validator ships with Adonis.
 *
 * Subclassing is what makes that possible. `Env.schema` is declared as a type
 * alias over a const rather than an interface, so it cannot be extended by
 * declaration merging, and assigning onto the imported object would leave the
 * types behind while making validator availability depend on import order.
 * Overriding the inherited static sidesteps both.
 *
 * Note `BaseEnv.create` constructs a `BaseEnv` rather than `new this(...)`, so
 * it returns the base class. That is fine here: the subclass exists for the
 * schema namespace, not for instance behaviour.
 */
export class Env<
  EnvValues extends Record<string, unknown>,
> extends BaseEnv<EnvValues> {
  static override schema = {
    ...BaseEnv.schema,
    integer,
    hostList,
  };
}

export { hostList, integer } from './validators.js';

/**
 * Re-exported so `start/env.ts` imports everything it needs from here, keeping
 * `@adonisjs/env` behind this module.
 */
export { errors } from '@adonisjs/env';

/**
 * Re-exported so `config/*` modules can name secret-typed values without
 * importing from `@adonisjs/env`'s own dependency tree. A `Secret` redacts
 * itself in logs, `JSON.stringify` and string coercion; call `.release()` to
 * read the underlying value.
 */
export type { Secret } from '@poppinss/utils';
