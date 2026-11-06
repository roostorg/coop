# Zentropi CoPE

[Zentropi CoPE](https://zentropi.ai) (Content Policy Evaluator) is a policy-adaptive AI text classifier. Unlike classifiers with fixed taxonomies, CoPE has no predefined categories; instead, you write your own policy text describing what you want to detect, and the model classifies content against those policies. This makes it particularly useful for platforms with nuanced or unusual content policies that off-the-shelf classifiers handle poorly.

You choose which Zentropi model evaluates content for each labeler version; see [Configuration](#configuration).

## Requirements

- A [Zentropi](https://zentropi.ai) account with API access
- One or more labelers created and deployed in the Zentropi UI, each with a policy definition

## Configuration

In Coop, go to **Settings → Integrations** and add your Zentropi credentials:

- **API Key**: your Zentropi API key
- **Labeler Versions**: one entry per deployed labeler version you want to use in rules, each with its **Version ID** and a display name. **Labeler ID** is optional when using a specific version ID. You can find both IDs in the Zentropi UI.
- **Model**: the Zentropi model that evaluates content for that labeler version:

  | Model         | Description                                                              |
  | ------------- | ------------------------------------------------------------------------ |
  | `cope-latest` | Default. An alias Zentropi points at its current recommended text model. |
  | `cope-b-a4b`  | [CoPE-B-A4B](https://huggingface.co/zentropi-ai/cope-b-a4b)              |
  | `cope-b-s1`   | [CoPE-B-S1](https://huggingface.co/zentropi-ai/cope-b-s1)                |

  Confidence can differ between models, so re-check rule thresholds when you change the model of a labeler version.

## Signals

Each labeler version configured in the integration settings is available as a subcategory of the Zentropi Labeler signal. When building a rule condition, select the Zentropi signal and pick the labeler version by name in the **subcategory** field.

Existing version-only configurations continue to work without changes. Coop always sends the selected version ID to Zentropi and includes the labeler ID only when it is nonblank; it does not replace the selected version with the latest version. Labeler versions saved without a model use `cope-latest`.

Coop sends the text field value to the Zentropi API and receives a score between 0 and 1:

- **0** = the model is confident the content does _not_ match your policy
- **0.5** = uncertain
- **1** = the model is confident the content matches your policy

This score can be used with any comparator in a rule condition, for example `score > 0.8` to trigger only on high-confidence matches.

Zentropi answers bursts of requests with HTTP 429 and sheds load with HTTP 529. Coop retries such a call up to four times, waiting 250 ms, 500 ms, 1 s and then 2 s, or longer if the API's `Retry-After` asks for it (up to five seconds per wait). If the call still fails, the condition is recorded as errored and the rule does not match for that item.

### Writing a policy

Zentropi classifiers work best when policy definitions follow a structured format:

1. **Overview**: a brief description of the policy subject
2. **Definition of Terms**: precise definitions of key words and phrases
3. **Interpretation of Language**: guidance on how to handle ambiguous language
4. **Definition of Labels**: what is included and excluded from the label

The Zentropi documentation walks through policy authoring in detail.

## Limitations

- **Text only**: the integration classifies text fields; image and video content are not supported
- **256K token limit**: policy and content together can be up to 256K tokens
- **US English**: the models are optimized for US English; performance may degrade for other languages and locales
- **Binary classification**: each labeler version returns either "matches the policy" (1) or "does not match" (0) with a confidence score; there are no intermediate categories or multi-label outputs
- **Policy design matters**: the model cannot classify content that requires external knowledge (e.g., whether a link is malicious). Labels reflect the policy you write; monitor classification patterns across demographic groups and audit decisions regularly.

## Model Card

|                            | CoPE-B-A4B                                                                                                                                                                                                       | CoPE-B-S1                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release date**           | May 2026                                                                                                                                                                                                         | October 2026                                                                                                                                                                                  |
| **Training data**          | Policy texts authored by the CoPE team; content from publicly-accessible internet forums; labels from an LLM-assisted relabeling pipeline                                                                        | As CoPE-B-A4B, with higher-quality data across additional safety domains                                                                                                                      |
| **Annotation methodology** | Contradictory-example training: identical content labeled differently under different policies, so the model interprets the policy; training policies span permissive, moderate and stringent variants per topic | Contradictory-example training and binocular labeling (policies refined with dual LLM labeling until independent readers agree), with added multi-label adaptation and confidence calibration |
| **Performance**            | F1 0.81 (precision 0.74, recall 0.90) averaged across drugs, harassment, hate speech, self-harm, sexual content, toxic speech and violence                                                                       | Third-party DecisionIndex benchmarks never seen in training, including PhishNChips accuracy 0.938 and RAGTruth F1 0.756                                                                       |
| **Policy steerability**    | 0.634 on Zentropi's [Policy Steerability Benchmark](https://blog.zentropi.ai/introducing-the-policy-steerability-benchmark/)                                                                                     | 0.766 on the same benchmark                                                                                                                                                                   |
| **Compared to**            | Ahead of GPT-5.4 with default reasoning (F1 0.78), and of the fixed-taxonomy classifiers LlamaGuard4-12B and ShieldGemma-9B by 0.16 or more                                                                      | Ahead of every other open model Zentropi tested on policy steerability                                                                                                                        |

## Links

- [Zentropi API reference](https://zentropi.ai/api)
- [CoPE-B-A4B model card](https://huggingface.co/zentropi-ai/cope-b-a4b)
- [CoPE-B-S1 model card](https://huggingface.co/zentropi-ai/cope-b-s1)
- [Paper](https://arxiv.org/abs/2512.18027)
- [Research talk](https://www.youtube.com/live/JMq49FZ5qmY?si=Q6qpHNeTo-Bc6t9a&t=1)
- [Sample code notebook](https://colab.research.google.com/drive/1JD8OIa3yZYfVbeY81ao03lrvg0aS-6SQ)
