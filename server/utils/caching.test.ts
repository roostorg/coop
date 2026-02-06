import { cached } from './caching.js';
import { jsonParse, jsonStringify } from './encoding.js';

describe('cached', () => {
  it('should transparently stringify + parse cache key', async () => {
    const producer = async (orgId: string) => orgId;
    const cachedProducer = cached({ producer, directives: { freshUntilAge: 1 } });
    const res = await cachedProducer('test');
    expect(res).toBe('test');

    const cachedProducer2 = cached({
      producer: async (opts: { orgId: string }) => opts.orgId,
      directives: { freshUntilAge: 1 },
    });
    const res2 = await cachedProducer2({ orgId: 'test' });
    expect(res2).toBe('test');
  });

  it('should not cache promise rejections, and should propagate them', async () => {
    const producer = jest.fn(async (_it: string) => Promise.reject('anything'));
    const cachedProducer = cached({ producer, directives: { freshUntilAge: 1 } });

    await cachedProducer('').catch(() => {});
    const res = await cachedProducer('').catch((e) => e);

    expect(res).toBe('anything');
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("should only call the producer once during the cache's freshUntilAge", async () => {
    const producer = jest.fn(async (it: string) => it);
    const cachedProducer = cached({ producer, directives: { freshUntilAge: 1 } });

    await cachedProducer('test');
    await cachedProducer('test');
    await cachedProducer('test');

    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('should support custom key generation/parsing logic', async () => {
    const producer = jest.fn(async (it: { x: boolean }) => it);
    const cachedProducer = cached({
      producer,
      directives: { freshUntilAge: 1 },
      // No matter what argument is passed to the cached producer, it should
      // be cached under the key hello, and then the producer should be called
      // with { x: true }.
      keyGeneration: {
        toString: (_it) => 'hello',
        fromString: (_str) => ({ x: true }),
      },
    });

    const res = await cachedProducer({ x: false });

    expect(res).toEqual({ x: true });
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('should require custom key generation logic for non-json-compatible key args', async () => {
    const producer = jest.fn(
      async (it: Map<string, boolean>) =>
        new Map([...it.entries(), ['extra', true]]),
    );

    // We expect a type error here because the producer's arg isn't
    // JSON-compatible, and we haven't provided keyGeneration options.
    // @ts-expect-error
    const _cachedProducer = cached({
      producer,
      directives: { freshUntilAge: 1 },
    });

    const cachedProducer2 = cached({
      producer,
      directives: { freshUntilAge: 1 },
      keyGeneration: {
        toString: (it) => jsonStringify(Array.from(it.entries())),
        fromString: (str) => new Map(jsonParse(str)),
      },
    });

    const res = await cachedProducer2(new Map([['hello', false]]));
    expect(res).toEqual(
      new Map([
        ['hello', false],
        ['extra', true],
      ]),
    );
  });
});
