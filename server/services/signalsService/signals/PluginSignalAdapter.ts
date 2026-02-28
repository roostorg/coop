/**
 * Adapts a plugin's PluginSignalDescriptor to the server's SignalBase so plugin
 * signals can be registered and used in routing/enforcement rules.
 */

import type { SignalSubcategory } from '@roostorg/types';
import { type ReadonlyDeep } from 'type-fest';

import { type Language } from '../../../utils/language.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalErrorResult,
  type SignalInput,
  type SignalInputType,
  type SignalResult,
} from './SignalBase.js';
import { type SignalOutputType } from '../types/SignalOutputType.js';
import { type SignalPricingStructure } from '../types/SignalPricingStructure.js';

/** Minimal descriptor shape from a plugin; matches @roostorg/types PluginSignalDescriptor. */
export type PluginSignalDescriptor = Readonly<{
  id: { type: string };
  displayName: string;
  description: string;
  docsUrl: string | null;
  recommendedThresholds: Readonly<{
    highPrecisionThreshold: string | number;
    highRecallThreshold: string | number;
  }> | null;
  supportedLanguages: readonly string[] | 'ALL';
  pricingStructure: { type: 'FREE' | 'SUBSCRIPTION' };
  eligibleInputs: readonly string[];
  outputType: Readonly<{ scalarType: string }>;
  getCost: () => number;
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
  integration: string;
  allowedInAutomatedRules: boolean;
}>;

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
    return this.descriptor.pricingStructure as unknown as SignalPricingStructure;
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
    return this.descriptor.getDisabledInfo(orgId) as Promise<SignalDisabledInfo>;
  }

  override get needsMatchingValues() {
    return this.descriptor.needsMatchingValues;
  }

  override get eligibleSubcategories() {
    return this.descriptor.eligibleSubcategories as unknown as ReadonlyDeep<
      SignalSubcategory[]
    >;
  }

  override get needsActionPenalties() {
    return this.descriptor.needsActionPenalties;
  }

  override get integration() {
    return this.descriptor.integration;
  }

  override get allowedInAutomatedRules() {
    return this.descriptor.allowedInAutomatedRules;
  }
}
