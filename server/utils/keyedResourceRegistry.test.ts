import { jsonStringify } from './encoding.js';
import KeyedResourceRegistry from './keyedResourceRegistry.js';

type Key = { orgId: string; queueId: string };

/** Stand-in for a BullMQ Queue/Worker: something with a close() that matters. */
function makeFakeResource() {
  return { close: jest.fn(async () => {}) };
}

function makeRegistry(
  create = jest.fn(async (_key: Key) => makeFakeResource()),
) {
  const registry = new KeyedResourceRegistry({
    create,
    keyToString: (key: Key) => jsonStringify(key),
  });
  return { registry, create };
}

describe('KeyedResourceRegistry', () => {
  it('creates a resource once per key and returns the same instance', async () => {
    const { registry, create } = makeRegistry();
    const key = { orgId: 'org', queueId: 'q1' };

    const first = await registry.get(key);
    const second = await registry.get(key);

    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('collapses concurrent requests for the same key into one creation', async () => {
    // Regression: without storing the in-flight promise, two simultaneous
    // callers each build a Worker against the same queue, so the queue ends up
    // with two consumers.
    const { registry, create } = makeRegistry();
    const key = { orgId: 'org', queueId: 'q1' };

    const [a, b] = await Promise.all([registry.get(key), registry.get(key)]);

    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('never evicts, however many keys are registered', async () => {
    // Regression for the original bug: these resources were held in a cache
    // with a 128-entry LRU whose eviction called close(). The 129th active
    // queue silently shut down the least-recently-used queue's worker, which
    // stopped its stalled-job checker.
    const { registry } = makeRegistry();

    const resources = await Promise.all(
      Array.from({ length: 200 }, async (_, i) =>
        registry.get({ orgId: 'org', queueId: `q${i}` }),
      ),
    );

    expect(registry.size).toBe(200);
    for (const resource of resources) {
      expect(resource.close).not.toHaveBeenCalled();
    }
  });

  it('keeps a resource indefinitely rather than expiring it', async () => {
    // Regression: the previous implementation attached a 600s TTL, so job
    // processing was torn down and rebuilt on a timer for no reason.
    const { registry, create } = makeRegistry();
    const key = { orgId: 'org', queueId: 'q1' };

    jest.useFakeTimers();
    try {
      const first = await registry.get(key);
      jest.advanceTimersByTime(60 * 60 * 1000);
      const second = await registry.get(key);

      expect(second).toBe(first);
      expect(first.close).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('remove() closes the resource and forgets it', async () => {
    const { registry, create } = makeRegistry();
    const key = { orgId: 'org', queueId: 'q1' };

    const resource = await registry.get(key);
    await registry.remove(key);

    expect(resource.close).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);

    // A later request builds a fresh one rather than handing back the closed instance.
    const rebuilt = await registry.get(key);
    expect(rebuilt).not.toBe(resource);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('remove() is a no-op for an unknown key', async () => {
    const { registry } = makeRegistry();
    await expect(
      registry.remove({ orgId: 'org', queueId: 'never-created' }),
    ).resolves.toBeUndefined();
  });

  it('close() closes every live resource', async () => {
    const { registry } = makeRegistry();
    const a = await registry.get({ orgId: 'org', queueId: 'q1' });
    const b = await registry.get({ orgId: 'org', queueId: 'q2' });

    await registry.close();

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);
  });

  it('close() attempts every resource even when one fails, then reports', async () => {
    const bad = {
      close: jest.fn(async () => Promise.reject(new Error('nope'))),
    };
    const good = makeFakeResource();
    const create = jest.fn(async (key: Key) =>
      key.queueId === 'bad' ? bad : good,
    );
    const { registry } = makeRegistry(create);

    await registry.get({ orgId: 'org', queueId: 'bad' });
    await registry.get({ orgId: 'org', queueId: 'good' });

    await expect(registry.close()).rejects.toThrow(AggregateError);
    expect(good.close).toHaveBeenCalledTimes(1);
  });

  it('get() rejects after close()', async () => {
    const { registry } = makeRegistry();
    await registry.close();

    await expect(registry.get({ orgId: 'org', queueId: 'q1' })).rejects.toThrow(
      'used after close()',
    );
  });

  it('does not cache a failed creation', async () => {
    let attempt = 0;
    const resource = makeFakeResource();
    const create = jest.fn(async (_key: Key) => {
      attempt += 1;
      if (attempt === 1) throw new Error('transient');
      return resource;
    });
    const { registry } = makeRegistry(create);
    const key = { orgId: 'org', queueId: 'q1' };

    await expect(registry.get(key)).rejects.toThrow('transient');
    await expect(registry.get(key)).resolves.toBe(resource);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
