import NoOpScylla from './noOpScylla.js';
import Scylla from './scylla.js';

/**
 * Tests for the Scylla-disabled path used when `SCYLLA_ENABLED=false`: the
 * behavioural contract of {@link NoOpScylla} (drops writes, empty reads,
 * connect/close resolve).
 *
 * The flag itself is now parsed by the env schema (`Env.schema.boolean`), so
 * there is no bespoke predicate left to test here.
 */

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
