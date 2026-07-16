import NoOpScylla, {
  itemInvestigationAndStrikesEnabled,
} from './noOpScylla.js';
import Scylla from './scylla.js';

/**
 * Tests for the Scylla-disabled path used when
 * `ITEM_INVESTIGATION_AND_STRIKES_ENABLED=false`.
 *
 * Two things are covered:
 *  1. The behavioural contract of {@link NoOpScylla} (drops writes, empty reads,
 *     connect/close resolve).
 *  2. The exact flag-parsing predicate (`itemInvestigationAndStrikesEnabled`)
 *     used by the `Scylla` DI factory in `iocContainer` to decide
 *     enabled-vs-disabled. Imported directly (not mirrored) so the
 *     default-enabled (upstream-preserving) behaviour is guarded by a test.
 */

describe('ITEM_INVESTIGATION_AND_STRIKES_ENABLED gate predicate', () => {
  test('defaults to enabled when unset (preserves upstream behaviour)', () => {
    expect(itemInvestigationAndStrikesEnabled(undefined)).toBe(true);
    expect(itemInvestigationAndStrikesEnabled('')).toBe(true);
  });

  test('is disabled only for explicit falsey values', () => {
    for (const v of ['false', 'FALSE', ' false ', '0', 'no', 'No']) {
      expect(itemInvestigationAndStrikesEnabled(v)).toBe(false);
    }
  });

  test('stays enabled for truthy / unrelated values', () => {
    for (const v of ['true', 'TRUE', '1', 'yes', 'anything']) {
      expect(itemInvestigationAndStrikesEnabled(v)).toBe(true);
    }
  });
});

describe('NoOpScylla', () => {
  // A minimal DB shape for the generic parameter.
  type TestDB = { widgets: { id: number; name: string } };
  const noop = new NoOpScylla<TestDB>();

  test('is a Scylla so it satisfies every consumer unchanged', () => {
    expect(noop).toBeInstanceOf(Scylla);
  });

  test('connect() and close() resolve (eager callers proceed)', async () => {
    await expect(noop.connect()).resolves.toBeUndefined();
    await expect(noop.close()).resolves.toBeUndefined();
  });

  test('insert() resolves and drops the write', async () => {
    await expect(
      noop.insert({ into: 'widgets', row: { id: 1, name: 'a' } }),
    ).resolves.toBeDefined();
  });

  test('select() returns an empty result set', async () => {
    await expect(
      noop.select({ from: 'widgets', select: '*' }),
    ).resolves.toEqual([]);
  });

  test('selectStream() yields nothing', async () => {
    const rows = await (async () => {
      const collected = [];
      for await (const row of noop.selectStream({
        from: 'widgets',
        select: '*',
      })) {
        // eslint-disable-next-line functional/immutable-data
        collected.push(row);
      }
      return collected;
    })();
    expect(rows).toEqual([]);
  });
});