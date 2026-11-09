/**
 * Org-level evaluation context settings for plugin integrations.
 *
 * A plugin declares which context kinds it can use (manifest.contextOptions)
 * and their defaults; each org can change them on the integration page. The
 * org's choice is stored inside the integration's config JSON under
 * CONTEXT_SETTINGS_KEY and is never passed to the plugin's getCredential().
 */
import type {
  IntegrationContextDefault,
  SignalContextNeeds,
} from '@roostorg/coop-types';

import {
  DEFAULT_MAX_THREAD_MESSAGES,
  MAX_THREAD_MESSAGES,
} from '../signalContextService/limits.js';

export const CONTEXT_SETTINGS_KEY = '__coopContext';

export type ContextKind = 'thread' | 'parent';
export type ContextMode = 'default' | 'include' | 'off';

const CONTEXT_KINDS: readonly ContextKind[] = ['thread', 'parent'];

/** Plugin-declared options with numbers resolved against platform limits. */
export type NormalizedContextOption = Readonly<{
  default: IntegrationContextDefault;
  /** Present for kinds with a count (thread messages). */
  defaultMaxCount?: number;
  maxCountLimit?: number;
}>;
export type NormalizedContextOptions = Readonly<
  Partial<Record<ContextKind, NormalizedContextOption>>
>;

export type OrgContextSetting = Readonly<{
  mode: ContextMode;
  maxCount?: number;
}>;
export type OrgContextSettings = Readonly<
  Partial<Record<ContextKind, OrgContextSetting>>
>;

const PLATFORM_COUNTS = {
  thread: {
    defaultMax: DEFAULT_MAX_THREAD_MESSAGES,
    max: MAX_THREAD_MESSAGES,
    defaultKey: 'defaultMaxMessages',
    limitKey: 'maxMessagesLimit',
  },
} as const;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Validates manifest.contextOptions. Throws (failing plugin load) when an
 * option is malformed; numbers above the platform maximum are capped.
 */
