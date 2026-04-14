/**
 * Backend manifest entries for built-in integrations.
 * The dynamic integration registry merges these with loaded plugins.
 * Lives in the registry (not graphql) so transport-agnostic code can import it.
 */

import {
  assertModelCardHasRequiredSections,
  type ModelCard,
  type ModelCardField,
  type ModelCardSection,
  type ModelCardSubsection,
} from '@roostorg/types';

export type { ModelCard, ModelCardField, ModelCardSection, ModelCardSubsection };

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
    modelName: 'Zentropi: CoPE-A-9B',
    version: '1.x',
    releaseDate: 'July 20, 2025',
    sections: [
      {
        id: 'trainingData',
        title: 'Training Data Sources',
        fields: [{ label: 'Data Sources', value: "CoPE-A's dataset includes ~60,000 labels across unique policy/content pairs using policy texts created by CoPE team and content from publicly-accessible internet forums. The CoPE team used a mix of automated and manual annotation to create golden labels. The training data includes but is not limited to hate speech, sexual content, self-harm, harassment, toxicity." }],
      },
      {
        id: 'policyAndTaxonomy',
        title: 'Policy & Taxonomy Definitions',
        fields: [{ label: 'Policies', value: "No fixed taxonomy. CoPE-A is policy-adaptive and steerable by users who define custom criteria for their specific use case. Trained for generalizable policy understanding across diverse policy formulations." }],
      },
      {
        id: 'annotationMethodology',
        title: 'Annotation Methodology',
        fields: [{ label: 'Methodology', value: 'CoPE-A was trained using a novel training methodology that moves beyond policy memorization to achieve true policy interpretation. Trained across conflicting policy formulations with focus on generalizable policy understanding and interpretation consistency. Combined automated and manual labeling processes for quality assurance.' }],
      },
      {
        id: 'performanceBenchmarks',
        title: 'Performance Benchmarks',
        fields: [{ label: 'Benchmarks', value: 'Tested on policies and content never seen during training. High accuracy across all content types: Hate Speech 91% accurate (internal test), 84% accurate (public Ethos test); Inappropriate Sexual Content 89%; Toxic Speech 90%; Self-Harm 88%; Harassment 73%. Outperforms comparable models including GPT-4o, Llama-3.1-8B, LlamaGuard3-8B, and ShieldGemma-9B across most categories.' }],
      },
      {
        id: 'biasAndLimitations',
        title: 'Bias Documentation & Known Limits',
        fields: [{ label: 'Known Limitations', value: 'Text processing is limited to 8K tokens. Optimized for US English only; performance degrades for other languages/locales. Binary classification only (label present/absent). Cannot classify content requiring external verification unless explicitly defined in policy. Requires careful policy design to mitigate potential biases. Users should monitor classification patterns across demographic groups and audit decisions regularly.' }],
      },
      {
        id: 'implementationGuidance',
        title: 'Implementation Guidance',
        fields: [
          {
            label: 'Credentials',
            value:
              'API Key plus optional Labeler Versions (id and label per version) created by the user.',
          },
          {
            label: 'Input Format',
            value:
              'Use Zentropi to create and test labeling policies and classifiers. The input format should include: (1) Overview of policy subject, (2) Definition of Terms (precise definitions of words/phrases), (3) Interpretation of Language (guidance on ambiguous language), (4) Definition of Labels with Includes/Excludes criteria. CoPE-A then returns binary classification (0/1) indicating if content matches any policy labels.',
          },
        ],
      },
      {
        id: 'relevantLinks',
        title: 'Relevant Links',
        fields: [
          {
            label: 'HuggingFace Model Card',
            value: 'https://huggingface.co/zentropi-ai/cope-a-9b',
          },
          {
            label: 'Documentation',
            value: 'https://docs.zentropi.ai',
          },
          {
            label: 'Research Talk',
            value: 'https://www.youtube.com/live/JMq49FZ5qmY?si=Q6qpHNeTo-Bc6t9a&t=1',
          },
          {
            label: 'Sample Code Notebook',
            value: 'https://colab.research.google.com/drive/1LBmQ3d0OVrq2EpVP0tc03POalf3sDpjl?usp=sharing',
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
