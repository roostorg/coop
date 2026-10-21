import { type Dependencies } from '../iocContainer/index.js';
import { cached } from '../utils/caching.js';

// Only stable, versioned builds participate in release notifications.
function stableVersion(version: unknown) {
  if (typeof version !== 'string') {
    return undefined;
  }
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(
    version.split('+')[0],
  );
  return match?.slice(1, 4).map(Number);
}

export function makeGetCoopUpdateAvailable({
  fetchHTTP,
}: Pick<Dependencies, 'fetchHTTP'>) {
  const currentVersion = stableVersion(process.env.COOP_VERSION);
  const enabled = process.env.COOP_UPDATE_NOTIFICATIONS_ENABLED !== 'false';

  return cached({
    async producer(_: null): Promise<boolean> {
      if (!enabled || !currentVersion) {
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
        const latestVersion = stableVersion(release.tag_name);
        if (!latestVersion) {
          return false;
        }
        const differentPart = latestVersion.findIndex(
          (part, i) => part !== currentVersion[i],
        );
        return (
          differentPart !== -1 &&
          latestVersion[differentPart] > currentVersion[differentPart]
        );
      } catch {
        // Network failures also cache a negative result to avoid repeated checks.
        return false;
      }
    },
    directives: { freshUntilAge: 3_600 },
  });
}
