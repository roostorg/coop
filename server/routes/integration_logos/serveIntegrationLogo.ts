import { type Dependencies } from '../../iocContainer/index.js';
import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type RouteHandler } from '../../utils/route-helpers.js';

/**
 * GET /integration-logos/:integrationId — serves the plugin logo file when
 * the integration manifest sets logoPath. Returns 404 if the integration
 * has no logo or logoPath was not set.
 */
export default function serveIntegrationLogo(
  _deps: Dependencies,
): RouteHandler<Record<string, never>, undefined> {
  return (ctx) => {
    const rawIntegrationId = ctx.params['integrationId'];
    const integrationId =
      typeof rawIntegrationId === 'string' ? rawIntegrationId : undefined;
    if (!integrationId || integrationId.length === 0) {
      throw makeNotFoundError('Missing integration id.', {
        shouldErrorSpan: true,
      });
    }
    const filePath =
      getIntegrationRegistry().getPluginLogoFilePath(integrationId);
    if (filePath === undefined) {
      throw makeNotFoundError('Integration logo not found.', {
        shouldErrorSpan: true,
      });
    }
    // Path was validated at plugin load (under package root); safe to send.
    ctx.response.header('Cache-Control', 'public, max-age=86400');
    // Public plugin asset; opt out of helmet's strict same-origin CORP default
    // so the SPA can load it via <img src> when deployed on a different origin
    // than the API.
    ctx.response.header('Cross-Origin-Resource-Policy', 'cross-origin');
    // Adonis streams the file and sets Content-Type, Content-Length,
    // Last-Modified and ETag. Unlike Express' `res.sendFile`, it doesn't
    // answer Range requests.
    ctx.response.download(filePath, true);
  };
}
