import semver from 'semver';

import { type Dependencies } from '../iocContainer/index.js';
import { cached } from '../utils/caching.js';

export function makeGetCoopUpdateAvailable({
  fetchHTTP,
}: Pick<Dependencies, 'fetchHTTP'>) {
  const currentVersion = semver.parse(process.env.COOP_VERSION ?? '');
  const enabled = process.env.COOP_UPDATE_NOTIFICATIONS_ENABLED !== 'false';

  return cached({
    async producer(_: null): Promise<boolean> {
      // Only stable, versioned builds participate in release notifications.
      if (!enabled || !currentVersion || currentVersion.prerelease.length > 0) {
        return false;
      }

      try {
        const response = await fetchHTTP({
          url: 'https://api.github.com/repos/roostorg/coop/releases/latest',
          method: 'get',
          handleResponseBody: 'as-json',
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Coop-Update-Notifications',
          },
          timeoutMs: 5_000,
        });
        if (!response.ok) {
          return false;
        }
        const release = response.body;
        if (
          typeof release !== 'object' ||
          release == null ||
          !('tag_name' in release) ||
          !('prerelease' in release) ||
          release.prerelease !== false ||
          !('draft' in release) ||
          release.draft !== false
        ) {
          return false;
        }
        const latestVersion =
          typeof release.tag_name === 'string'
            ? semver.parse(release.tag_name)
            : null;
        return (
          latestVersion !== null &&
          latestVersion.prerelease.length === 0 &&
          semver.gt(latestVersion, currentVersion)
        );
      } catch {
        // Network failures also cache a negative result to avoid repeated checks.
        return false;
      }
    },
    directives: { freshUntilAge: 3_600 },
  });
}