export function validateContextOptions(
  integrationId: string,
  value: unknown,
): NormalizedContextOptions | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `Integration "${integrationId}" contextOptions must be an object.`,
    );
  }
  const raw = value as Record<string, unknown>;
  const result: Partial<Record<ContextKind, NormalizedContextOption>> = {};
  for (const kind of CONTEXT_KINDS) {
    const option = raw[kind];
    if (option == null) continue;
    const invalid = () =>
      new Error(
        `Integration "${integrationId}" has an invalid contextOptions.${kind}.`,
      );
    if (typeof option !== 'object' || Array.isArray(option)) throw invalid();
    const o = option as Record<string, unknown>;
    if (o.default !== 'include' && o.default !== 'off') throw invalid();
    if (kind === 'parent') {
      result.parent = { default: o.default };
      continue;
    }
    const counts = PLATFORM_COUNTS[kind];
    const rawLimit = o[counts.limitKey];
    const rawDefault = o[counts.defaultKey];
    if (rawLimit !== undefined && !isPositiveInteger(rawLimit)) {
      throw invalid();
    }
    if (rawDefault !== undefined && !isPositiveInteger(rawDefault)) {
      throw invalid();
    }
    const maxCountLimit = Math.min(rawLimit ?? counts.max, counts.max);
    const defaultMaxCount = Math.min(
      rawDefault ?? counts.defaultMax,
      maxCountLimit,
    );
    result[kind] = { default: o.default, defaultMaxCount, maxCountLimit };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Reads the org's saved settings from stored config, ignoring bad data. */
export function readOrgContextSettings(
  storedConfig: Readonly<Record<string, unknown>> | undefined,
): OrgContextSettings {
  const raw = storedConfig?.[CONTEXT_SETTINGS_KEY];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Partial<Record<ContextKind, OrgContextSetting>> = {};
  for (const kind of CONTEXT_KINDS) {
    const setting = (raw as Record<string, unknown>)[kind];
    if (setting == null || typeof setting !== 'object') continue;
    const { mode, maxCount } = setting as Record<string, unknown>;
    if (mode !== 'default' && mode !== 'include' && mode !== 'off') continue;
    result[kind] = isPositiveInteger(maxCount) ? { mode, maxCount } : { mode };
  }
  return result;
}

export type ContextSettingInput = Readonly<{
  kind: ContextKind;
  mode: ContextMode;
  maxCount?: number | null;
}>;

/**
 * Validates an org's requested settings against what the plugin declared.
 * Kinds the plugin doesn't offer are dropped; counts are clamped to its limit.
 */
export function sanitizeContextSettings(
  options: NormalizedContextOptions,
  input: readonly ContextSettingInput[],
): OrgContextSettings {
  const result: Partial<Record<ContextKind, OrgContextSetting>> = {};
  for (const { kind, mode, maxCount } of input) {
    const option = options[kind];
    if (option == null) continue;
    if (
      option.maxCountLimit != null &&
      maxCount != null &&
      isPositiveInteger(maxCount)
    ) {
      result[kind] = {
        mode,
        maxCount: Math.min(maxCount, option.maxCountLimit),
      };
    } else {
      result[kind] = { mode };
    }
  }
  return result;
}

/**
 * The config JSON to store on save. Clients can't write CONTEXT_SETTINGS_KEY
 * through the credential; requested settings are validated, and omitted
 * settings keep what was stored before.
 */
export function buildStoredPluginConfig(opts: {
  credential: Readonly<Record<string, unknown>>;
  contextOptions: NormalizedContextOptions | undefined;
  contextSettings: readonly ContextSettingInput[] | undefined;
  existingConfig: Readonly<Record<string, unknown>> | undefined;
}): Record<string, unknown> {
  const { credential, contextOptions, contextSettings, existingConfig } = opts;
  const config = withoutContextSettings(credential);
  if (contextOptions == null) return config;
  const settings =
    contextSettings !== undefined
      ? sanitizeContextSettings(contextOptions, contextSettings)
      : readOrgContextSettings(existingConfig);
  return { ...config, [CONTEXT_SETTINGS_KEY]: settings };
}

/** The config a plugin sees: everything except Coop's context settings. */
export function withoutContextSettings(
  config: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const { [CONTEXT_SETTINGS_KEY]: _omitted, ...rest } = config;
  return rest;
}

export type ResolvedContextOption = Readonly<{
  kind: ContextKind;
  defaultMode: IntegrationContextDefault;
  mode: ContextMode;
  included: boolean;
  maxCount?: number;
  defaultMaxCount?: number;
  maxCountLimit?: number;
}>;

/** Per-kind view of declared options and the org's choices, for the UI. */
export function describeContextOptions(
  options: NormalizedContextOptions | undefined,
  settings: OrgContextSettings,
): ResolvedContextOption[] {
  if (options == null) return [];
  return CONTEXT_KINDS.flatMap((kind) => {
    const option = options[kind];
    if (option == null) return [];
    const setting = settings[kind];
    const mode = setting?.mode ?? 'default';
    // The plugin may have lowered its limit since the org saved a count.
    const maxCount =
      setting?.maxCount != null && option.maxCountLimit != null
        ? Math.min(setting.maxCount, option.maxCountLimit)
        : setting?.maxCount;
    const resolved: ResolvedContextOption = {
      kind,
      defaultMode: option.default,
      mode,
      included:
        mode === 'default' ? option.default === 'include' : mode === 'include',
      ...(maxCount != null ? { maxCount } : {}),
      ...(option.defaultMaxCount != null
        ? { defaultMaxCount: option.defaultMaxCount }
        : {}),
      ...(option.maxCountLimit != null
        ? { maxCountLimit: option.maxCountLimit }
        : {}),
    };
    return [resolved];
  });
}

/**
 * Combines a signal's own contextNeeds (a minimum it always gets) with the
 * org's integration-level choices. Returns undefined when nothing is needed.
 */
export function resolveContextNeeds(
  signalNeeds: SignalContextNeeds | undefined,
  options: NormalizedContextOptions | undefined,
  settings: OrgContextSettings,
): SignalContextNeeds | undefined {
  const byKind = new Map(
    describeContextOptions(options, settings).map((it) => [it.kind, it]),
  );
  const count = (kind: ContextKind) => {
    const option = byKind.get(kind);
    return option?.included
      ? (option.maxCount ?? option.defaultMaxCount)
      : undefined;
  };
  const includeThread =
    signalNeeds?.includeThread === true ||
    byKind.get('thread')?.included === true;
  const includeParent =
    signalNeeds?.includeParent === true ||
    byKind.get('parent')?.included === true;
  const includeFullItem = signalNeeds?.includeFullItem === true;
  if (!includeThread && !includeParent && !includeFullItem) {
    return undefined;
  }
  const maxOf = (a: number | undefined, b: number | undefined) =>
    a == null ? b : b == null ? a : Math.max(a, b);
  const signalThreadMessages = signalNeeds?.includeThread
    ? (signalNeeds.maxThreadMessages ?? DEFAULT_MAX_THREAD_MESSAGES)
    : undefined;
  const maxThreadMessages = maxOf(signalThreadMessages, count('thread'));
  return {
    ...(includeFullItem ? { includeFullItem } : {}),
    ...(includeThread ? { includeThread } : {}),
    ...(includeParent ? { includeParent } : {}),
    ...(includeThread && maxThreadMessages != null
      ? { maxThreadMessages }
      : {}),
  };
}
