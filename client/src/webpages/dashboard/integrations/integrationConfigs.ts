import { GQLIntegration } from '../../../graphql/generated';
import OpenAILogo from '../../../images/OpenAILogo.png';
import OpenAILogoWithBackground from '../../../images/OpenAILogoWithBackground.png';
import { IntegrationConfig } from './IntegrationsDashboard';

export const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    name: GQLIntegration.OpenAi,
    title: 'OpenAI',
    logo: OpenAILogo,
    logoWithBackground: OpenAILogoWithBackground,
    url: 'https://openai.com/',
    requiresInfo: true,
  },
];
