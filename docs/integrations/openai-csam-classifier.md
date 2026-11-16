# OpenAI CSAM Image Classifier

Coop integrates with OpenAI's [CSAM Image Classifier](https://platform.openai.com/docs) to help identify images that may be child sexual abuse material (CSAM), including potentially novel or AI-generated material that known-content hash matching alone may miss. Access is granted by OpenAI at no cost to approved organizations.

The classifier returns risk scores that help route or prioritize images for trained human review. A score alone does not confirm that an image is CSAM, establish its legal status, or determine whether it must be reported. It is one signal in a broader child safety system and should be used alongside known-CSAM hash matching and trained human review.

## Requirements

- An [OpenAI](https://platform.openai.com) account with API access
- CSAM Image Classifier access, granted through OpenAI's [intake form](https://openai.com/form/csam-classifier-intake). OpenAI reviews the applying organization, including whether it has [NCMEC reporting](ncmec.md) in place and its safety stack.

## Configuration

In Coop, go to **Settings → Integrations → OpenAI** and add your **CSAM Classifier API Key**.

This key is separate from the OpenAI Moderation API key. CSAM classifier access is associated with the OpenAI organization chosen during intake, which may differ from the organization of your Moderation API key, so Coop stores and authenticates the two keys independently. You can configure either key on its own; the CSAM classifier signals become available once the CSAM Classifier API Key is set.

## Signals

The classifier is image only. It exposes two signals, each returning a score between 0 and 1. These signals are for review routing and prioritization only, and are not available in automated enforcement rules.

| Signal                                     | What it detects                                                      |
| ------------------------------------------ | -------------------------------------------------------------------- |
| OpenAI CSAM Classifier Overall Image score | Overall likelihood that an image is child sexual abuse material      |
| OpenAI CSAM Classifier GenAI Image score   | Likelihood that an image is AI-generated child sexual abuse material |

OpenAI keeps additional severe-subcategory signals internal; only the two above are exposed through the API.

OpenAI's published default thresholds are 0.996324 for the overall signal and 0.90 for the AI-generated signal. Different use cases may warrant different thresholds: favor precision for auto-blocking content, and balance precision and recall when flagging for human review.

## Models

Coop calls the `/v1/moderations` endpoint with the `omni-moderation-csam-latest` model and image input. The integration's model card in Coop describes the model's training data, performance, demographic results, and known limitations, sourced from OpenAI's published model card.

## Limitations

- Scores are probabilistic risk signals, not factual or legal determinations. A score alone does not confirm that an image is CSAM, establish its legal status, or determine reporting obligations.
- Do not submit images already confirmed to be CSAM to this service. Handle confirmed material through your organization's established response and reporting process, and run known-CSAM hash matching upstream.
- Use trained, appropriately authorized human review before NCMEC or hotline reporting. The classifier can help route or prioritize images for review, but should not replace it.
- Performance and suitable thresholds vary by platform. Benchmark on representative traffic from your own service and select thresholds for your use case.
- The classifier has not been tested on video frames.
