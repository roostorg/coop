# Integrations

Connect to free safety-oriented APIs like Google Content Safety API, OpenAI Moderation API, Zentropi CoPE, and more at the click of a button. We've built several integrations into Coop; just enter your API key.

## Built-in integrations

For specific integration information, see that integration's documentation:

- [Google Content Safety API](google-content-safety.md)
- [Hasher-Matcher-Actioner (HMA)](hma.md)
- [NCMEC Reporting](ncmec.md)
- [OpenAI Moderation API](openai-moderation.md)
- [Zentropi CoPE](zentropi-cope.md)

## Model cards

Each integration includes a model card for consistent, comparable information about how it works. A model card is a short document describing a machine learning model's intended use, behavior, and limitations; think of it as a nutrition label for AI classifiers.

Each integration's model card describes:

| Field              | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| **Purpose**        | What the model is designed to detect or classify                     |
| **Input**          | The type of content the model accepts (images, text, URLs, etc.)     |
| **Output**         | The format and meaning of the model's response                       |
| **Limitations**    | Known gaps, failure modes, or content types the model handles poorly |
| **Requirements**   | Access, approval, or configuration needed to use the integration     |
| **Best practices** | Recommendations for getting reliable results                         |

No automated classifier is perfect. Model cards help you understand when to trust a signal, what manual review is required, and how to configure rules meaningfully.
