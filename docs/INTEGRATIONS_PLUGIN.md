# Integrations plugin system

COOP supports **plugin-style integrations**: authors can ship integrations as separate packages (e.g. npm), and adopters can enable them via a **config file** without changing COOP source code. At startup the platform loads each enabled plugin and uses its manifest for metadata (title, docs, logos, model card, config fields). Adopters do not edit enums, server registries, or client logo maps. You just install the package and edit integrations config file.

## For integration authors

You build a package that exports a **plugin** (manifest + optional signals). The manifest describes the integration: id, name, version, docs link, logos, config fields, and any signals it provides. Logos can be files in the package (served by the platform) or URLs. If the integration needs per-org config (e.g. API keys), you define the fields in the manifest and the platform renders the config form and stores values.

**See the example package for a full reference implementation:** [**`coop-integration-example`**](https://github.com/roostorg/coop-integration-example). It includes a manifest, config field, model card, logos, and a sample signal. Use it as the template for building your own integration; the contract and types live in `@roostorg/types`.

## For adopters

1. **Install** the integration package (e.g. `npm install @roostorg/coop-integration-example` in the server app).
2. **Enable it** in the integrations config file. The server reads `server/integrations.config.json` by default, or the path in `INTEGRATIONS_CONFIG_PATH`. Example shape:

   ```json
   {
     "integrations": [
       { "package": "@roostorg/coop-integration-example", "enabled": true }
     ]
   }
   ```

   For local development like a local package, use `"package": "../coop-integration-example"` (path relative to the config file's directory). Do not put secrets in the config file; use the in-app integration config flow for API keys and similar.

3. **Use it** in the UI: the integration appears on the integrations page, orgs can set config, and if the plugin provides signals, they appear in the rule builder like built-in signals.

## Summary

- **Authors:** Implement the plugin contract (see `coop-integration-example` and `@roostorg/types`).
- **Adopters:** Add the package, add one entry to the integrations config, and the rest is driven by the plugin.
