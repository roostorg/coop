import ContentAccessService, {
  ContentAccessError,
  getRegisteredContentAccessExtension,
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

  it('supports a startup extension and unregisters it', () => {
    const before = getRegisteredContentAccessExtension();
    const extension = { record: jest.fn(async () => {}) };
    const unregister = registerContentAccessExtension(extension);
    expect(getRegisteredContentAccessExtension()).toBe(extension);
    unregister();
    expect(getRegisteredContentAccessExtension()).toBe(before);
  });
});
