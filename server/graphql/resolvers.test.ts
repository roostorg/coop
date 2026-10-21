import { createRequire } from 'node:module';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { afterEach, expect, it, vi } from 'vitest';

import { makeGetCoopUpdateAvailable } from '../services/coopUpdates.js';
import { UserPermission } from '../services/userManagementService/index.js';
import resolvers from './resolvers.js';
import typeDefs from './schema.js';

// Use the same GraphQL module instance as @graphql-tools/schema.
const { graphql } = createRequire(import.meta.url)(
  'graphql',
) as typeof import('graphql');

afterEach(() => {
  vi.unstubAllEnvs();
});

it.each(['admin', 'moderator', 'anonymous'])(
  'reports available updates only to admins: %s',
  async (viewer) => {
    vi.stubEnv('COOP_VERSION', '1.1.1');
    vi.stubEnv('COOP_UPDATE_NOTIFICATIONS_ENABLED', 'true');
    const fetchHTTP = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        tag_name: '1.2.0',
        prerelease: false,
        draft: false,
      },
    });
    const getCoopUpdateAvailable = makeGetCoopUpdateAvailable({ fetchHTTP });
    try {
      const result = await graphql({
        schema: makeExecutableSchema({ typeDefs, resolvers }),
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
      if (viewer === 'anonymous') {
        expect(result.errors?.[0].message).toBe('Authenticated user required');
      } else {
        expect(result.errors).toBeUndefined();
        expect(result.data?.coopUpdateAvailable).toBe(viewer === 'admin');
      }
      expect(fetchHTTP).toHaveBeenCalledTimes(viewer === 'admin' ? 1 : 0);
    } finally {
      await getCoopUpdateAvailable.close();
    }
  },
);
