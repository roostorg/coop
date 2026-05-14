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
    const rawIntegrationId = req.params['integrationId'];
    const integrationId =
      typeof rawIntegrationId === 'string' ? rawIntegrationId : undefined;
    if (!integrationId || integrationId.length === 0) {
      return next(
        makeNotFoundError('Missing integration id.', { shouldErrorSpan: true }),
      );
    }
    const filePath =
      getIntegrationRegistry().getPluginLogoWithBackgroundFilePath(
        integrationId,
      );
    if (filePath === undefined) {
      return next(
        makeNotFoundError('Integration logo (with-background) not found.', {
          shouldErrorSpan: true,
        }),
      );
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Public plugin asset; opt out of helmet's strict same-origin CORP default
    // so the SPA can load it via <img src> when deployed on a different origin
    // than the API.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(filePath, (err?: Error) => {
      if (err && !res.headersSent) {
         
        next(err);
      }
    });
  };
}
