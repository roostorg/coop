import { type Dependencies } from '../../iocContainer/index.js';
import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';

/**
 * GET /integration-logos/:integrationId/with-background — serves the plugin
 * "with background" logo when the manifest sets logoWithBackgroundPath.
 */
export default function serveIntegrationLogoWithBackground(
  _deps: Dependencies,
): RequestHandlerWithBodies<Record<string, never>, undefined> {
  return (req, res, next) => {
    const integrationId = req.params['integrationId'];
    if (!integrationId || integrationId.length === 0) {
      return next(
        makeNotFoundError('Missing integration id.', { shouldErrorSpan: true }),
      );
    }
    const filePath = getIntegrationRegistry().getPluginLogoWithBackgroundFilePath(integrationId);
    if (filePath === undefined) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- runtime guard for missing plugin logo
      return next(
        makeNotFoundError('Integration logo (with-background) not found.', {
          shouldErrorSpan: true,
        }),
      );
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath, (err) => {
      if (err != null && !res.headersSent) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- sendFile callback err is Error | null per types
        next(err);
      }
    });
  };
}
