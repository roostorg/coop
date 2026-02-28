/**
 * Integration plugin types for COOP.
 *
 * These types define the contract that third-party integration packages
 * implement so adopters can install and configure them without adding
 * every integration to the main COOP repo.
 *
 * Integration packages export a CoopIntegrationPlugin; adopters register
 * them via an integrations config file (see CoopIntegrationsConfig).
 */

/** Unique identifier for the integration (e.g. "GOOGLE_CONTENT_SAFETY_API"). */
export type IntegrationId = string;

// ---------------------------------------------------------------------------
// Model card (optional, per-integration metadata for display in the UI)
// ---------------------------------------------------------------------------

/**
 * A single key-value row in a model card (e.g. "Release Date" -> "January 2026").
 * Values are plain strings; the UI can linkify URLs or format as needed.
 */
export type ModelCardField = Readonly<{
  label: string;
  value: string;
}>;

/**
 * A named group of fields within a section (e.g. "Basic Information" with
 * Model Name, Version, Release Date). Rendered as a bold subheading + key-value list.
 */
export type ModelCardSubsection = Readonly<{
  title: string;
  fields: readonly ModelCardField[];
}>;

/**
 * One collapsible section of a model card (e.g. "Model Details", "Training Data").
 * Either subsections (with bold sub-headings) or top-level fields, or both.
 */
export type ModelCardSection = Readonly<{
  /** Stable id for the section (e.g. "modelDetails", "trainingData"). */
  id: string;
  /** Display title (e.g. "Model Details"). */
  title: string;
  /** Optional grouped key-value blocks with their own titles. */
  subsections?: readonly ModelCardSubsection[];
  /** Optional flat key-value list when there are no subsections. */
  fields?: readonly ModelCardField[];
}>;

/**
 * Model card: structured, JSON-backed metadata for an integration, so the UI
 * can display it in a consistent but integration-specific way.
 *
 * Required: modelName and version (always shown). All sections are optional;
 * the UI renders only those present. Sections can have subsections (e.g.
 * "Basic Information", "Model Architecture") or flat fields.
 */
export type ModelCard = Readonly<{
  /** Required. Display name of the model (e.g. "GPT-4"). */
  modelName: string;
  /** Required. Version string (e.g. "1.0.0" or "v0.0"). */
  version: string;
  /** Optional. Release date or similar (e.g. "January 2026"). */
  releaseDate?: string;
  /** Optional. Ordered list of sections; each can be collapsed/expanded in the UI. */
  sections?: readonly ModelCardSection[];
}>;

/**
 * Section ids that every integration's model card must include.
 * Use assertModelCardHasRequiredSections() to validate at runtime.
 */
export const REQUIRED_MODEL_CARD_SECTION_IDS = [
  'modelDetails',
  'technicalIntegration',
] as const;

/**
 * Asserts that a model card has at least the required sections (basic information
 * and technical integration). Call when registering integration manifests.
 * @throws Error if any required section id is missing
 */
export function assertModelCardHasRequiredSections(card: ModelCard): void {
  const sectionIds = new Set((card.sections ?? []).map((s) => s.id));
  for (const requiredId of REQUIRED_MODEL_CARD_SECTION_IDS) {
    if (!sectionIds.has(requiredId)) {
      throw new Error(
        `Model card must include a section with id "${requiredId}" (e.g. Basic Information / Model Details and Technical Integration).`,
      );
    }
  }
}

/**
 * Describes a single configuration field for integrations that require
 * user-supplied config (e.g. API keys or other settings). Used to generate or validate config forms.
 */
export type IntegrationConfigField = Readonly<{
  /** Form field key (e.g. "apiKey", "truePercentage"). */
  key: string;
  /** Human-readable label for the field. */
  label: string;
  /** Whether the field is required. */
  required: boolean;
  /** Input type for the UI. */
  inputType: 'text' | 'password' | 'json' | 'array';
  /** Optional placeholder or hint. */
  placeholder?: string;
  /** Optional description for the field. */
  description?: string;
}>;

