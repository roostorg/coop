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
  }
> {
  constructor(
    private readonly userStrikeService: Dependencies['UserStrikeService'],
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
    return { disabled: false as const };
  }

  override get displayName() {
    return 'Number of Strikes Received by User';
  }

  override get description() {
    return `Returns the number of strikes this user has received due to violating user policies.`;
  }

  get pricingStructure() {
    return SignalPricingStructure.FREE;
  }

  override get outputType() {
    return {
      scalarType: ScalarTypes.NUMBER,
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

  override get allowedInAutomatedRules() {
    return true;
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
      score: await this.userStrikeService.getUserStrikeValue(
        input.orgId,
        userItemIdentifier,
      ),
      outputType: {
        scalarType: ScalarTypes.NUMBER,
        enum: USER_SCORE_OUTPUTS,
        ordered: true as const,
      },
    };
  }
}
