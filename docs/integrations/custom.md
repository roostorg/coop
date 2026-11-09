# Custom Integrations

Coop supports **plugin-style integrations**: authors can ship integrations as separate packages (e.g. npm), and adopters can enable them via a **config file** without changing Coop source code. At startup the platform loads each enabled plugin and uses its manifest for metadata (title, docs, logos, model card, config fields). Adopters do not edit enums, server registries, or client logo maps. You just install the package and edit integrations config file.

## For integration authors

You build a package that exports a **plugin** (manifest + optional signals). The manifest describes the integration: id, name, version, docs link, logos, config fields, and any signals it provides. Logos can be files in the package (served by the platform) or URLs. If the integration needs per-org config (e.g. API keys), you define the fields in the manifest and the platform renders the config form and stores values.

**See the example package for a full reference implementation:** [**`coop-integration-example`**](https://github.com/roostorg/coop-integration-example). It includes a manifest, config field, model card, logos, and a sample signal. Use it as the template for building your own integration; the contract and types live in `@roostorg/coop-types`.

## For adopters

1. **Install** the integration package (e.g. `pnpm --filter server add @roostorg/coop-integration-example` from the repo root).
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

## Configuration form (`configurationFields`)

Declare `configurationFields` on the manifest and Coop renders them as the
integration's configuration form. Each organization's values are saved with
its integration config. Your plugin reads them with
`context.getCredential(orgId)`, where `context` is the `PluginSignalContext`
passed to `createSignals`.

```ts
const manifest: IntegrationManifest = {
  // ...
  requiresConfig: true,
  configurationFields: [
    { key: 'apiKey', label: 'API key', required: true, inputType: 'password' },
    {
      key: 'baseUrl',
      label: 'API base URL',
      required: false,
      inputType: 'text',
      placeholder: 'https://api.example.com',
    },
    {
      key: 'region',
      label: 'Region',
      required: true,
      inputType: 'select',
      options: [
        { value: 'us', label: 'United States' },
        { value: 'eu', label: 'European Union' },
      ],
    },
  ],
};
```

- `inputType` is `text`, `password`, `json`, `array`, or `select`. A `select`
  field needs between 1 and 100 `options`; each option needs a unique,
  non-empty `value` and a non-empty `label` of up to 200 characters. The saved
  value is the chosen `option.value`.
- `json` fields are edited as text and saved as the parsed JSON value; invalid
  JSON blocks saving. `array` fields are saved as a list of strings.
- Keys must start with a letter and contain only letters, digits, and
  underscores (up to 64 characters). `name` and built-in object property
  names such as `constructor` are reserved. A manifest can declare up to 50
  fields.
  Labels are limited to 200 characters, placeholders to 500, and descriptions
  to 2,000.
- Coop rejects a plugin with an invalid field when it loads, so mistakes show
  up at startup rather than in the form.
- Required fields must be filled before saving. Optional fields left blank are
  not saved, so they are absent from the saved config.
- Plugins without `configurationFields` keep the generic key/value form.

Configuration fields require `@roostorg/coop-types >= 3.0.0`.

## Evaluation context (`contextNeeds`)

A signal opts into additional data by setting `contextNeeds` on its
`PluginSignalDescriptor`. The resulting `PluginSignalRunInput.context` is
optional; tolerate absent sections because an item may have no parent or
thread, or a section may time out.

| Need              | Context section                                              |
| ----------------- | ------------------------------------------------------------ |
| `includeFullItem` | `context.item`, the normalized item data and type metadata   |
| `includeParent`   | `context.parent`, the item referenced by the `parentId` role |
| `includeThread`   | `context.thread`, with `id`, `typeId`, and `messages`        |

Each `SignalContextItem` contains `itemId`, `itemTypeId`, optional type
metadata, normalized `data`, optional `createdAt`, and, when the item has a
creator, a `creator` with only its `id` and `typeId`. `thread.messages` are
the messages posted in the 90 days before the item, oldest first, and the
thread has its own `truncated` flag for when more messages exist in that
window. The context also has an optional `unavailable` list containing `item`,
`parent`, or `thread`. When the rule input is a full item, `context.item` is
always included; `includeFullItem` loads it when the input is only an ID.

Threads default to 20 messages and allow at most 100. Each requested section
has a 3-second load timeout. A missing section is absent; a requested section
that could not load is named in `unavailable`. Plugins are responsible for
applying their own text and payload limits.

Context is loaded at most once per rule evaluation for each distinct set of
needs, so signals asking for the same context share one load.
User items are attached only by ID and type, never their data, and creator
IDs are not expanded into user records. Context isn't loaded for an
integration with `requiresConfig: true` that the organization hasn't
configured.

Evaluation context requires `@roostorg/coop-types >= 3.0.0`.
