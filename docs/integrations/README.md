# Integrations

Connect to free safety-oriented APIs like Google Content Safety API, OpenAI Moderation API, Zentropi CoPE, and more at the click of a button. We've built several integrations into Coop; just enter your API key.

## Built-in integrations

For specific integration information and detailed requirements, see that integration's documentation:

| Integration                     | Cost                   | Requirements                                                   |
| ------------------------------- | ---------------------- | -------------------------------------------------------------- |
| [Google Content Safety API]     | Free                   | API key, approval by Google[^CSAPI]                            |
| [Hasher-Matcher-Actioner (HMA)] | Free                   | Your own hashes, and/or access to third-party hash banks[^HMA] |
| [NCMEC Reporting]               | Free                   | CyberTip API key, approval by NCMEC[^ESP]                      |
| [OpenAI Moderation API]         | Free[^OAI]             | OpenAI API key                                                 |
| [Zentropi CoPE]                 | Free, paid options[^Z] | Zentropi API key                                               |

[Google Content Safety API]: google-content-safety.md
[Hasher-Matcher-Actioner (HMA)]: hma.md
[NCMEC Reporting]: ncmec.md
[OpenAI Moderation API]: openai-moderation.md
[Zentropi CoPE]: zentropi-cope.md

[^CSAPI]: Industry and civil society third parties seeking to protect their platform against abuse can [apply to access the Content Safety API](https://protectingchildren.google/toolkit-interest-form/?roost-coop). Mention in your application that you are using the Coop review tool. Applications are subject to approval and require accepting Google's terms and conditions.

[^HMA]: You don’t need credentials or licenses for using your own hash banks, i.e. if you have your own collection of known violations. Access to each third-party hash requires access from that org; for example, NCMEC needs to provide Hash Sharing API credentials, Tech Against Terrorism provides access to their hash bank.

[^ESP]: Requires [NCMEC ESP registration](https://esp.ncmec.org/registration) and approval to receive CyberTip API credentials

[^OAI]: [Per OpenAI](https://help.openai.com/en/articles/4936833-is-the-moderation-endpoint-free-to-use), the API is completely free and does not count towards monthly usage limits.

[^Z]: Zentropi text classifiers are free, and currently use the openly-licensed [CoPE-A-9B model](https://huggingface.co/zentropi-ai/cope-a-9b). The API supports all labelers you create, including free and optionally paid; see [Zentropi pricing details](https://zentropi.ai/subscription).

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