/**
 * Metadata and capability description for an integration.
 * This is the stable, structured information shown to users (name, docs, logos, etc.).
 */
export type IntegrationManifest = Readonly<{
  /** Unique integration id. Must be UPPER_SNAKE_CASE to align with GraphQL enums when used in COOP. */
  id: IntegrationId;
  /** Human-readable display name shown in the UI (e.g. signal modal, integration cards). Exposed as Signal.integrationTitle. */
  name: string;
  /** Semantic version of the integration plugin (e.g. "1.0.0"). */
  version: string;
  /** Short description for listings and tooltips. */
  description?: string;
  /** Link to documentation or product page. */
  docsUrl?: string;
  /** Whether this integration requires the user to supply config (e.g. API key). */
  requiresConfig: boolean;
  /**
   * Schema for configuration fields when requiresConfig is true.
   * Enables UI generation and validation without hardcoding per-integration forms.
   */
  configurationFields?: readonly IntegrationConfigField[];
  /**
   * Optional list of signal type ids this integration provides (e.g. "ZENTROPI_LABELER").
   * Used by the platform to associate signals with this integration for display and gating.
   */
  signalTypeIds?: readonly string[];
  /**
   * Model card: structured metadata (model name, version, sections) for the UI.
   * When present, the integration detail page renders it. Built-in integrations
   * should always provide a model card with at least sections "modelDetails" and
   * "technicalIntegration"; use assertModelCardHasRequiredSections() when
   * registering.
   */
  modelCard?: ModelCard;
  /**
   * ------------------------------------------------------------
   * LOGO/IMAGE SECTION:
   * ------------------------------------------------------------
   * The following logo/image sections are optional. If none provided will use a fallback Coop logo.
   * 
   * Provide either logoUrl and logoWithBackgroundUrl or logoPath and logoWithBackgroundPath.
   * 
   * If you provide logoPath and logoWithBackgroundPath, the server will serve the files at
   * GET /api/v1/integration-logos/:integrationId and GET /api/v1/integration-logos/:integrationId/with-background
   * and set logoUrl and logoWithBackgroundUrl accordingly.
   * Usage: logoUrl/logoPath = plain logo (no background), used on the integrations page;
   * logoWithBackgroundUrl/logoWithBackgroundPath = logo with background, used in signal modals.
   * If you provide logoUrl and logoWithBackgroundUrl, the server will use those URLs directly.
   * Prefered size: ~180x180px for logoUrl and ~120x120px for logoWithBackgroundUrl.
   * Prefer a square or horizontal logo that scales well.
   */
  logoUrl?: string;
  logoWithBackgroundUrl?: string;
  logoPath?: string;
  logoWithBackgroundPath?: string;
}>;

// ---------------------------------------------------------------------------
// Plugin signals (for integrations that power routing/enforcement rules)
// ---------------------------------------------------------------------------

/** Context passed to plugin.createSignals() so the plugin can build signal instances with credential access. */
export type PluginSignalContext = Readonly<{
  /** Integration id (e.g. "ACME_API") from the plugin manifest. */
  integrationId: string;
  /** Get stored credential/config for an org. Resolves to the JSON stored for this integration. */
  getCredential: (orgId: string) => Promise<Record<string, unknown>>;
}>;

