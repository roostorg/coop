import Scylla from './scylla.js';
import { type DBDefinition, type CqlSelectOptions } from './cqlUtils.js';

/**
 * Parses the `ITEM_INVESTIGATION_AND_STRIKES_ENABLED` feature flag from its raw
 * string value (i.e. `process.env.ITEM_INVESTIGATION_AND_STRIKES_ENABLED`).
 *
 * Shared by the `Scylla` DI factory in `iocContainer` (to decide whether to
 * return a real Scylla or a {@link NoOpScylla}) and by the unit tests. Defaults
 * to enabled when unset/empty so existing deployments are unaffected; only the
 * explicit falsey values `false`/`0`/`no` (case/whitespace-insensitive) disable
 * the Scylla-backed features.
 *
 * Kept as a pure function of its argument (it does not read `process.env`
 * itself) so callers own where the value comes from and tests stay independent
 * of the ambient environment.
 */
export function itemInvestigationAndStrikesEnabled(
  raw: string | undefined,
): boolean {
  return !['false', '0', 'no'].includes((raw ?? 'true').trim().toLowerCase());
}

/**
 * A no-op implementation of {@link Scylla} used when the Scylla-backed features
 * (item investigation and user strikes) are disabled via
 * `ITEM_INVESTIGATION_AND_STRIKES_ENABLED=false`.
 *
 * Scylla has no managed offering on some deployment platforms, and some
 * operators do not need the features that depend on it. Rather than gate the
 * ~100+ call sites that touch Scylla, we gate at the single dependency-injection
 * chokepoint (the `Scylla` factory in `iocContainer`) and return this no-op.
 *
 * Behaviour when disabled:
 *  - `connect()` / `close()` resolve immediately (so the item-processing worker's
 *    eager `await scylla.connect()` succeeds without a real cluster).
 *  - `insert()` resolves and drops the write.
 *  - `select()` returns an empty result set.
 *  - `selectStream()` yields nothing.
 *
 * This keeps every consumer compiling and running unchanged; they simply observe
 * empty data (e.g. user strike counts read as 0) and their writes are discarded.
 */
export default class NoOpScylla<
  DB extends DBDefinition,
> extends Scylla<DB> {
  constructor() {
    // The base class only stores the client and never touches it once all
    // query methods are overridden below, so a null client cast is safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(null as any);
  }

  /** No cluster to connect to; resolve so eager callers proceed. */
  async connect(): Promise<void> {
    return undefined;
  }

  /** Nothing to shut down. */
  async close(): Promise<void> {
    return undefined;
  }

  /** Drop the write. */
  override async insert<RelationName extends keyof DB>(
    _opts: {
      [K in RelationName]: {
        into: RelationName;
        row: DB[K];
        ttlInSeconds?: number;
      };
    }[RelationName],
  ): Promise<Awaited<ReturnType<Scylla<DB>['insert']>>> {
    // There is no cluster to write to; return a minimal empty result set. The
    // real driver returns a full `ResultSet`, but no-op consumers never read
    // the result, so a minimal shape is sufficient here.
    // @ts-expect-error - minimal stand-in for the driver's ResultSet; unused by callers
    return { rows: [], rowLength: 0 };
  }

  /** Return no rows. */
  override async select<
    RelationName extends keyof DB & string,
    Cols extends keyof DB[RelationName] & string = keyof DB[RelationName] &
      string,
  >(
    _opts: CqlSelectOptions<DB, RelationName, Cols>,
  ): Promise<{ [K in Cols]: DB[RelationName][K] }[]> {
    return [];
  }

  /** Yield nothing. */
  override selectStream<
    RelationName extends keyof DB & string,
    Cols extends keyof DB[RelationName] & string = keyof DB[RelationName] &
      string,
  >(
    _opts: CqlSelectOptions<DB, RelationName, Cols>,
  ): AsyncIterableIterator<{ [K in Cols]: DB[RelationName][K] }> {
    type Selection = { [K in Cols]: DB[RelationName][K] };
    async function* empty(): AsyncIterableIterator<Selection> {
      // Intentionally yields nothing.
    }
    return empty();
  }
}