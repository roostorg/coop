import { createRequire } from 'node:module';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

import { makeGetCoopUpdateAvailable } from '../services/coopUpdates.js';
import { UserPermission } from '../services/userManagementService/index.js';
import resolvers from './resolvers.js';
import typeDefs from './schema.js';

// Use the same GraphQL module instance as @graphql-tools/schema.
const { graphql } = createRequire(import.meta.url)(
  'graphql',
) as typeof import('graphql');

const schema = makeExecutableSchema({ typeDefs, resolvers });
const latestRelease = {
  tag_name: 'v1.10.0',
  prerelease: false,
  draft: false,
};

function makeQuery(
  dependencies: Parameters<typeof makeGetCoopUpdateAvailable>[0],
  viewer: 'admin' | 'moderator' | 'anonymous' = 'admin',
) {
  const getCoopUpdateAvailable = makeGetCoopUpdateAvailable(dependencies);
  onTestFinished(async () => getCoopUpdateAvailable.close());
  return async () =>
    graphql({
      schema,
      source: '{ coopUpdateAvailable }',
      contextValue: {
        getUser: () =>
          viewer === 'anonymous'
            ? null
            : {
                getPermissions: () =>
                  viewer === 'admin'
                    ? [UserPermission.MANAGE_ORG]
                    : [UserPermission.VIEW_MRT],
              },
        services: { getCoopUpdateAvailable },
      },
    });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it.each(['moderator', 'anonymous'] as const)(
  'does not check GitHub for a non-admin viewer: %s',
  async (viewer) => {
    vi.stubEnv('COOP_VERSION', '1.1.1');
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', 'true');
    const fetchHTTP = vi.fn();
    const query = makeQuery({ fetchHTTP }, viewer);
    const result = await query();
    if (viewer === 'anonymous') {
      expect(result.errors?.[0].message).toBe('Authenticated user required');
    } else {
      expect(result.errors).toBeUndefined();
      expect(result.data?.coopUpdateAvailable).toBe(false);
    }
    expect(fetchHTTP).not.toHaveBeenCalled();
  },
);

it.each([
  ['1.9.9', 'v1.10.0', true],
  ['1.1.1', '1.1.1', false],
  ['2.0.0', '1.99.99', false],
])(
  'reports stable updates to admins with the enable flag unset: %s → %s',
  async (current, latest, expected) => {
    vi.stubEnv('COOP_VERSION', current);
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', undefined);
    const fetchHTTP = vi.fn().mockResolvedValue({
      ok: true,
      body: { ...latestRelease, tag_name: latest },
    });
    const query = makeQuery({ fetchHTTP });
    const result = await query();
    expect(result.errors).toBeUndefined();
    expect(result.data?.coopUpdateAvailable).toBe(expected);
  },
);

it.each([
  ['1.1.1', 'false'],
  ['', 'true'],
  ['1.1.2-dev.12+gdeadbeef', 'true'],
])(
  'skips update checks for version %s with enabled=%s',
  async (version, enabled) => {
    vi.stubEnv('COOP_VERSION', version);
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', enabled);
    const fetchHTTP = vi.fn();
    const query = makeQuery({ fetchHTTP });
    expect(await query()).toMatchObject({
      data: { coopUpdateAvailable: false },
    });
    expect(fetchHTTP).not.toHaveBeenCalled();
  },
);

it.each([
  { ...latestRelease, prerelease: true },
  { ...latestRelease, draft: true },
  { ...latestRelease, tag_name: '1.10.0-rc.1' },
  null,
])('ignores unpublished or invalid releases: %j', async (release) => {
  vi.stubEnv('COOP_VERSION', '1.1.1');
  vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', 'true');
  const fetchHTTP = vi.fn().mockResolvedValue({ ok: true, body: release });
  const query = makeQuery({ fetchHTTP });
  expect(await query()).toMatchObject({ data: { coopUpdateAvailable: false } });
});

it.each(['success', 'http error', 'network error'])(
  'caches %s across queries for one hour, then refreshes the result',
  async (outcome) => {
    vi.useFakeTimers();
    vi.stubEnv('COOP_VERSION', '1.1.1');
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', 'true');
    const fetchHTTP = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        ...latestRelease,
        tag_name: outcome === 'success' ? '1.1.1' : latestRelease.tag_name,
      },
    });
    if (outcome === 'network error') {
      fetchHTTP.mockRejectedValueOnce(new Error('unavailable'));
    } else {
      fetchHTTP.mockResolvedValueOnce({
        ok: outcome === 'success',
        body: latestRelease,
      });
    }
    const query = makeQuery({ fetchHTTP });
    const initial = { data: { coopUpdateAvailable: outcome === 'success' } };
    expect(await query()).toMatchObject(initial);
    await vi.advanceTimersByTimeAsync(3_599_000);
    expect(await query()).toMatchObject(initial);
    expect(fetchHTTP).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await query()).toMatchObject({
      data: { coopUpdateAvailable: outcome !== 'success' },
    });
    expect(fetchHTTP).toHaveBeenCalledTimes(2);
  },
);