/** Minimal signal descriptor returned by a plugin. The platform adapts this to its internal SignalBase. */
export type PluginSignalDescriptor = Readonly<{
  /** Stable signal type id (e.g. "ACME_MODERATION_SIGNAL"). Must match one of manifest.signalTypeIds. */
  id: Readonly<{ type: string }>;
  displayName: string;
  description: string;
  docsUrl: string | null;
  recommendedThresholds: Readonly<{
    highPrecisionThreshold: string | number;
    highRecallThreshold: string | number;
  }> | null;
  supportedLanguages: readonly string[] | 'ALL';
  pricingStructure: Readonly<{ type: 'FREE' | 'SUBSCRIPTION' }>;
  eligibleInputs: readonly string[];
  outputType: Readonly<{ scalarType: string }>;
  getCost: () => number;
  /** Run the signal. Input shape is platform-defined; result must have outputType and score. */
  run: (input: unknown) => Promise<unknown>;
  getDisabledInfo: (orgId: string) => Promise<
    | { disabled: false; disabledMessage?: string }
    | { disabled: true; disabledMessage: string }
  >;
  needsMatchingValues: boolean;
  eligibleSubcategories: ReadonlyArray<{
    id: string;
    label: string;
    description?: string;
    childrenIds: readonly string[];
  }>;
  needsActionPenalties: boolean;
  /** Integration id (same as context.integrationId). */
  integration: string;
  allowedInAutomatedRules: boolean;
}>;

/**
 * Plugin contract that third-party integration packages must implement.
 * Export this as the default export (or a named export) from the package.
 *
 * Example (in an integration package):
 *
 *   const manifest: IntegrationManifest = { id: 'ACME_API', name: 'Acme API', ... };
 *   const plugin: CoopIntegrationPlugin = { manifest };
 *   export default plugin;
 *
 * To power routing/enforcement rules, also implement createSignals(context) and
 * return one descriptor per manifest.signalTypeIds entry.
 */
export type CoopIntegrationPlugin = Readonly<{
  manifest: IntegrationManifest;
  /**
   * Optional static config shape for this integration.
   * If present, adopters can pass non-secret config in the integrations config file.
   */
  configSchema?: unknown;
  /**
   * Optional. If this integration provides signals for use in rules, implement this.
   * Return one descriptor per signal type id listed in manifest.signalTypeIds.
   * The platform will register these so they appear in the rule builder and can be used in conditions.
   */
  createSignals?: (
    context: PluginSignalContext,
  ) => ReadonlyArray<Readonly<{ signalTypeId: string; signal: PluginSignalDescriptor }>>;
}>;

/**
 * Single entry in the adopters' integrations config file.
 * Enables or disables a plugin and optionally passes static config.
 */
export type CoopIntegrationConfigEntry = Readonly<{
  /** NPM package name (e.g. "@acme/coop-integration-acme") or path to a local module. */
  package: string;
  /** Whether this integration is enabled. Default true if omitted. */
  enabled?: boolean;
  /** Optional static config passed to the integration (no secrets here; use org credentials in-app). */
  config?: Readonly<Record<string, unknown>>;
}>;

/**
 * Root type for the integrations config file that adopters use to register
 * plugin integrations. Can be JSON or a JS/TS module that exports this shape.
 *
 * Example integrations.config.json:
 *
 *   {
 *     "integrations": [
 *       { "package": "@acme/coop-integration-acme", "enabled": true },
 *       { "package": "./local-integrations/foo", "config": { "endpoint": "https://..." } }
 *     ]
 *   }
 */
export type CoopIntegrationsConfig = Readonly<{
  integrations: readonly CoopIntegrationConfigEntry[];
}>;

/**
 * Shape of the config stored in the database for each integration (per org).
 * Stored in a generic table as JSON: one row per (org_id, integration_id) with
 * config as a JSON-serializable object. Each integration defines its own required
 * fields via IntegrationManifest.configurationFields; the app validates and
 * serializes/deserializes to this type.
 *
 * Only JSON-serializable values (no functions, symbols, or BigInt) should be
 * included so the payload can be stored in a JSONB or TEXT column.
 */
export type StoredIntegrationConfigPayload = Readonly<Record<string, unknown>>;

/**
 * Type guard for CoopIntegrationPlugin.
 */
export function isCoopIntegrationPlugin(
  value: unknown,
): value is CoopIntegrationPlugin {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (o.manifest == null || typeof o.manifest !== 'object') {
    return false;
  }
  const m = o.manifest as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    typeof m.version === 'string' &&
    typeof m.requiresConfig === 'boolean'
  );
}
