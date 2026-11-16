import { vi } from 'vitest';

import { IntegrationContextSettingsService } from './service.js';

const signal = {
  integration: 'UNREGISTERED_TEST_INTEGRATION',
  contextNeeds: { includeThread: true },
};

function makeService(getByIntegrationId: ReturnType<typeof vi.fn>) {
  return new IntegrationContextSettingsService({
    getByIntegrationId,
  } as never);
}

describe('IntegrationContextSettingsService', () => {
  it('returns the signal needs once the org has configured the integration', async () => {
    const service = makeService(vi.fn(async () => ({ apiKey: 'test-key' })));

    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-a', signal }),
    ).resolves.toEqual({ includeThread: true });
  });

  it('caches whether each org has configured the integration', async () => {
    const getByIntegrationId = vi.fn(async (_id: string, orgId: string) =>
      orgId === 'org-a' ? { apiKey: 'test-key' } : undefined,
    );
    const service = makeService(getByIntegrationId);

    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-a', signal }),
    ).resolves.toEqual({ includeThread: true });
    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-b', signal }),
    ).resolves.toBeUndefined();
    await service.getEffectiveContextNeeds({ orgId: 'org-a', signal });

    expect(getByIntegrationId).toHaveBeenCalledTimes(2);
  });

  it('reloads after invalidation', async () => {
    const getByIntegrationId = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ apiKey: 'test-key' });
    const service = makeService(getByIntegrationId);

    await service.getEffectiveContextNeeds({ orgId: 'org-a', signal });
    service.invalidate('org-a', signal.integration);

    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-a', signal }),
    ).resolves.toEqual({ includeThread: true });
  });

  it('does not cache a failed read', async () => {
    const getByIntegrationId = vi
      .fn()
      .mockRejectedValueOnce(new Error('postgres unavailable'))
      .mockResolvedValueOnce({ apiKey: 'test-key' });
    const service = makeService(getByIntegrationId);

    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-a', signal }),
    ).rejects.toThrow('postgres unavailable');
    await expect(
      service.getEffectiveContextNeeds({ orgId: 'org-a', signal }),
    ).resolves.toEqual({ includeThread: true });
  });

  it('skips the lookup for signals without context needs', async () => {
    const getByIntegrationId = vi.fn();
    const service = makeService(getByIntegrationId);

    await expect(
      service.getEffectiveContextNeeds({
        orgId: 'org-a',
        signal: { integration: 'OPEN_AI' },
      }),
    ).resolves.toBeUndefined();
    expect(getByIntegrationId).not.toHaveBeenCalled();
  });
});
