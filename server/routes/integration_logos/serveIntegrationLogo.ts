import { type Dependencies } from '../../iocContainer/index.js';
import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';

/**
 * GET /integration-logos/:integrationId — serves the plugin logo file when
 * the integration manifest sets logoPath. Returns 404 if the integration
 * has no logo or logoPath was not set.
 */
export default function serveIntegrationLogo(
  _deps: Dependencies,
): RequestHandlerWithBodies<Record<string, never>, undefined> {
  return (req, res, next) => {
    const integrationId = req.params['integrationId'];
    if (!integrationId || integrationId.length === 0) {
      return next(
        makeNotFoundError('Missing integration id.', { shouldErrorSpan: true }),
      );
    }
    const filePath =
      getIntegrationRegistry().getPluginLogoFilePath(integrationId);
    if (filePath === undefined) {
      return next(
        makeNotFoundError('Integration logo not found.', {
          shouldErrorSpan: true,
        }),
      );
    }
    // Path was validated at plugin load (under package root); safe to send.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath, (err) => {
      if (err != null && !res.headersSent) {
         
        next(err);
      }
    });
  };
}
