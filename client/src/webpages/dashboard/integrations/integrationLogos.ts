/**
 * Fallback logo assets when the backend does not provide logoUrl.
 * Integrations are backend-driven; logos can come from API (logoUrl) or this map.
 * Keys are integration names (built-in enum or plugin id string).
 */
import GoogleLogo from '../../../images/GoogleLogo.png';
import GoogleLogoWithBackground from '../../../images/GoogleLogoWithBackground.png';
import OpenAILogo from '../../../images/OpenAILogo.png';
import OpenAILogoWithBackground from '../../../images/OpenAILogoWithBackground.png';
import ZentropiLogo from '../../../images/ZentropiLogo.png';

export const INTEGRATION_LOGO_FALLBACKS: Partial<
  Record<string, { logo: string; logoWithBackground: string }>
> = {
  GOOGLE_CONTENT_SAFETY_API: {
    logo: GoogleLogo,
    logoWithBackground: GoogleLogoWithBackground,
  },
  OPEN_AI: {
    logo: OpenAILogo,
    logoWithBackground: OpenAILogoWithBackground,
  },
  ZENTROPI: {
    logo: ZentropiLogo,
    logoWithBackground: ZentropiLogo,
  },
};
