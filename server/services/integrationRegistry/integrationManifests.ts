/**
 * Backend manifest entries for built-in integrations.
 * The dynamic integration registry merges these with loaded plugins.
 * Lives in the registry (not graphql) so transport-agnostic code can import it.
 */

const REQUIRED_SECTION_IDS = [
  'trainingData',
  'policyAndTaxonomy',
  'annotationMethodology',
  'performanceBenchmarks',
  'biasAndLimitations',
  'implementationGuidance',
  'relevantLinks',
] as const;

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
  const missing = REQUIRED_SECTION_IDS.filter((id) => !sectionIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Model card is missing required section(s): ${missing.map((id) => `"${id}"`).join(', ')}.`,
    );
  }
}

const GOOGLE_CONTENT_SAFETY: IntegrationManifestEntry = {
  modelCard: {
    modelName: 'Content Safety API',
    version: '1.x',
    releaseDate: 'Ongoing',
    sections: [
      {
        id: 'trainingData',
        title: 'Training Data Sources',
        fields: [{ label: 'Data Sources', value: 'TBD' }],
      },
      {
        id: 'policyAndTaxonomy',
        title: 'Policy & Taxonomy Definitions',
        fields: [{ label: 'Policies', value: 'TBD' }],
      },
      {
        id: 'annotationMethodology',
        title: 'Annotation Methodology',
        fields: [{ label: 'Methodology', value: 'TBD' }],
      },
      {
        id: 'performanceBenchmarks',
        title: 'Performance Benchmarks',
        fields: [{ label: 'Benchmarks', value: 'TBD' }],
      },
      {
        id: 'biasAndLimitations',
        title: 'Bias Documentation & Known Limits',
        fields: [{ label: 'Known Limitations', value: 'TBD' }],
      },
      {
        id: 'implementationGuidance',
        title: 'Implementation Guidance',
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
      {
        id: 'relevantLinks',
        title: 'Relevant Links',
        fields: [
          {
            label: 'Documentation',
            value: 'https://protectingchildren.google/tools-for-partners/',
          },
          {
            label: 'Model Cards',
            value: 'https://modelcards.withgoogle.com/',
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
        id: 'trainingData',
        title: 'Training Data Sources',
        fields: [{ label: 'Data Sources', value: 'TBD' }],
      },
      {
        id: 'policyAndTaxonomy',
        title: 'Policy & Taxonomy Definitions',
        fields: [{ label: 'Policies', value: 'TBD' }],
      },
      {
        id: 'annotationMethodology',
        title: 'Annotation Methodology',
        fields: [{ label: 'Methodology', value: 'TBD' }],
      },
      {
        id: 'performanceBenchmarks',
        title: 'Performance Benchmarks',
        fields: [{ label: 'Benchmarks', value: 'TBD' }],
      },
      {
        id: 'biasAndLimitations',
        title: 'Bias Documentation & Known Limits',
        fields: [{ label: 'Known Limitations', value: 'TBD' }],
      },
      {
        id: 'implementationGuidance',
        title: 'Implementation Guidance',
        fields: [
          {
            label: 'Credentials',
            value: 'This integration requires one API Key.',
          },
        ],
      },
      {
        id: 'relevantLinks',
        title: 'Relevant Links',
        fields: [
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
        id: 'trainingData',
        title: 'Training Data Sources',
        fields: [{ label: 'Data Sources', value: 'TBD' }],
      },
      {
        id: 'policyAndTaxonomy',
        title: 'Policy & Taxonomy Definitions',
        fields: [{ label: 'Policies', value: 'TBD' }],
      },
      {
        id: 'annotationMethodology',
        title: 'Annotation Methodology',
        fields: [{ label: 'Methodology', value: 'TBD' }],
      },
      {
        id: 'performanceBenchmarks',
        title: 'Performance Benchmarks',
        fields: [{ label: 'Benchmarks', value: 'TBD' }],
      },
      {
        id: 'biasAndLimitations',
        title: 'Bias Documentation & Known Limits',
        fields: [{ label: 'Known Limitations', value: 'TBD' }],
      },
      {
        id: 'implementationGuidance',
        title: 'Implementation Guidance',
        fields: [
          {
            label: 'Credentials',
            value:
              'API Key plus optional Labeler Versions (id and label per version).',
          },
        ],
      },
      {
        id: 'relevantLinks',
        title: 'Relevant Links',
        fields: [
          {
            label: 'Documentation',
            value: 'https://docs.zentropi.ai',
          },
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
export const BUILT_IN_MANIFESTS: Readonly<
  Record<string, IntegrationManifestEntry>
> = {
  GOOGLE_CONTENT_SAFETY_API: GOOGLE_CONTENT_SAFETY,
  OPEN_AI: OPENAI,
  ZENTROPI,
};

// Validate required sections at load time
for (const entry of Object.values(BUILT_IN_MANIFESTS)) {
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
