import {
  ScalarTypes,
  type CatalogSignalEntry,
  type PluginSignalDescriptor,
  type SignalCatalog,
} from '@roostorg/coop-types';

import { jsonParse, jsonStringify } from '../../../utils/encoding.js';
import { assertValidPolicies } from '../signals/PluginSignalAdapter.js';

const SIGNAL_ID = /^[A-Z][A-Z0-9_]{0,99}$/;
const MAX_SIGNALS = 500;
const MAX_DISPLAY_NAME = 200;
const MAX_DESCRIPTION = 2000;
const MAX_URL = 2000;
const MAX_SUBCATEGORIES = 1000;
const MAX_SUBCATEGORY_TEXT = 200;
const MAX_VERSION = 200;
const MAX_METADATA_BYTES = 16 * 1024;
const scalarTypeNames = new Set(Object.keys(ScalarTypes));
const validInputs = new Set([...scalarTypeNames, 'FULL_ITEM']);

/**
 * Validates a catalog returned by refreshCatalog() and returns a normalized
 * copy containing only known, JSON-safe fields, which is what Coop stores.
 */
export function validateCatalog(value: unknown): SignalCatalog {
  const catalog = value as Partial<SignalCatalog> | null;
  if (
    catalog == null ||
    typeof catalog !== 'object' ||
    typeof catalog.version !== 'string' ||
    catalog.version.length > MAX_VERSION ||
    !Array.isArray(catalog.signals)
  )
    throw new Error('INVALID_CATALOG');
  if (catalog.signals.length > MAX_SIGNALS)
    throw new Error(`INVALID_CATALOG: more than ${MAX_SIGNALS} signals`);
  const seen = new Set<string>();
  const signals = (catalog.signals as unknown[]).map((raw) => {
    const entry = (raw ?? {}) as Partial<
      Record<keyof CatalogSignalEntry, unknown>
    >;
    const id = entry.signalTypeId;
    if (typeof id !== 'string' || !SIGNAL_ID.test(id))
      throw new Error('INVALID_DESCRIPTOR: invalid signalTypeId');
    if (seen.has(id))
      throw new Error(`INVALID_DESCRIPTOR: duplicate signalTypeId ${id}`);
    const invalidField = findInvalidEntryField(entry);
    if (invalidField != null)
      throw new Error(`INVALID_DESCRIPTOR: ${id} has invalid ${invalidField}`);
    const normalized = normalizeEntry(entry as CatalogSignalEntry);
    try {
      assertValidPolicies(id, normalized.eligibleSubcategories);
    } catch {
      throw new Error(
        `INVALID_DESCRIPTOR: ${id} has invalid eligibleSubcategories`,
      );
    }
    seen.add(id);
    return normalized;
  });
  return { version: catalog.version, signals };
}

/** Checks the runtime part of a descriptor built by createCatalogSignal(). */
export function findInvalidRuntimeField(value: unknown): string | undefined {
  if (value == null || typeof value !== 'object') return 'signal';
  const signal = value as Partial<
    Record<keyof PluginSignalDescriptor, unknown>
  >;
  if (typeof signal.run !== 'function') return 'run';
  if (typeof signal.getDisabledInfo !== 'function') return 'getDisabledInfo';
  if (typeof signal.getCost !== 'function') return 'getCost';
  return undefined;
}

function normalizeEntry(entry: CatalogSignalEntry): CatalogSignalEntry {
  // Round-tripping through JSON drops undefined values and anything
  // non-serializable, so the stored entry is exactly what was validated.
  return jsonParse(
    jsonStringify({
      signalTypeId: entry.signalTypeId,
      displayName: entry.displayName,
      description: entry.description,
      docsUrl: entry.docsUrl,
      recommendedThresholds: entry.recommendedThresholds,
      supportedLanguages: entry.supportedLanguages,
      pricingStructure: { type: entry.pricingStructure.type },
      eligibleInputs: entry.eligibleInputs,
      outputType: { scalarType: entry.outputType.scalarType },
      eligibleSubcategories: entry.eligibleSubcategories.map((it) => ({
        id: it.id,
        label: it.label,
        ...(it.description !== undefined
          ? { description: it.description }
          : {}),
        childrenIds: it.childrenIds,
      })),
      needsMatchingValues: entry.needsMatchingValues,
      needsActionPenalties: entry.needsActionPenalties,
      allowedInAutomatedRules: entry.allowedInAutomatedRules,
      ...(entry.contextNeeds !== undefined
        ? { contextNeeds: entry.contextNeeds }
        : {}),
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    }),
  );
}

