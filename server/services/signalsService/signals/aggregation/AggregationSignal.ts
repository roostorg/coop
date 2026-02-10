import { ScalarTypes } from '@roostorg/types';

import { type Dependencies } from '../../../../iocContainer/index.js';
import { makeSignalPermanentError } from '../../../../utils/errors.js';
import type { SignalOutputType } from '../../types/SignalOutputType.js';
import { SignalPricingStructure } from '../../types/SignalPricingStructure.js';
import { SignalType } from '../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../SignalBase.js';

export default class AggregationSignal extends SignalBase<
  'FULL_ITEM',
  SignalOutputType,
  unknown,
  'AGGREGATION'
> {
  constructor(
    private readonly aggregationsService: Dependencies['AggregationsService'],
  ) {
    super();
  }
  get id() {
    return {
      type: SignalType.AGGREGATION,
    };
  }

  get pricingStructure() {
    return SignalPricingStructure.FREE;
  }

  get supportedLanguages() {
    return 'ALL' as const;
  }
  get description(): string {
    // TODO: Implement
    return 'Aggregation over a set of items';
  }

  get displayName(): string {
    // TODO: implement
    return 'Aggregation';
  }

  get docsUrl(): string | null {
    return null;
  }

  get eligibleInputs(): 'FULL_ITEM'[] {
    return ['FULL_ITEM'];
  }

  get eligibleSubcategories() {
    return [];
  }

  getCost(): number {
    return 0;
  }

  get allowedInAutomatedRules() {
    return true;
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
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

  override get needsMatchingValues() {
    return false as const;
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  override async run(
    input: SignalInput<'FULL_ITEM', boolean, boolean, unknown, 'AGGREGATION'>,
  ) {
    if (!input.args?.aggregationClause) {
      throw makeSignalPermanentError(
        `should have aggregation clause in input, but input was ${input}`,
        { shouldErrorSpan: true },
      );
    }

    if (!input.runtimeArgs) {
      throw makeSignalPermanentError(
        `should have runtime args in input, but input was ${input}`,
        { shouldErrorSpan: true },
      );
    }

    const value = await this.aggregationsService.evaluateAggregation(
      input.args.aggregationClause,
      input.runtimeArgs,
    );

    if (!value) {
      throw makeSignalPermanentError(
        `failed to evaluation aggregation ${input.args.aggregationClause}`,
        { shouldErrorSpan: true },
      );
    }

    return {
      score: value,
      outputType: { scalarType: ScalarTypes.NUMBER },
    };
  }
}
