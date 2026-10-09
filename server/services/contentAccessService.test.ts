import { vi } from 'vitest';

import ContentAccessService, {
  ContentAccessError,
  getRegisteredContentAccessExtension,
  makeContentAccessService,
  registerContentAccessExtension,
  type ContentAccessEvent,
  type ContentAccessRequest,
} from './contentAccessService.js';

const request: ContentAccessRequest = {
  orgId: 'org',
  actorId: 'actor',
  requestId: 'request',
  resourceType: 'review_job',
  resourceId: 'job',
  field: 'payload',
};

describe('content access extension', () => {
  it('preserves access when no extension is configured', async () => {
    await expect(
      new ContentAccessService().beforeAccess(request),
    ).resolves.toBeUndefined();
  });

  it('awaits a metadata-only audit before completing access', async () => {
    let persist: (() => void) | undefined;
    const record = vi.fn(
      async (_event: ContentAccessEvent) =>
        new Promise<void>((resolve) => {
          persist = resolve;
        }),
    );
    const service = new ContentAccessService({ record });
    let completed = false;
    const access = service
      .beforeAccess({ ...request, content: 'secret' } as ContentAccessRequest)
      .then(() => {
        completed = true;
      });
    expect(completed).toBe(false);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toEqual({
      ...request,
      eventId: expect.any(String),
      occurredAt: expect.any(String),
      outcome: 'authorized',
    });
    expect(Object.isFrozen(record.mock.calls[0][0])).toBe(true);
    persist?.();
    await access;
    expect(completed).toBe(true);
  });

  it('records denial and cannot override it through audit success', async () => {
    const record = vi.fn(async () => {});
    await expect(
      new ContentAccessService({
        authorize: async () => false,
        record,
      }).beforeAccess(request),
    ).rejects.toEqual(new ContentAccessError('denied'));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied' }),
      expect.any(AbortSignal),
    );
  });

  it('fails closed and redacts authorization and persistence errors', async () => {
    for (const extension of [
      {
        authorize: async () => {
          throw new Error('signed URL secret');
        },
      },
      {
        record: async () => {
          throw new Error('database credential');
        },
      },
    ]) {
      await expect(
        new ContentAccessService(extension).beforeAccess(request),
      ).rejects.toEqual(new ContentAccessError('unavailable'));
    }
  });

  it('denies truthy values other than true from untyped extensions', async () => {
    const authorize = async (): Promise<boolean> => {
      // @ts-expect-error -- Exercise invalid output from an untyped deployment callback.
      return 'allow';
    };
    await expect(
      new ContentAccessService({ authorize }).beforeAccess(request),
    ).rejects.toEqual(new ContentAccessError('denied'));
  });

  describe('callback deadlines', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])(
      'rejects invalid timeoutMs %s',
      (timeoutMs) => {
        expect(() => new ContentAccessService({ timeoutMs })).toThrow(
          RangeError,
        );
      },
    );

    it.each([
      ['authorize', undefined],
      ['record', undefined],
      ['authorize', 25],
      ['record', 25],
    ] as const)(
      'bounds a never-settling %s callback (timeout=%s)',
      async (stage, timeoutMs) => {
        let signal: AbortSignal | undefined;
        const record = vi.fn(async () => {});
        const service = new ContentAccessService({
          timeoutMs,
          record,
          [stage]: async (
            _metadata: ContentAccessRequest,
            callbackSignal: AbortSignal,
          ) => {
            signal = callbackSignal;
            return new Promise<never>(() => {});
          },
        });
        const rejected = expect(service.beforeAccess(request)).rejects.toEqual(
          new ContentAccessError('unavailable'),
        );
        expect(signal).toBeInstanceOf(AbortSignal);
        vi.advanceTimersByTime((timeoutMs ?? 5_000) - 1);
        expect(signal?.aborted).toBe(false);
        vi.advanceTimersByTime(1);
        await rejected;
        expect(signal?.aborted).toBe(true);
        expect(signal?.reason).toEqual(new ContentAccessError('unavailable'));
        if (stage === 'authorize') expect(record).not.toHaveBeenCalled();
      },
    );

    it.each(['resolve', 'reject'] as const)(
      'fails closed if an abort listener tries to %s authorization',
      async (onAbort) => {
        const record = vi.fn(async () => {});
        const service = new ContentAccessService({
          timeoutMs: 25,
          authorize: async (_, signal) =>
            new Promise<boolean>((resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  if (onAbort === 'resolve') resolve(true);
                  else reject(new Error('private callback error'));
                },
                { once: true },
              );
            }),
          record,
        });
        const rejected = expect(service.beforeAccess(request)).rejects.toEqual(
          new ContentAccessError('unavailable'),
        );
        vi.advanceTimersByTime(25);
        await rejected;
        expect(record).not.toHaveBeenCalled();
      },
    );

    it.each(['authorize', 'record'] as const)(
      'ignores late %s completion after its deadline',
      async (stage) => {
        let complete: (() => void) | undefined;
        const pending = new Promise<void>((resolve) => {
          complete = resolve;
        });
        const record = vi.fn(async () => {});
        const service = new ContentAccessService({
          timeoutMs: 25,
          authorize:
            stage === 'authorize'
              ? async () => {
                  await pending;
                  return true;
                }
              : undefined,
          record: stage === 'record' ? async () => pending : record,
        });
        const access = service.beforeAccess(request);
        const rejected = expect(access).rejects.toEqual(
          new ContentAccessError('unavailable'),
        );
        vi.advanceTimersByTime(25);
        await rejected;
        complete?.();
        await expect(access).rejects.toEqual(
          new ContentAccessError('unavailable'),
        );
        if (stage === 'authorize') expect(record).not.toHaveBeenCalled();
      },
    );

    it('uses separate signals and clears timers after callbacks complete', async () => {
      let signals: AbortSignal[] = [];
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      const service = new ContentAccessService({
        timeoutMs: 25,
        authorize: async (_, signal) => {
          signals = [...signals, signal];
          return true;
        },
        record: async (_, signal) => {
          signals = [...signals, signal];
        },
      });
      await service.beforeAccess(request);
      expect(signals).toHaveLength(2);
      expect(signals[0]).not.toBe(signals[1]);
      expect(clear).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(25);
      expect(signals.every((signal) => !signal.aborted)).toBe(true);
    });

    it('clears timers after a synchronous callback failure', async () => {
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      const service = new ContentAccessService({
        authorize: () => {
          throw new Error('private exception');
        },
      });
      await expect(service.beforeAccess(request)).rejects.toEqual(
        new ContentAccessError('unavailable'),
      );
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });

  it('does not emit an authorized audit after a policy exception', async () => {
    const record = vi.fn(async () => {});
    const service = new ContentAccessService({
      authorize: async () => {
        throw new Error('unavailable');
      },
      record,
    });
    await expect(service.beforeAccess(request)).rejects.toEqual(
      new ContentAccessError('unavailable'),
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('uses registered callbacks through the container factory and restores prior state', async () => {
    const before = getRegisteredContentAccessExtension();
    const extension = {
      authorize: vi.fn(async () => false),
      record: vi.fn(async () => {}),
    };
    const unregister = registerContentAccessExtension(extension);
    try {
      expect(getRegisteredContentAccessExtension()).toBe(extension);
      await expect(
        makeContentAccessService().beforeAccess(request),
      ).rejects.toEqual(new ContentAccessError('denied'));
      expect(extension.authorize).toHaveBeenCalledWith(
        request,
        expect.any(AbortSignal),
      );
      expect(extension.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'denied' }),
        expect.any(AbortSignal),
      );
      await expect(
        makeContentAccessService({}).beforeAccess(request),
      ).resolves.toBeUndefined();
      expect(extension.authorize).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
    expect(getRegisteredContentAccessExtension()).toBe(before);
  });

  it.each([true, false])(
    'preserves class callbacks with private state (allow=%s)',
    async (allowed) => {
      class Extension {
        #allowed = allowed;
        #events: ContentAccessEvent[] = [];
        calls = 0;
        async authorize() {
          this.calls++;
          return this.#allowed;
        }
        async record(event: ContentAccessEvent) {
          this.#events.push(event);
        }
        get events() {
          return this.#events;
        }
      }
      const extension = new Extension();
      const service = new ContentAccessService(extension);
      expect(service.enabled).toBe(true);
      if (allowed)
        await expect(service.beforeAccess(request)).resolves.toBeUndefined();
      else
        await expect(service.beforeAccess(request)).rejects.toEqual(
          new ContentAccessError('denied'),
        );
      expect(extension.calls).toBe(1);
      expect(extension.events).toEqual([
        expect.objectContaining({
          ...request,
          outcome: allowed ? 'authorized' : 'denied',
        }),
      ]);
    },
  );

  it('blocks access when a class-based audit sink fails', async () => {
    class Extension {
      #secret = 'private sink failure';
      async record() {
        throw new Error(this.#secret);
      }
    }
    await expect(
      new ContentAccessService(new Extension()).beforeAccess(request),
    ).rejects.toEqual(new ContentAccessError('unavailable'));
  });

  it.each([
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
    [0, 2, 1],
    [1, 0, 2],
    [2, 0, 1],
  ])(
    'never revives removed registrations (order %s, %s, %s)',
    (...order: number[]) => {
      const before = getRegisteredContentAccessExtension();
      const entries = [{}, {}, {}];
      const cleanup = entries.map(registerContentAccessExtension);
      let active = [0, 1, 2];
      try {
        for (const index of order) {
          cleanup[index]();
          cleanup[index]();
          active = active.filter((entry) => entry !== index);
          const latest = active.at(-1);
          expect(getRegisteredContentAccessExtension()).toBe(
            latest === undefined ? before : entries[latest],
          );
        }
      } finally {
        cleanup.forEach((remove) => {
          remove();
        });
      }
      expect(getRegisteredContentAccessExtension()).toBe(before);
    },
  );

  it('tracks independent registrations of the same extension object', () => {
    const before = getRegisteredContentAccessExtension();
    const extension = {};
    const first = registerContentAccessExtension(extension);
    const second = registerContentAccessExtension(extension);
    try {
      first();
      expect(getRegisteredContentAccessExtension()).toBe(extension);
      second();
      expect(getRegisteredContentAccessExtension()).toBe(before);
    } finally {
      first();
      second();
    }
  });
});
