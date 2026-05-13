# Model Cards

A _model card_ is a short document describing a machine learning model's intended
use, behavior, and limitations. The concept was introduced by Google researchers
in 2018 as a way to make AI systems more transparent and comparable.

In Coop, each built-in integration includes a model card so that trust and safety
teams can make informed decisions about which signals to trust, how to configure
review queues, and what manual oversight is required.

## What a model card covers

Each integration's model card describes:

| Field                    | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| **Purpose**        | What the model is designed to detect or classify                     |
| **Input**          | The type of content the model accepts (images, text, URLs, etc.)     |
| **Output**         | The format and meaning of the model's response                       |
| **Limitations**    | Known gaps, failure modes, or content types the model handles poorly |
| **Requirements**   | Access, approval, or configuration needed to use the integration     |
| **Best practices** | Recommendations for getting reliable results                         |

## Why model cards matter

No automated classifier is perfect. Model cards help your team understand:

- **When to trust a signal** — a `VERY_HIGH` priority from one model may represent
  a different confidence level than a `HIGH` from another.
- **What manual review is required** — some integrations (like the Google Content
  Safety API) require human review before taking action; model cards make this explicit.
- **How to configure rules** — knowing a model's output range and limitations helps
  you set meaningful thresholds in Coop's rules engine.

## Finding model cards

Each integration's documentation includes its model card inline. See:

- [Google Content Safety API](google-content-safety.md)
- [Hasher-Matcher-Actioner (HMA)](hma.md)
- [NCMEC Reporting](ncmec.md)
- [OpenAI Moderation API](openai-moderation.md)
- [Zentropi CoPE](zentropi-cope.md)
