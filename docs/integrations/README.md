# Integrations Guide

Coop supports **plugin-style integrations**: authors can ship integrations as separate packages (e.g. npm), and adopters can enable them via a **config file** without changing Coop source code. At startup the platform loads each enabled plugin and uses its manifest for metadata (title, docs, logos, model card, config fields). Adopters do not edit enums, server registries, or client logo maps. You just install the package and edit integrations config file.

For specific integration information, see that integration's documentation:

- [Google Content Safety API](google-content-safety.md)
- [Hasher-Matcher-Actioner (HMA)](hma.md)
- [NCMEC Reporting](ncmec.md)
- [OpenAI Moderation API](openai-moderation.md)
- [Zentropi CoPE](zentropi-cope.md)
