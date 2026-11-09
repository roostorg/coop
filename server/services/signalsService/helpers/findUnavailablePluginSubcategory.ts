import { makeSignalPermanentError } from '../../../utils/errors.js';
import type PluginSignalAdapter from '../signals/PluginSignalAdapter.js';
import type { SignalErrorResult } from '../signals/SignalBase.js';

export function findUnavailablePluginSubcategory(
  signal: PluginSignalAdapter,
  subcategory: string | undefined,
): SignalErrorResult | undefined {
  if (subcategory == null) return undefined;

  const eligibleIds = new Set(
    signal.eligibleSubcategories.flatMap((item) => [
      item.id,
      ...item.children.map((child) => child.id),
    ]),
  );
  if (eligibleIds.has(subcategory)) return undefined;

  return {
    type: 'ERROR',
    score: makeSignalPermanentError(
      `Policy "${subcategory}" is no longer available for ${signal.displayName}. Update the rules that use it.`,
      { shouldErrorSpan: false },
    ),
  };
}
