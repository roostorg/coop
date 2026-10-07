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

import type { JsonObject } from 'type-fest';

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
  /** Stable id for the section (e.g. "trainingData", "biasAndLimitations"). */
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
  'trainingData',
  'policyAndTaxonomy',
  'annotationMethodology',
  'performanceBenchmarks',
  'biasAndLimitations',
  'implementationGuidance',
  'relevantLinks',
] as const;

/**
 * Asserts that a model card has at least the required sections.
 * Call when registering integration manifests.
 * @throws Error if any required section id is missing
 */
export function assertModelCardHasRequiredSections(card: ModelCard): void {
  const sectionIds = new Set((card.sections ?? []).map((s) => s.id));
  const missing = REQUIRED_MODEL_CARD_SECTION_IDS.filter(
    (id) => !sectionIds.has(id),
  );
  if (missing.length > 0) {
    throw new Error(
      `Model card is missing required section(s): ${missing.map((id) => `"${id}"`).join(', ')}.`,
    );
  }
}

/**
 * Describes a single configuration field for integrations that require
 * user-supplied config (e.g. API keys or other settings). Used to generate or validate config forms.
 */
export type IntegrationConfigField = IntegrationConfigFieldBase &
  (
    | Readonly<{
        /** Input type for the UI. */
        inputType: 'text' | 'password' | 'json' | 'array';
        options?: undefined;
      }>
    | Readonly<{
        /** Renders a dropdown of `options`. */
        inputType: 'select';
        /** Must be non-empty; the stored value is `option.value`. */
        options: readonly IntegrationConfigFieldOption[];
      }>
  );

type IntegrationConfigFieldBase = Readonly<{
  /** Form field key (e.g. "apiKey", "truePercentage"). */
  key: string;
  /** Human-readable label for the field. */
  label: string;
  /** Whether the field is required. */
  required: boolean;
  /** Optional placeholder or hint. */
  placeholder?: string;
  /** Optional description for the field. */
  description?: string;
}>;

export type IntegrationConfigFieldOption = Readonly<{
  value: string;
  label: string;
}>;

/** Whether a context kind is loaded when the org hasn't chosen otherwise. */
export type IntegrationContextDefault = 'include' | 'off';

/**
 * Evaluation context an integration can use, shown as org-level settings on
 * its Integrations page. Coop loads the chosen context and passes it to every
 * signal of the integration as `input.context`. Omitted kinds aren't offered.
 * How the context is used (e.g. flattened to text) is up to the plugin.
 */
