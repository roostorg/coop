/**
 * Adapts a plugin's PluginSignalDescriptor to the server's SignalBase so plugin
 * signals can be registered and used in routing/enforcement rules.
 */

import type {
  PluginSignalDescriptor,
  SignalSubcategory,
} from '@roostorg/coop-types';
import { type ReadonlyDeep } from 'type-fest';

import { type Language } from '../../../utils/language.js';
import { type SignalOutputType } from '../types/SignalOutputType.js';
import { type SignalPricingStructure } from '../types/SignalPricingStructure.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalErrorResult,
  type SignalInput,
  type SignalInputType,
  type SignalResult,
} from './SignalBase.js';

export type { PluginSignalDescriptor };

/**
 * Rejects policy lists the one-level tree can't represent, so a plugin with a
 * bad list fails at load instead of policies silently disappearing.
 */
export function assertValidPolicies(
  signalId: string,
  flat: ReadonlyDeep<PluginSignalDescriptor['eligibleSubcategories']>,
) {
  const fail: (reason: string) => never = (reason) => {
    throw new Error(
      `Plugin signal "${signalId}" has invalid policies: ${reason}`,
    );
  };
  const byId = new Map(flat.map((it) => [it.id, it]));
  if (byId.size !== flat.length) fail('policy IDs must be unique.');
  const parents = new Map<string, string>();
  for (const policy of flat) {
    for (const childId of policy.childrenIds) {
      const child = byId.get(childId);
      if (child == null) {
        return fail(`"${policy.id}" lists unknown child "${childId}".`);
      }
      if (child.childrenIds.length > 0) {
        fail(`"${childId}" is a child and can't have children of its own.`);
      }
      if (parents.has(childId)) fail(`"${childId}" has more than one parent.`);
      parents.set(childId, policy.id);
    }
  }
}

/**
 * Plugins describe subcategories as a flat list with `childrenIds`; the server
 * works with a tree (one level deep, like third-party label taxonomies).
 * Entries that aren't referenced as a child are roots.
 */
function toSubcategoryTree(
  flat: ReadonlyDeep<PluginSignalDescriptor['eligibleSubcategories']>,
): SignalSubcategory[] {
  const byId = new Map(flat.map((it) => [it.id, it]));
  const childIds = new Set(flat.flatMap((it) => it.childrenIds));
  return flat
    .filter((it) => !childIds.has(it.id))
    .map((root) => ({
      id: root.id,
      label: root.label,
      ...(root.description != null ? { description: root.description } : {}),
      children: root.childrenIds.flatMap((childId) => {
        const child = byId.get(childId);
        return child
          ? [
              {
                id: child.id,
                label: child.label,
                ...(child.description != null
                  ? { description: child.description }
                  : {}),
                children: [],
              },
            ]
          : [];
      }),
    }));
}

/**
 * Wraps a plugin-provided descriptor so it satisfies SignalBase and can be
 * registered in the signals map and used by the rule engine.
 */
export default class PluginSignalAdapter extends SignalBase<
  SignalInputType,
  SignalOutputType,
  unknown,
  string
> {
  constructor(
    private readonly descriptor: ReadonlyDeep<PluginSignalDescriptor>,
  ) {
    super();
    assertValidPolicies(descriptor.id.type, descriptor.eligibleSubcategories);
  }

  override get id() {
    return this.descriptor.id;
  }

  override get displayName() {
    return this.descriptor.displayName;
  }

  override get description() {
    return this.descriptor.description;
  }

  override get docsUrl() {
    return this.descriptor.docsUrl;
  }

  override get recommendedThresholds() {
    return this.descriptor.recommendedThresholds;
  }

  override get supportedLanguages() {
    const L = this.descriptor.supportedLanguages;
    return (L === 'ALL' ? 'ALL' : L) as readonly Language[] | 'ALL';
  }

  override get pricingStructure() {
    return this.descriptor
      .pricingStructure as unknown as SignalPricingStructure;
  }

  override get eligibleInputs() {
    return this.descriptor.eligibleInputs as readonly SignalInputType[];
  }

  override get outputType() {
    return this.descriptor.outputType as SignalOutputType;
  }

  override getCost() {
    return this.descriptor.getCost();
  }

  override async run(
    input: SignalInput,
  ): Promise<SignalResult<SignalOutputType> | SignalErrorResult> {
    const result = await this.descriptor.run(input);
    return result as SignalResult<SignalOutputType> | SignalErrorResult;
  }

  override async getDisabledInfo(orgId: string): Promise<SignalDisabledInfo> {
    return this.descriptor.getDisabledInfo(
      orgId,
    ) as Promise<SignalDisabledInfo>;
  }

  override get needsMatchingValues() {
    return this.descriptor.needsMatchingValues;
  }

  override get eligibleSubcategories(): ReadonlyDeep<SignalSubcategory[]> {
    this.#subcategoryTree ??= toSubcategoryTree(
      this.descriptor.eligibleSubcategories,
    );
    return this.#subcategoryTree;
  }

  #subcategoryTree: ReadonlyDeep<SignalSubcategory[]> | undefined;

  override get needsActionPenalties() {
    return this.descriptor.needsActionPenalties;
  }

  override get integration() {
    return this.descriptor.integration;
  }

  override get allowedInAutomatedRules() {
    return this.descriptor.allowedInAutomatedRules;
  }

  override get contextNeeds() {
    return this.descriptor.contextNeeds;
  }
}