function isJsonObject(value: unknown): boolean {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  try {
    return (
      Buffer.byteLength(jsonStringify(value), 'utf8') <=
      MAX_METADATA_BYTES
    );
  } catch {
    return false;
  }
}

function isValidThresholds(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const { highPrecisionThreshold, highRecallThreshold } = value as Record<
    string,
    unknown
  >;
  return [highPrecisionThreshold, highRecallThreshold].every(
    (it) => typeof it === 'string' || typeof it === 'number',
  );
}

function findInvalidEntryField(
  entry: Partial<Record<keyof CatalogSignalEntry, unknown>>,
): string | undefined {
  const outputType = entry.outputType as { scalarType?: unknown } | undefined;
  const pricing = entry.pricingStructure as { type?: unknown } | undefined;
  const checks: Array<[string, boolean]> = [
    [
      'displayName',
      typeof entry.displayName === 'string' &&
        entry.displayName.length <= MAX_DISPLAY_NAME,
    ],
    [
      'description',
      typeof entry.description === 'string' &&
        entry.description.length <= MAX_DESCRIPTION,
    ],
    [
      'docsUrl',
      entry.docsUrl === null ||
        (typeof entry.docsUrl === 'string' && entry.docsUrl.length <= MAX_URL),
    ],
    ['recommendedThresholds', isValidThresholds(entry.recommendedThresholds)],
    [
      'eligibleInputs',
      Array.isArray(entry.eligibleInputs) &&
        entry.eligibleInputs.length > 0 &&
        entry.eligibleInputs.every(
          (it) => typeof it === 'string' && validInputs.has(it),
        ),
    ],
    [
      'outputType',
      typeof outputType?.scalarType === 'string' &&
        scalarTypeNames.has(outputType.scalarType),
    ],
    [
      'pricingStructure',
      pricing?.type === 'FREE' || pricing?.type === 'SUBSCRIPTION',
    ],
    [
      'supportedLanguages',
      entry.supportedLanguages === 'ALL' ||
        (Array.isArray(entry.supportedLanguages) &&
          entry.supportedLanguages.every((it) => typeof it === 'string')),
    ],
    [
      'eligibleSubcategories',
      Array.isArray(entry.eligibleSubcategories) &&
        entry.eligibleSubcategories.length <= MAX_SUBCATEGORIES &&
        entry.eligibleSubcategories.every(isValidSubcategory),
    ],
    ['needsMatchingValues', typeof entry.needsMatchingValues === 'boolean'],
    ['needsActionPenalties', typeof entry.needsActionPenalties === 'boolean'],
    [
      'allowedInAutomatedRules',
      typeof entry.allowedInAutomatedRules === 'boolean',
    ],
    [
      'contextNeeds',
      entry.contextNeeds === undefined || isJsonObject(entry.contextNeeds),
    ],
    ['metadata', entry.metadata === undefined || isJsonObject(entry.metadata)],
  ];
  return checks.find(([, valid]) => !valid)?.[0];
}

function isValidSubcategory(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  const { id, label, description, childrenIds } = value as Record<
    string,
    unknown
  >;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_SUBCATEGORY_TEXT &&
    typeof label === 'string' &&
    label.length <= MAX_SUBCATEGORY_TEXT &&
    (description === undefined ||
      (typeof description === 'string' &&
        description.length <= MAX_DESCRIPTION)) &&
    Array.isArray(childrenIds) &&
    childrenIds.every((it) => typeof it === 'string')
  );
}