export type IntegrationContextOptions = Readonly<{
  thread?: Readonly<{
    default: IntegrationContextDefault;
    /** Defaults to the platform default (20). */
    defaultMaxMessages?: number;
    /** Upper bound the org can choose; capped by the platform maximum (100). */
    maxMessagesLimit?: number;
  }>;
  parent?: Readonly<{ default: IntegrationContextDefault }>;
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
   * Optional. Evaluation context this integration can use (thread, parent),
   * with defaults. Orgs can change these per integration.
   */
  contextOptions?: IntegrationContextOptions;
  /**
   * Optional list of signal type ids this integration provides (e.g. "ZENTROPI_LABELER").
   * Used by the platform to associate signals with this integration for display and gating.
   * Lists the static createSignals() ids only; ids returned by refreshCatalog()
   * are org-specific and don't need to be listed here.
   */
  signalTypeIds?: readonly string[];
  /**
   * Model card: structured metadata (model name, version, sections) for the UI.
   * When present, the integration detail page renders it. Integrations must
   * include all sections listed in REQUIRED_MODEL_CARD_SECTION_IDS; use
   * assertModelCardHasRequiredSections() when registering.
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

/**
 * Optional expansions a plugin signal can request. Coop combines them with the
 * org's context settings for the integration (see manifest `contextOptions`),
 * loads the effective needs once per rule evaluation, and attaches them to the
 * run input as `context`. Signals with no effective needs receive the same
 * input as before.
 */
export type SignalContextNeeds = Readonly<{
  /** Attach the full item under evaluation (data + type metadata). */
  includeFullItem?: boolean;
  /** Attach the item referenced by the item type's `parentId` field role. */
  includeParent?: boolean;
  /**
   * Attach the conversation the item belongs to: the thread referenced by the
   * `threadId` role for content items, or the item itself for THREAD items.
   */
  includeThread?: boolean;
  /** Overrides the platform default; clamped to the platform maximum. */
  maxThreadMessages?: number;
}>;

/** An item loaded into a signal's evaluation context. */
export type SignalContextItem = Readonly<{
  itemId: string;
  itemTypeId: string;
  itemTypeName?: string;
  itemTypeKind?: 'CONTENT' | 'THREAD' | 'USER';
  /** Normalized item data, as submitted to Coop. */
  data: Readonly<Record<string, unknown>>;
  /** ISO 8601 timestamp from the item type's `createdAt` role, if any. */
  createdAt?: string;
  /** Creator identifier only; no user data is attached. */
  creator?: Readonly<{ id: string; typeId: string }>;
}>;

/**
 * Structured context attached to a plugin signal's run input when it has
 * effective context needs (its `contextNeeds` or the org's context settings
 * from manifest `contextOptions`). Every section is optional: plugins must tolerate
 * absent sections (e.g. the item has no parent, or loading timed out).
 */
export type SignalEvaluationContext = Readonly<{
  item?: SignalContextItem;
  parent?: SignalContextItem;
  thread?: Readonly<{
    id: string;
    typeId: string;
    /**
     * Oldest first, bounded by maxThreadMessages. Coop doesn't trim by size;
     * apply your own text or payload limits.
     */
    messages: readonly SignalContextItem[];
    /** True when older messages exist beyond maxThreadMessages. */
    truncated: boolean;
  }>;
  /** Sections that were requested but could not be loaded. */
  unavailable?: ReadonlyArray<'item' | 'parent' | 'thread'>;
}>;

/**
 * Input passed to PluginSignalDescriptor.run(). `value` is a tagged scalar
 * (`{ type, value }`) or, for FULL_ITEM signals, the tagged item data.
 */
export type PluginSignalRunInput = Readonly<{
  value: unknown;
  matchingValues?: readonly unknown[];
  actionPenalties?: readonly unknown[];
  subcategory?: string;
  contentId?: string;
  userId?: string;
  orgId: string;
  contextId?: string;
  contentType?: string;
  args?: unknown;
  runtimeArgs?: unknown;
  /** Present only when the signal has effective context needs. */
  context?: SignalEvaluationContext;
}>;

/** Minimal signal descriptor returned by a plugin. The platform adapts this to its internal SignalBase. */
export type PluginSignalDescriptor = Readonly<{
  /**
   * Stable signal type id (e.g. "ACME_MODERATION_SIGNAL"). For createSignals()
   * it should be listed in manifest.signalTypeIds; refreshCatalog() ids need not be.
   */
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
  /** Run the signal. Result must have outputType and score. */
  run: (input: PluginSignalRunInput) => Promise<unknown>;
  getDisabledInfo: (
    orgId: string,
  ) => Promise<
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
  /** Optional. Declares which context expansions this signal needs. */
  contextNeeds?: SignalContextNeeds;
}>;

export type PluginSignalEntry = Readonly<{
  signalTypeId: string;
  signal: PluginSignalDescriptor;
}>;

/** Context passed to plugin.refreshCatalog(). Scoped to a single org. */
export type CatalogRefreshContext = Readonly<{
  integrationId: string;
  orgId: string;
  /** Resolves to this org's stored config for the integration. */
  getCredential: () => Promise<Record<string, unknown>>;
  /** Aborted when the platform refresh timeout elapses. Pass it to fetch(). */
  abortSignal: AbortSignal;
}>;

/**
 * A data-only signal in an org's catalog: everything Coop needs to list and
 * validate the signal, without functions. Coop stores entries (Postgres) and
 * rebuilds runnable signals from them with plugin.createCatalogSignal().
 */
export type CatalogSignalEntry = Readonly<
  Omit<
    PluginSignalDescriptor,
    'id' | 'integration' | 'getCost' | 'run' | 'getDisabledInfo'
  > & {
    /**
     * Stable signal type id; rules reference it, so keep it across refreshes.
     * Uppercase letters, digits and underscores, starting with a letter; at
     * most 100 characters.
     */
    signalTypeId: string;
    /**
     * Optional JSON the plugin needs to run this signal (e.g. a provider
     * model id). Stored as-is; never shown to users. Don't put secrets here.
     * At most 16 KB when serialized.
     */
    metadata?: JsonObject;
  }
>;

/**
 * Org-specific signal catalog returned by plugin.refreshCatalog(). Signal type
 * ids must be stable across refreshes so existing rules keep resolving.
 *
 * Coop rejects the whole refresh, keeping the previously stored catalog, if
 * any entry is invalid. Limits: 500 signals; per signal, displayName up to 200
 * characters, description and docsUrl up to 2000, and up to 1000
 * eligibleSubcategories (id and label up to 200 characters each).
 */
export type SignalCatalog = Readonly<{
  /** Opaque provider version, at most 200 characters. Shown for debugging. */
  version: string;
  signals: readonly CatalogSignalEntry[];
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
export type CoopIntegrationPlugin = CoopIntegrationPluginBase &
  (
    | Readonly<{ refreshCatalog?: undefined; createCatalogSignal?: undefined }>
    | CatalogRefreshHooks
  );

type CoopIntegrationPluginBase = Readonly<{
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
  ) => readonly PluginSignalEntry[];
}>;

/**
 * Optional org-specific catalog support. Implement both hooks or neither.
 */
export type CatalogRefreshHooks = Readonly<{
  /**
   * Returns the org-specific signal catalog as data, e.g. by listing
   * models or policies from a remote API with the org's credentials. Coop
   * calls it on demand (Integrations UI, after config save, first use, and
   * periodically), validates the result, and stores it per org. The returned
   * signals are merged with createSignals() for that org; a refreshed signal
   * replaces a createSignals() signal with the same id. Plugins without it
   * keep static createSignals() behavior.
   */
  refreshCatalog: (context: CatalogRefreshContext) => Promise<SignalCatalog>;
  /**
   * Builds a runnable signal from a stored
   * catalog entry, without calling the provider; Coop calls it on any server
   * instance that serves the org. Coop uses the entry's data fields (names,
   * types, subcategories) as the source of truth; the returned descriptor
   * supplies run(), getDisabledInfo() and getCost().
   */
  createCatalogSignal: (
    entry: CatalogSignalEntry,
    context: PluginSignalContext,
  ) => PluginSignalDescriptor;
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
