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

A signal can ask for more than the value being scored by setting
`contextNeeds` on its `PluginSignalDescriptor`:

```ts
const signal: PluginSignalDescriptor = {
  // ...
  contextNeeds: {
    includeParent: true,
    includeThread: true,
    maxThreadMessages: 50,
  },
  async run(input) {
    const earlier = input.context?.thread?.messages ?? [];
    const parentText = input.context?.parent?.data.text;
    // ...
  },
};
```

Coop then passes the context to `run()` as `input.context`:

```ts
{
  item: { itemId: 'msg-3', itemTypeId: 'message', data: { text: 'see you there' } },
  parent: { itemId: 'post-1', itemTypeId: 'post', data: { text: 'Meetup on Friday' } },
  thread: {
    id: 'thread-1',
    typeId: 'thread',
    // Messages posted before the item, oldest first.
    messages: [
      { itemId: 'msg-1', itemTypeId: 'message', data: { text: 'who is going?' }, creator: { id: 'user-7', typeId: 'user' } },
      { itemId: 'msg-2', itemTypeId: 'message', data: { text: 'me' } },
    ],
    // True when there are more messages than maxThreadMessages.
    truncated: false,
  },
  // Set only when a requested section couldn't be loaded in time, for
  // example unavailable: ['thread'].
}
```

See `SignalEvaluationContext` in `@roostorg/coop-types` for the full shape.

- Every section is optional. An item may have no parent or thread, and a
  section that takes longer than 3 seconds is listed in `unavailable`.
- Threads include up to `maxThreadMessages` messages from the 90 days before
  the item, 20 by default. Each message is read from storage for every
  evaluation that runs your signal, so ask for only as many as your model uses.
- Coop doesn't trim message text. Apply your own size limits before sending
  context to your backend.
- User items are passed by ID and type only, never their data.
- No context is loaded for an integration the organization hasn't configured.
- If Coop can't read an organization's context settings, it sends no context
  rather than fall back to your defaults.

## Org-configurable context (`contextOptions`)

To let each organization choose whether your integration receives thread or
parent context, declare `contextOptions` on the manifest as well. Coop adds an
**Evaluation context** section to your integration's page with **Use
integration default**, **Include**, or **Off** for each kind, plus a message
count for threads.

```ts
const manifest: IntegrationManifest = {
  // ...
  contextOptions: {
    thread: {
      default: 'include',
      defaultMaxMessages: 30,
      maxMessagesLimit: 200,
    },
    parent: { default: 'off' },
  },
};
```

- Declare only the kinds your backend can use; the rest aren't shown.
- `default` applies until the org changes it. `defaultMaxMessages` is the
  count used until the org picks one, 20 if omitted, and orgs can't pick more
  than `maxMessagesLimit`.
- The org's choice adds to each signal's own `contextNeeds`. It can give a
  signal more context but never removes what the signal declares, and Coop
  passes the result as `input.context`.
- The org's choices are stored with the integration config but aren't
  returned by `getCredential()`.
- If your backend needs a choice about how to use the context, such as
  flattening messages to text or sending structured JSON, add a `select`
  configuration field:

```ts
configurationFields: [
  {
    key: 'contextFormat',
    label: 'Context format',
    required: false,
    inputType: 'select',
    options: [
      { value: 'flatten', label: 'Flatten to text' },
      { value: 'structured', label: 'Structured JSON' },
    ],
  },
],
```

Evaluation context requires `@roostorg/coop-types >= 3.0.0`.
