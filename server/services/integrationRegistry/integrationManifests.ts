/**
 * Backend manifest entries for built-in integrations.
 * The dynamic integration registry merges these with loaded plugins.
 * Lives in the registry (not graphql) so transport-agnostic code can import it.
 */

const REQUIRED_SECTION_IDS = ['modelDetails', 'technicalIntegration'] as const;

export type ModelCardField = Readonly<{ label: string; value: string }>;
export type ModelCardSubsection = Readonly<{
  title: string;
  fields: readonly ModelCardField[];
}>;
export type ModelCardSection = Readonly<{
  id: string;
  title: string;
  subsections?: readonly ModelCardSubsection[];
  fields?: readonly ModelCardField[];
}>;
export type ModelCard = Readonly<{
  modelName: string;
  version: string;
  releaseDate?: string;
  sections?: readonly ModelCardSection[];
}>;

export type IntegrationManifestEntry = Readonly<{
  modelCard: ModelCard;
  modelCardLearnMoreUrl?: string;
  /** Display name for the integration (e.g. "Google Content Safety API"). */
  title: string;
  /** Link to documentation or product page. */
  docsUrl: string;
  /** Whether the integration requires the user to supply config (e.g. API key or other settings). */
  requiresConfig: boolean;
  /** Optional URL to a logo image. When absent, client may use a fallback. */
  logoUrl?: string;
  /** Optional URL to a logo variant (e.g. with background). */
  logoWithBackgroundUrl?: string;
}>;

function assertModelCardHasRequiredSections(card: ModelCard): void {
  const sectionIds = new Set((card.sections ?? []).map((s) => s.id));
  for (const requiredId of REQUIRED_SECTION_IDS) {
    if (!sectionIds.has(requiredId)) {
      throw new Error(
        `Model card must include a section with id "${requiredId}".`,
      );
    }
  }
}

const GOOGLE_CONTENT_SAFETY: IntegrationManifestEntry = {
  modelCard: {
    modelName: 'Content Safety API',
    version: '1.x',
    releaseDate: 'Ongoing',
    sections: [
      {
        id: 'modelDetails',
        title: 'Model Details',
        subsections: [
          {
            title: 'Basic Information',
            fields: [
              { label: 'Model Name', value: 'Content Safety API' },
              { label: 'Developed By', value: 'Google' },
              {
                label: 'Documentation URL',
                value: 'https://protectingchildren.google/tools-for-partners/',
              },
            ],
          },
          {
            title: 'Intended Use',
            fields: [
              {
                label: 'Primary Use Case',
                value:
                  'Child safety prioritization recommendations on user-generated content.',
              },
              {
                label: 'Target Users',
                value: 'Platforms and partners conducting content moderation.',
              },
              {
                label: 'Important Note',
                value:
                  'Users must conduct their own manual review and comply with applicable reporting laws. The API does not replace human judgment.',
              },
            ],
          },
        ],
      },
      {
        id: 'technicalIntegration',
        title: 'Technical Integration',
        fields: [
          {
            label: 'Authentication',
            value: 'API key (apply via Google\'s partner tools).',
          },
          {
            label: 'Integration Points',
            value:
              'Coop sends content to the API and uses the returned prioritization in moderation workflows.',
          },
        ],
      },
    ],
  },
  modelCardLearnMoreUrl: 'https://modelcards.withgoogle.com/',
  title: 'Google Content Safety API',
  docsUrl: 'https://protectingchildren.google/tools-for-partners/',
  requiresConfig: true,
};

const OPENAI: IntegrationManifestEntry = {
  modelCard: {
    modelName: 'OpenAI',
    version: 'v0.0',
    releaseDate: 'January 2026',
    sections: [
      {
        id: 'modelDetails',
        title: 'Model Details',
        subsections: [
          {
            title: 'Basic Information',
            fields: [
              { label: 'Model Name', value: 'OpenAI' },
              { label: 'Version', value: 'v0.0' },
              { label: 'Release Date', value: 'January 2026' },
              { label: 'License Type', value: 'API Access Only' },
              {
                label: 'Documentation URL',
                value: 'https://platform.openai.com/docs',
              },
            ],
          },
          {
            title: 'Model Architecture',
            fields: [
              { label: 'Base Architecture', value: 'Transformer-based' },
              {
                label: 'Input/output specifications',
                value:
                  'API-dependent; see OpenAI documentation for the specific model in use.',
              },
            ],
          },
          {
            title: 'Intended Use',
            fields: [
              {
                label: 'Primary Use Case',
                value:
                  'Content moderation and safety-related classification via OpenAI APIs.',
              },
              {
                label: 'Target Users',
                value: 'Platforms using Coop for moderation.',
              },
              {
                label: 'Deployment Context',
                value: 'Used within Coop to call OpenAI APIs with your API key.',
              },
            ],
          },
        ],
      },
      {
        id: 'technicalIntegration',
        title: 'Technical Integration',
        fields: [
          {
            label: 'Credentials',
            value: 'This integration requires one API Key.',
          },
          {
            label: 'Documentation',
            value: 'https://platform.openai.com/docs',
          },
        ],
      },
    ],
  },
  modelCardLearnMoreUrl: 'https://modelcards.withgoogle.com/',
  title: 'OpenAI',
  docsUrl: 'https://platform.openai.com/docs',
  requiresConfig: true,
};

const ZENTROPI: IntegrationManifestEntry = {
  modelCard: {
    modelName: 'Zentropi',
    version: '1.x',
    releaseDate: 'Ongoing',
    sections: [
      {
        id: 'modelDetails',
        title: 'Model Details',
        subsections: [
          {
            title: 'Basic Information',
            fields: [
              { label: 'Model Name', value: 'Zentropi' },
              { label: 'Developed By', value: 'Zentropi' },
              {
                label: 'Documentation URL',
                value: 'https://docs.zentropi.ai',
              },
            ],
          },
          {
            title: 'Intended Use',
            fields: [
              {
                label: 'Primary Use Case',
                value:
                  'Content labeling and moderation via configurable labeler versions.',
              },
              {
                label: 'Target Users',
                value: 'Platforms using Coop with Zentropi labelers.',
              },
              {
                label: 'Integration Points',
                value:
                  'API key plus optional labeler versions (id and label) for each model you use.',
              },
            ],
          },
        ],
      },
      {
        id: 'technicalIntegration',
        title: 'Technical Integration',
        fields: [
          {
            label: 'Credentials',
            value:
              'API Key plus optional Labeler Versions (id and label per version).',
          },
          { label: 'Documentation', value: 'https://docs.zentropi.ai' },
        ],
      },
    ],
  },
  modelCardLearnMoreUrl: 'https://modelcards.withgoogle.com/',
  title: 'Zentropi',
  docsUrl: 'https://docs.zentropi.ai',
  requiresConfig: true,
};

/** Built-in integration manifests (id -> entry). Merged with loaded plugins by the integration registry. */
export const BUILD_IN_MANIFESTS: Readonly<
  Record<string, IntegrationManifestEntry>
> = {
  GOOGLE_CONTENT_SAFETY_API: GOOGLE_CONTENT_SAFETY,
  OPEN_AI: OPENAI,
  ZENTROPI,
};

// Validate required sections at load time
for (const entry of Object.values(BUILD_IN_MANIFESTS)) {
  assertModelCardHasRequiredSections(entry.modelCard);
}

export type AvailableIntegration = Readonly<{
  name: string;
  title: string;
  docsUrl: string;
  requiresConfig: boolean;
  logoUrl?: string;
  logoWithBackgroundUrl?: string;
}>;
