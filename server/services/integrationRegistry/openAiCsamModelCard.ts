import { type ModelCard } from '@roostorg/coop-types';

/**
 * Model card for the OpenAI CSAM Image Classifier. Content is sourced solely
 * from OpenAI's published model card (dated 2026-11-16).
 */
export const OPENAI_CSAM_CLASSIFIER_MODEL_CARD: ModelCard = {
  modelName: 'OpenAI CSAM Image Classifier',
  version: 'Latest',
  sections: [
    {
      id: 'trainingData',
      title: 'Training Data Sources',
      fields: [
        {
          label: 'Data Sources',
          value:
            'Trained and evaluated on access-controlled, human-labeled image datasets assembled in compliance with U.S. law for the purpose of preventing the sexual exploitation of children. The data included CSAM and non-CSAM content across real images, manipulated real images, and AI-generated images. Approximately 505K positive and 913K negative images were used to train the likely-csam signal, and approximately 1.25M images from the Re-LAION-5B-research open-web dataset were used for false-positive evaluation. OpenAI does not disclose the underlying images or precise dataset composition for privacy and security reasons.',
        },
        {
          label: 'Data Handling',
          value:
            'Sensitive material was stored and processed in controlled environments with restricted access, governed by legal, privacy, security, and reviewer-wellness controls. Images submitted to the classifier API are processed without retention and are not used for training or evaluation.',
        },
      ],
    },
    {
      id: 'policyAndTaxonomy',
      title: 'Policy & Taxonomy Definitions',
      fields: [
        {
          label: 'Definition',
          value:
            'For the purpose of training this classifier, CSAM is defined as visual depictions of sexually explicit conduct involving a child. This encompasses CSAM as defined under U.S. federal law and broader definitions covered in other jurisdictions. It is not a jurisdiction-specific legal classifier.',
        },
        {
          label: 'API Signals',
          value:
            'The API exposes two scores, which are not mutually exclusive and are risk signals rather than factual or legal determinations: likely-csam (suspected CSAM) and likely-csam/gen-ai (suspected AI-generated CSAM). The likely-csam/gen-ai score does not verify an image’s provenance.',
        },
        {
          label: 'Internal Subcategories',
          value:
            'Separate signals for CSAM involving bestiality, sadism, and infants or toddlers remain internal pending further validation of their performance and are not exposed through the API.',
        },
      ],
    },
    {
      id: 'annotationMethodology',
      title: 'Model Architecture & Training',
      fields: [
        {
          label: 'Architecture',
          value:
            'The classifier combines an internal CLIP image encoder with a three-layer multilayer perceptron (MLP). The CLIP encoder converts an image into a summary embedding, and the MLP maps that representation to separate category scores. The MLP was trained on CSAM data and selected encoder layers were fine-tuned for the task. OpenAI selected CLIP+MLP for its balance of generalization to unseen data and computational efficiency.',
        },
        {
          label: 'Deduplication',
          value:
            'Perceptual deduplication techniques such as PDQ were used to reduce overlap of duplicate or near-duplicate images between training and evaluation sets. These techniques do not address all forms of overlap.',
        },
      ],
    },
    {
      id: 'performanceBenchmarks',
      title: 'Performance Benchmarks',
      fields: [
        {
          label: 'Held-out Evaluation',
          value:
            'On the deduplicated held-out evaluation set at default thresholds: likely-csam (threshold 0.996324) achieved F1 0.886, precision 0.991, recall 0.802, AUROC 0.998, and AUPRC 0.989; likely-csam/gen-ai (threshold 0.90) achieved F1 0.927, precision 1.000, recall 0.864, AUROC 0.9998, and AUPRC 0.997.',
        },
        {
          label: 'Open-web Flag Rate',
          value:
            'On approximately 1.25M images from Re-LAION-5B-research (an open-web proxy for negatives), the flag rate was 0.000004 for likely-csam and 0 for likely-csam/gen-ai.',
        },
        {
          label: 'Online Evaluation',
          value:
            'On sampled ChatGPT traffic, precision at the same thresholds was substantially lower (0.298 for likely-csam and 0.340 for likely-csam/gen-ai) because CSAM is rare in production traffic. Performance and suitable operating thresholds vary by platform.',
        },
      ],
    },
    {
      id: 'biasAndLimitations',
      title: 'Bias Documentation & Known Limits',
      fields: [
        {
          label: 'Demographic Performance',
          value:
            'Demographic tags were assigned by an LLM annotator and are unverified and directional. At default thresholds, recall varied across groups: for likely-csam, recall was 61.3% for Black-tagged examples versus 84.5% to 90.3% for other reported race tags, was higher for female-tagged than male-tagged examples, and was lowest for infant-tagged examples. More work is needed to understand potential demographic limitations.',
        },
        {
          label: 'Known Limitations',
          value:
            'The classifier produces both false positives and false negatives. Results on OpenAI traffic do not guarantee performance on other platforms, so deployers should benchmark on their own representative traffic. Residual overlap between training and evaluation sets may remain despite deduplication. The classifier has not been tested on video frames.',
        },
      ],
    },
    {
      id: 'implementationGuidance',
      title: 'Implementation Guidance',
      fields: [
        {
          label: 'Intended Use',
          value:
            'Intended for authorized organizations, including Trust & Safety teams, NGOs focused on preventing child sexual abuse, and law enforcement. Use it to detect potentially novel or AI-generated CSAM that known-content hash matching may miss, prioritize content for trained human review, and support blocking, enforcement, investigation, triage, and legally required reporting workflows.',
        },
        {
          label: 'Access',
          value:
            'Access is granted at no cost to approved organizations through OpenAI’s intake form, outside of Coop. It requires an OpenAI API key for the organization granted access. The classifier was built with assistance from the National Center for Missing & Exploited Children (NCMEC).',
        },
        {
          label: 'Thresholds',
          value:
            'Default thresholds are 0.996324 for likely-csam and 0.90 for likely-csam/gen-ai. Different use cases may warrant different thresholds: favor precision for auto-blocking, and balance precision and recall when flagging for human review.',
        },
        {
          label: 'Safe Use',
          value:
            'A classifier score alone does not confirm that an image is CSAM, establish its legal status, or determine reporting obligations. Use trained, appropriately authorized human review before NCMEC or hotline reporting, combine the classifier with known-CSAM hash matching and behavioral abuse detection, and do not submit images already confirmed to be CSAM to this service.',
        },
      ],
    },
    {
      id: 'relevantLinks',
      title: 'Relevant Links',
      fields: [
        {
          label: 'Access Intake Form',
          value: 'https://openai.com/form/csam-classifier-intake',
        },
      ],
    },
  ],
};
