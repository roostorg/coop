/**
 * Integer validators, folded into `Env.schema` by `./index.js`.
 *
 * An Adonis schema entry is just a `(key, value) => T` function, so these sit
 * alongside the built-in `Env.schema.*` validators without any special support.
 *
 * They exist because `Env.schema.number` casts with `Number()` and rejects only
 * `NaN` — it accepts `1.5`, `-5` and `0` quite happily. Pool sizes, timeouts and
 * counts need an integer within range, and a value outside it stops the process
 * starting rather than being substituted with a default.
 */

import { Env as BaseEnv } from '@adonisjs/env';

type Validator<T> = (key: string, value?: string) => T;

/**
 * Matches `@poppinss/validator-lite`'s own `optionalWhen` condition: truthy
 * means the variable is optional.
 *
 * Prefer the function form. A plain boolean is evaluated when the schema object
 * literal is built, which happens before `Env.create` copies `.env` file values
 * into `process.env` — so a condition reading a sibling variable would see it
 * only when it came from the real environment, not from an env file.
 */
type Condition = boolean | ((key: string, value?: string) => boolean);

function isOptional(
  condition: Condition,
  key: string,
  value?: string,
): boolean {
  return typeof condition === 'function' ? condition(key, value) : condition;
}

type IntegerValidator = (() => Validator<number>) & {
  optional: () => Validator<number | undefined>;
};

/** `integer()` plus its range-constrained variants. */
type IntegerValidators = IntegerValidator & {
  positive: IntegerValidator;
  nonNegative: IntegerValidator;
};

/**
 * Schema functions signal failure by throwing a plain `Error`. `EnvValidator`
 * catches each one, collects its `message`, and reports every invalid variable
 * together in a single `E_INVALID_ENV_VARIABLES` whose `help` lists them all.
 *
 * Constructing that error here instead would collapse the detail, since its own
 * `message` is the generic "Validation failed for one or more environment
 * variables" — that, rather than the specifics, is what would be listed.
 *
 * The wording mirrors `@poppinss/validator-lite` so built-in and custom
 * failures read identically in that list.
 */
function invalid(key: string, value: string, expectation: string): never {
  throw new Error(
    `"${key}" env variable must be ${expectation} (Current value: "${value}")`,
  );
}

function castToInteger(
  key: string,
  value: string,
  minimum: number,
  expectation: string,
): number {
  const casted = Number(value);
  if (!Number.isInteger(casted) || casted < minimum) {
    invalid(key, value, expectation);
  }
  return casted;
}

/**
 * An empty string is treated as absent rather than as a value, matching how
 * `@poppinss/validator-lite` handles every other schema type: `FOO=` means
 * unset, so a consumer's default applies instead of `FOO` being read as `0`.
 */
function makeIntegerValidator(
  minimum: number,
  expectation: string,
): IntegerValidator {
  const required = (): Validator<number> => (key, value) => {
    if (!value) {
      invalid(key, '', expectation);
    }
    return castToInteger(key, value, minimum, expectation);
  };

  const optional = (): Validator<number | undefined> => (key, value) =>
    value ? castToInteger(key, value, minimum, expectation) : undefined;

  return Object.assign(required, { optional });
}

/**
 * `integer()` accepts any integer; the sub-validators constrain the range.
 *
 * - `integer.positive()` — 1 or greater. Ports, pool sizes, limits.
 * - `integer.nonNegative()` — 0 or greater, where zero is meaningful: a
 *   disabled timeout, no retries.
 *
 * Each also has an `.optional()` form, so a variable the application supplies a
 * default for reads as `Env.schema.integer.positive.optional()`.
 */
export const integer: IntegerValidators = Object.assign(
  makeIntegerValidator(Number.NEGATIVE_INFINITY, 'an integer'),
  {
    positive: makeIntegerValidator(1, 'an integer greater than zero'),
    nonNegative: makeIntegerValidator(0, 'an integer of zero or greater'),
  },
);

type HostListValidator = (() => Validator<readonly string[]>) & {
  optional: () => Validator<readonly string[] | undefined>;
  optionalWhen: (
    condition: Condition,
  ) => Validator<readonly string[] | undefined>;
};

const HOST_LIST_EXPECTATION =
  'a comma-separated list of hosts, each optionally suffixed with ":port"';

/** Reuses Adonis' own host check rather than reimplementing FQDN/IP matching. */
const validateHost = BaseEnv.schema.string({ format: 'host' });

function parseHostList(key: string, value: string): readonly string[] {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    invalid(key, value, HOST_LIST_EXPECTATION);
  }

  for (const entry of entries) {
    // Only treat a single colon as a port separator: a bare IPv6 address
    // contains several, and has no port to split off.
    const separators = entry.split(':').length - 1;
    const [host, port] =
      separators === 1 ? entry.split(':') : [entry, undefined];

    validateHost(key, host);

    if (port !== undefined) {
      const casted = Number(port);
      if (!Number.isInteger(casted) || casted < 1 || casted > 65535) {
        invalid(key, entry, 'a host with a port between 1 and 65535');
      }
    }
  }

  return entries;
}

/**
 * A comma-separated list of hosts, such as Scylla's contact points. Entries may
 * carry an explicit `:port`; those that don't fall back to the driver's own
 * port setting.
 *
 * Returning the parsed list means consumers receive `string[]` rather than
 * re-splitting the raw value, and an empty or malformed list is reported
 * alongside every other invalid variable instead of throwing separately after
 * validation has already finished.
 */
export const hostList: HostListValidator = Object.assign(
  (): Validator<readonly string[]> => (key, value) => {
    if (!value) {
      invalid(key, '', HOST_LIST_EXPECTATION);
    }
    return parseHostList(key, value);
  },
  {
    optional: (): Validator<readonly string[] | undefined> => (key, value) =>
      value ? parseHostList(key, value) : undefined,

    /**
     * Required unless `condition` says otherwise, mirroring the built-in
     * `Env.schema.string.optionalWhen`. Used for a variable that only matters
     * when the feature it configures is switched on.
     */
    optionalWhen:
      (condition: Condition): Validator<readonly string[] | undefined> =>
      (key, value) =>
        isOptional(condition, key, value)
          ? hostList.optional()(key, value)
          : hostList()(key, value),
  },
);
