import { type Dependencies } from '../../../iocContainer/index.js';
import { cached } from '../../../utils/caching.js';
import { type ConfigurableIntegration } from '../../signalAuthService/signalAuthService.js';

export type CredentialGetters = ReturnType<typeof makeCachedCredentialGetters>;

/**
 * Returns a set of functions that can be used for looking up an org's stored
 * API keys for a given third-party service, which is needed when running
 * signals that connect to that service.
 */
export function makeCachedCredentialGetters(
  signalAuthService: Dependencies['SignalAuthService'],
) {
  const getApiCredentialForIntegration = <T extends ConfigurableIntegration>(
    integration: T,
  ) =>
    cached({
      producer: async (orgId: string) =>
        signalAuthService.get(integration, orgId),
      directives: { freshUntilAge: 600 },
    });

  return {
    GOOGLE_CONTENT_SAFETY_API: getApiCredentialForIntegration(
      'GOOGLE_CONTENT_SAFETY_API',
    ),
    OPEN_AI: getApiCredentialForIntegration('OPEN_AI'),
    ZENTROPI: getApiCredentialForIntegration('ZENTROPI'),
  };
}
