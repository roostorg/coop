import { ScalarTypes } from '@roostorg/types';

import { type NonEmptyString } from '../../../utils/typescript-types.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
  type SignalInputType,
} from './SignalBase.js';

export default class UnusedCustomSignal extends SignalBase<SignalInputType> {
  constructor(
    private readonly data: {
      id: NonEmptyString;
      orgId: string;
      name: string;
      description: string;
      callbackUrl: string;
      callbackUrlHeaders: string;
      callbackUrlBody: string;
    },
  ) {
    super();
  }

  get callbackUrl() {
    return this.data.callbackUrl;
  }

  get callbackUrlHeaders() {
    return this.data.callbackUrlHeaders;
  }

  get callbackUrlBody() {
    return this.data.callbackUrlBody;
  }

  get orgId() {
    return this.data.orgId;
  }

  override get id() {
    return { type: SignalType.CUSTOM, id: this.data.id };
  }

  override get displayName() {
    return this.data.name;
  }

  override get description(): string {
    return this.data.description;
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override async getDisabledInfo(): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Custom signals are not supported yet',
    };
  }

  // TODO: update this (or add a new method) to support some notion of eligible
  // item types (i.e., which kind of FULL_ITEMs can this signal handle).
  override get eligibleInputs() {
    return [...Object.values(ScalarTypes), 'FULL_ITEM' as const];
  }

  override get outputType() {
    // TODO: Update this to be fetched directly from the model
    return { scalarType: ScalarTypes.NUMBER };
  }

  override async run(_input: SignalInput<SignalInputType>): Promise<never> {
    throw new Error('Not implemented.');
  }

  override getCost() {
    return 30;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  override get docsUrl() {
    return null;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get needsActionPenalties() {
    return false;
  }

  override get integration() {
    return null;
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsMatchingValues() {
    return false as const;
  }
}
