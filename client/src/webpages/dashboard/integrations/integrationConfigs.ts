import { GQLIntegration } from '../../../graphql/generated';
import GoogleLogo from '../../../images/GoogleLogo.png';
import GoogleLogoWithBackground from '../../../images/GoogleLogoWithBackground.png';
import OpenAILogo from '../../../images/OpenAILogo.png';
import OpenAILogoWithBackground from '../../../images/OpenAILogoWithBackground.png';
import ZentropiLogo from '../../../images/ZentropiLogo.png';
import { IntegrationConfig } from './IntegrationsDashboard';

export const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    name: GQLIntegration.GoogleContentSafetyApi,
    title: 'Google Content Safety API',
    logo: GoogleLogo,
    logoWithBackground: GoogleLogoWithBackground,
    url: 'https://protectingchildren.google/tools-for-partners/',
    requiresInfo: true,
  },
  {
    name: GQLIntegration.OpenAi,
    title: 'OpenAI',
    logo: OpenAILogo,
    logoWithBackground: OpenAILogoWithBackground,
    url: 'https://openai.com/',
    requiresInfo: true,
  },
  {
    name: GQLIntegration.Zentropi,
    title: 'Zentropi',
    logo: ZentropiLogo,
    logoWithBackground: ZentropiLogo,
    url: 'https://docs.zentropi.ai',
    requiresInfo: true,
  },
];
