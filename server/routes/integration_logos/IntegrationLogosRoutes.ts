import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import serveIntegrationLogo from './serveIntegrationLogo.js';
import serveIntegrationLogoWithBackground from './serveIntegrationLogoWithBackground.js';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/integration-logos',
  routes: [
    route.get<undefined>('/:integrationId/with-background', serveIntegrationLogoWithBackground),
    route.get<undefined>('/:integrationId', serveIntegrationLogo),
  ],
} as unknown as Controller;
