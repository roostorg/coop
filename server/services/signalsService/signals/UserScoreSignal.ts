import { ScalarTypes } from '@roostorg/types';

import { type Dependencies } from '../../../iocContainer/index.js';
import { SignalPricingStructure } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, { type SignalInput } from './SignalBase.js';

export const USER_SCORE_OUTPUTS = [1, 2, 3, 4, 5];

export default class UserScoreSignal extends SignalBase<
  ScalarTypes['USER_ID'],
  {
    scalarType: ScalarTypes['NUMBER'];
    enum: typeof USER_SCORE_OUTPUTS;
    ordered: boolean;
  }
> {
  constructor(
    private readonly getUserScore: Dependencies['getUserScoreEventuallyConsistent'],
  ) {
    super();
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  override get id() {
    return { type: SignalType.USER_SCORE };
  }

  override async getDisabledInfo() {
    return {
      disabled: true as const,
      disabledMessage:
        'This signal is deprecated. Please use the User Strike system and User Strike Signal for similary functionality.',
    };
  }

  override get displayName() {
    return 'User Quality score';
  }

  override get description() {
    return `Returns a user quality score (an integer from 1-5) for the user who created this content.

      Coop computes quality scores for every user that creates content sent to Coop. Every time a user posts something that receives a penalizing action (e.g. Delete, Mute, Shadow Ban, etc.), we `;
  }

  get pricingStructure() {
    return SignalPricingStructure.FREE;
  }

  override get outputType() {
    return {
      scalarType: ScalarTypes.NUMBER,
      enum: USER_SCORE_OUTPUTS,
      ordered: true as const,
    };
  }

  override get eligibleInputs() {
    return [ScalarTypes.USER_ID];
  }

  override get needsActionPenalties() {
    return false as const;
  }

  override get needsMatchingValues() {
    return false as const;
  }

  override getCost() {
    return 10;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get docsUrl() {
    return null;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get integration() {
    return null;
  }

  async run(input: SignalInput<ScalarTypes['USER_ID'], false, false>) {
    const userItemIdentifier = input.value.value;

    return {
      score: await this.getUserScore(input.orgId, userItemIdentifier),
      outputType: {
        scalarType: ScalarTypes.NUMBER,
        enum: USER_SCORE_OUTPUTS,
        ordered: true as const,
      },
    };
  }
}
