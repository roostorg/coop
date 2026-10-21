import { afterEach, expect, it, vi } from 'vitest';

import { makeGetCoopUpdateAvailable } from './coopUpdates.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it.each([
  ['1.9.9', 'v1.10.0', true],
  ['1.10.0', '1.9.9', false],
  ['1.1.1', '1.1.1', false],
  ['1.9.9', '2.0.0', true],
  ['2.0.0', '1.99.99', false],
  ['v1.1.1+vendor.1', '1.1.2', true],
  ['1.1.1+vendor.1', 'v1.1.1+build.2', false],
  ['1.1.1', '1.1.2+build..bad', false],
  ['1.1.1', '1.1.2-rc.1', false],
  ['1.1.1', 'invalid', false],
])('compares stable versions: %s → %s', async (current, latest, expected) => {
  vi.stubEnv('COOP_VERSION', current);
  vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', 'true');
  const fetchHTTP = vi.fn().mockResolvedValue({
    ok: true,
    body: {
      tag_name: latest,
      prerelease: false,
      draft: false,
    },
  });
  const check = makeGetCoopUpdateAvailable({ fetchHTTP });
  try {
    expect(await check(null)).toBe(expected);
  } finally {
    await check.close();
  }
});

it.each([
  ['1.1.1', 'false'],
  ['', 'true'],
  ['abc1234', 'true'],
  ['1.2.0-rc.1', 'true'],
  ['1.1.1+build..bad', 'true'],
])(
  'does not contact GitHub for version %s with enabled=%s',
  async (version, enabled) => {
    vi.stubEnv('COOP_VERSION', version);
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', enabled);
    const fetchHTTP = vi.fn();
    const check = makeGetCoopUpdateAvailable({ fetchHTTP });
    try {
      expect(await check(null)).toBe(false);
      expect(fetchHTTP).not.toHaveBeenCalled();
    } finally {
      await check.close();
    }
  },
);

it.each([
  { tag_name: '1.2.0', prerelease: true, draft: false },
  { tag_name: '1.2.0', prerelease: false, draft: true },
  { message: 'Not Found' },
  null,
])(
  'ignores unpublished releases and invalid responses: %j',
  async (release) => {
    vi.stubEnv('COOP_VERSION', '1.1.1');
    const fetchHTTP = vi.fn().mockResolvedValue({ ok: true, body: release });
    const check = makeGetCoopUpdateAvailable({ fetchHTTP });
    try {
      expect(await check(null)).toBe(false);
    } finally {
      await check.close();
    }
  },
);

it.each(['success', 'http error', 'network error', 'invalid json'])(
  'caches %s for one hour and retries after expiry',
  async (outcome) => {
    vi.useFakeTimers();
    vi.stubEnv('COOP_VERSION', '1.1.1');
    const fetchHTTP = vi.fn();
    if (outcome === 'network error' || outcome === 'invalid json') {
      fetchHTTP.mockRejectedValue(new Error(outcome));
    } else {
      fetchHTTP.mockResolvedValue({
        ok: outcome !== 'http error',
        body: {
          tag_name: '1.2.0',
          prerelease: false,
          draft: false,
        },
      });
    }
    const check = makeGetCoopUpdateAvailable({ fetchHTTP });
    try {
      expect(await check(null)).toBe(outcome === 'success');
      await vi.advanceTimersByTimeAsync(3_599_000);
      expect(await check(null)).toBe(outcome === 'success');
      expect(fetchHTTP).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2_000);
      await check(null);
      expect(fetchHTTP).toHaveBeenCalledTimes(2);
    } finally {
      await check.close();
    }
  },
);
