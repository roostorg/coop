/**
 * Client-side integration list for contexts that do not yet use the API
 * (e.g. rule form signal modals). Prefer backend-driven data (availableIntegrations,
 * integrationConfig) for the integrations dashboard and detail page.
 */
import type { GQLIntegration } from '../../../graphql/generated';
import GoogleLogo from '../../../images/GoogleLogo.png';
import GoogleLogoWithBackground from '../../../images/GoogleLogoWithBackground.png';
import OpenAILogo from '../../../images/OpenAILogo.png';
import OpenAILogoWithBackground from '../../../images/OpenAILogoWithBackground.png';
import ZentropiLogo from '../../../images/ZentropiLogo.png';

export type IntegrationConfig = {
  name: GQLIntegration;
  title: string;
  logo: string;
  logoWithBackground: string;
  url: string;
  requiresInfo: boolean;
};

export const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    name: 'GOOGLE_CONTENT_SAFETY_API' as GQLIntegration,
    title: 'Google Content Safety API',
    logo: GoogleLogo,
    logoWithBackground: GoogleLogoWithBackground,
    url: 'https://protectingchildren.google/tools-for-partners/',
    requiresInfo: true,
  },
  {
    name: 'OPEN_AI' as GQLIntegration,
    title: 'OpenAI',
    logo: OpenAILogo,
    logoWithBackground: OpenAILogoWithBackground,
    url: 'https://openai.com/',
    requiresInfo: true,
  },
  {
    name: 'ZENTROPI' as GQLIntegration,
    title: 'Zentropi',
    logo: ZentropiLogo,
    logoWithBackground: ZentropiLogo,
    url: 'https://docs.zentropi.ai',
    requiresInfo: true,
  },
];
