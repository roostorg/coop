# Zentropi CoPE

[Zentropi CoPE](https://zentropi.ai) (Content Policy Enforcement) is a policy-adaptive AI text classifier. Unlike classifiers with fixed taxonomies, CoPE has no predefined categories; instead, you write your own policy text describing what you want to detect, and the model classifies content against those policies. This makes it particularly useful for platforms with nuanced or unusual content policies that off-the-shelf classifiers handle poorly.

The model powering the integration is **CoPE-A-9B** (version 1.x, released July 2025).

## Requirements

- A [Zentropi](https://zentropi.ai) account with API access
- One or more labelers created and deployed in the Zentropi UI, each with a policy definition

## Configuration

In Coop, go to **Settings → Integrations** and add your Zentropi credentials:

- **API Key**: your Zentropi API key
- **Labeler Versions**: one entry per deployed labeler version you want to use in rules, each with its **Version ID** and a display name. **Labeler ID** is optional when using a specific version ID. You can find both IDs in the Zentropi UI.

## Signals

Each labeler version configured in the integration settings is available as a subcategory of the Zentropi Labeler signal. When building a rule condition, select the Zentropi signal and pick the labeler version by name in the **subcategory** field.

Existing version-only configurations continue to work without changes. Coop always sends the selected version ID to Zentropi and includes the labeler ID only when it is nonblank; it does not replace the selected version with the latest version.

Coop sends the text field value to the Zentropi API and receives a score between 0 and 1:

- **0** = confidently safe (model is confident the content does _not_ violate your policy)
- **0.5** = uncertain
- **1** = confidently violating (model is confident the content violates your policy)

This score can be used with any comparator in a rule condition, for example `score > 0.8` to trigger only on high-confidence violations.

### Writing a policy

Zentropi classifiers work best when policy definitions follow a structured format:

1. **Overview**: a brief description of the policy subject
2. **Definition of Terms**: precise definitions of key words and phrases
3. **Interpretation of Language**: guidance on how to handle ambiguous language
4. **Definition of Labels**: what is included and excluded from the label

The Zentropi documentation and [sample code notebook](https://colab.research.google.com/drive/1LBmQ3d0OVrq2EpVP0tc03POalf3sDpjl?usp=sharing) walk through policy authoring in detail.

## Limitations

- **Text only**: the integration classifies text fields; image and video content are not supported
- **8,000 token limit**: text longer than 8K tokens will be truncated
- **US English only**: performance degrades significantly for other languages and locales
- **Binary classification**: each labeler version returns either "violating" (1) or "not violating" (0) with a confidence score; there are no intermediate categories or multi-label outputs
- **Policy design matters**: the model cannot classify content that requires external verification (e.g., whether a link is malicious). Biases in the training data may affect classification patterns across demographic groups; monitor and audit decisions regularly.

## Model Card

|                            |                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Model**                  | CoPE-A-9B                                                                                                                                                          |
| **Version**                | 1.x                                                                                                                                                                |
| **Release date**           | July 20, 2025                                                                                                                                                      |
| **Training data**          | ~60,000 labels across unique policy/content pairs; mix of automated and manual annotation; covers hate speech, sexual content, self-harm, harassment, and toxicity |
| **Annotation methodology** | Novel training methodology for policy interpretation rather than memorization; trained across conflicting policy formulations                                      |
| **Performance**            | Hate Speech: 91% (internal), 84% (public Ethos benchmark); Sexual Content: 89%; Toxic Speech: 90%; Self-Harm: 88%; Harassment: 73%                                 |
| **Compared to**            | Outperforms GPT-4o, Llama-3.1-8B, LlamaGuard3-8B, and ShieldGemma-9B across most categories                                                                        |

## Links

- [Zentropi API reference](https://zentropi.ai/api)
- [HuggingFace model card](https://huggingface.co/zentropi-ai/cope-a-9b)
- [Research talk](https://www.youtube.com/live/JMq49FZ5qmY?si=Q6qpHNeTo-Bc6t9a&t=1)
- [Sample code notebook](https://colab.research.google.com/drive/1LBmQ3d0OVrq2EpVP0tc03POalf3sDpjl?usp=sharing)
