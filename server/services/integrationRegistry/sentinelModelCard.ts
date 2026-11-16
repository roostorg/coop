import { type ModelCard } from '@roostorg/coop-types';

/** Model card for the Sentinel integration (adopter-supplied banks, no shipped model). */
export const SENTINEL_MODEL_CARD: ModelCard = {
  modelName: 'Sentinel',
  version: 'BYO model/banks',
  releaseDate: 'Ongoing',
  sections: [
    {
      id: 'trainingData',
      title: 'Training Data Sources',
      fields: [
        {
          label: 'Data Sources',
          value:
            'Sentinel scores content against sentence-transformer embeddings of example banks that you (the adopter) curate and supply: a "positive" bank of rare/harmful examples and a "negative" bank of common/normal examples. Coop does not ship pretrained banks — result quality depends entirely on the banks you load.',
        },
      ],
    },
    {
      id: 'policyAndTaxonomy',
      title: 'Policy & Taxonomy Definitions',
      fields: [
        {
          label: 'Policies',
          value:
            'No fixed taxonomy. Sentinel is a general-purpose contrastive scorer — the "rare class" it detects is defined entirely by whichever positive/negative example banks are loaded (e.g., grooming language, a specific harassment pattern).',
        },
      ],
    },
    {
      id: 'annotationMethodology',
      title: 'Annotation Methodology',
      fields: [
        {
          label: 'Methodology',
          value:
            'Adopter-defined. Sentinel computes a contrastive score (the log ratio of similarity to nearby positive- vs. negative-bank examples), then aggregates scores across a conversation using skewness to surface outlier high-scoring messages. See the upstream repo for the scoring algorithm.',
        },
      ],
    },
    {
      id: 'performanceBenchmarks',
      title: 'Performance Benchmarks',
      fields: [
        {
          label: 'Benchmarks',
          value:
            'Depends entirely on the banks and sentence-transformer encoder you configure; there are no standardized benchmark numbers for arbitrary bank/model combinations. Evaluate against your own labeled data before enabling this signal in enforcement rules.',
        },
      ],
    },
    {
      id: 'biasAndLimitations',
      title: 'Bias Documentation & Known Limits',
      fields: [
        {
          label: 'Known Limitations',
          value:
            'Quality is bounded by the sentence-transformer encoder and the size/diversity of your example banks; small or unrepresentative banks produce noisy scores. Sentinel scores text only (plus limited thread context) — it does not evaluate images or other media.',
        },
      ],
    },
    {
      id: 'implementationGuidance',
      title: 'Implementation Guidance',
      fields: [
        {
          label: 'Deployment',
          value:
            'Coop talks to a self-hosted Sentinel HTTP service (see https://github.com/UMass-Rescue/sentinel-api, which wraps the upstream Roblox/sentinel library). Configure the URL of the Sentinel deployment this org should use, plus optional scoring/context overrides, below.',
        },
        {
          label: 'Credentials',
          value:
            'No API key required. The API URL is required for the signal to run; leaving the other fields blank uses Sentinel’s own scoring defaults.',
        },
      ],
    },
    {
      id: 'relevantLinks',
      title: 'Relevant Links',
      fields: [
        {
          label: 'Source',
          value: 'https://github.com/Roblox/sentinel',
        },
      ],
    },
  ],
};
