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
 * Describes a single credential field for integrations that require
 * API keys or other secrets. Used to generate or validate credential forms.
 */
export type IntegrationCredentialField = Readonly<{
  /** Form field key (e.g. "apiKey", "labelerVersions"). */
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
  /** Human-readable display name (e.g. "Google Content Safety API"). */
  name: string;
  /** Semantic version of the integration plugin (e.g. "1.0.0"). */
  version: string;
  /** Short description for listings and tooltips. */
  description?: string;
  /** Link to documentation or product page. */
  docsUrl?: string;
  /** Optional URL to a logo image (or asset key if using a bundler). */
  logoUrl?: string;
  /** Optional URL to a logo variant (e.g. with background) for cards. */
  logoWithBackgroundUrl?: string;
  /** Whether this integration requires the user to supply credentials (e.g. API key). */
  requiresCredentials: boolean;
  /**
   * Schema for credential fields when requiresCredentials is true.
   * Enables UI generation and validation without hardcoding per-integration forms.
   */
  credentialFields?: readonly IntegrationCredentialField[];
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
 */
export type CoopIntegrationPlugin = Readonly<{
  manifest: IntegrationManifest;
  /**
   * Optional static config shape for this integration.
   * If present, adopters can pass non-secret config in the integrations config file.
   */
  configSchema?: unknown;
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
 * fields via IntegrationManifest.credentialFields; the app validates and
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
    typeof m.requiresCredentials === 'boolean'
  );
}
