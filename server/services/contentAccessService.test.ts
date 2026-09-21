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
    const record = jest.fn(
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
    const record = jest.fn(async () => {});
    await expect(
      new ContentAccessService({
        authorize: async () => false,
        record,
      }).beforeAccess(request),
    ).rejects.toEqual(new ContentAccessError('denied'));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied' }),
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
    const authorize = (async () => 'allow') as unknown as (
      input: ContentAccessRequest,
    ) => Promise<boolean>;
    await expect(
      new ContentAccessService({ authorize }).beforeAccess(request),
    ).rejects.toEqual(new ContentAccessError('denied'));
  });

  it('does not emit an authorized audit after a policy exception', async () => {
    const record = jest.fn(async () => {});
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
      authorize: jest.fn(async () => false),
      record: jest.fn(async () => {}),
    };
    const unregister = registerContentAccessExtension(extension);
    try {
      expect(getRegisteredContentAccessExtension()).toBe(extension);
      await expect(
        makeContentAccessService().beforeAccess(request),
      ).rejects.toEqual(new ContentAccessError('denied'));
      expect(extension.authorize).toHaveBeenCalledWith(request);
      expect(extension.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'denied' }),
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
