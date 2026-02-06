import { ScalarTypes } from '@roostorg/types';

// import { filterNullOrUndefined } from '../../../utils/collections.js';
// import {
//   isCoopErrorOfType,
//   makeSignalPermanentError,
// } from '../../../utils/errors.js';
import { Language } from '../../../utils/language.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
} from './SignalBase.js';

// const riskModelAttributes = ['IDENTITY_ATTACK', 'INSULT', 'THREAT'] as const;

// const RISK_MODEL_ORDERED_OUTPUTS = [
//   'Very High',
//   'High',
//   'Medium',
//   'Low',
//   'Very Low',
//   'Extremely Low',
// ];

export default class CoopRiskModelSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
  // { scalarType: ScalarTypes['STRING']; enum: string[]; ordered: true }
> {
  get docsUrl() {
    return null;
  }

  get eligibleSubcategories() {
    return [];
  }

  override get integration() {
    return null;
  }

  get recommendedThresholds() {
    return {
      // highPrecisionThreshold: 'Very High',
      // highRecallThreshold: 'Medium',
      highPrecisionThreshold: '0.95',
      highRecallThreshold: '0.8',
    };
  }

  get needsMatchingValues() {
    return false;
  }

  override get id() {
    return { type: SignalType.BENIGN_MODEL };
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get outputType() {
    return {
      scalarType: ScalarTypes.NUMBER,
      // enum: RISK_MODEL_ORDERED_OUTPUTS,
      // ordered: true as const,
    };
  }

  override get displayName() {
    return 'Coop Harassment AI Model';
  }

  override async getDisabledInfo(_orgId: string): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Please contact Coop to try our new Coop AI product!',
    };
  }

  override get description() {
    return 'Your custom Coop Harassment AI model, trained on your data, your Harassment policy, and your labeled examples.';
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get supportedLanguages(): Language[] | 'ALL' {
    return [
      Language.ENGLISH,
      Language.FRENCH,
      Language.GERMAN,
      Language.ITALIAN,
      Language.PORTUGUESE,
      Language.RUSSIAN,
      Language.SPANISH,
      Language.HINDI,
      Language.KOREAN,
      Language.POLISH,
      Language.PORTUGUESE,
      Language.ARABIC,
      Language.CHINESE,
      Language.CZECH,
      Language.DUTCH,
      Language.INDONESIAN,
      Language.JAPANESE,
    ];
  }

  override getCost() {
    return 15;
  }

  override get needsActionPenalties() {
    return false as const;
  }

  override async run(_input: SignalInput<ScalarTypes['STRING']>) {
    return {
      score: 0.5,
      outputType: { scalarType: ScalarTypes.NUMBER },
    };
    // const { value } = input;
    // const outputType = {
    //   scalarType: ScalarTypes.STRING,
    //   enum: RISK_MODEL_ORDERED_OUTPUTS,
    //   ordered: true as const,
    // };
    // try {
    //   // Perspective throws an error when given an empty string input, so
    //   // we just return the max score of 5 immediately
    //   if (value.value.length === 0) {
    //     return {
    //       score: 'Very Low',
    //       outputType,
    //     };
    //   }

    //   const result = await this.getPerspectiveScores(
    //     process.env.PERSPECTIVE_API_KEY!,
    //     value.value,
    //   );

    //   if (result.type === 'UNSUPPORTED_LANGUAGE') {
    //     throw makeSignalPermanentError(
    //       `Unable to evaluate content: ${value.value}`,
    //     );
    //   }

    //   const attributeScores = filterNullOrUndefined(
    //     riskModelAttributes.map((attribute) =>
    //       result.attributeMap.get(attribute),
    //     ),
    //   );

    //   if (attributeScores.length === 0) {
    //     throw makeSignalPermanentError(
    //       `Undefined scores for content: ${value.value}`,
    //     );
    //   }

    //   const maxScore = Math.max(...attributeScores);
    //   const finalScore =
    //     maxScore > 0.8
    //       ? 'Very High'
    //       : maxScore > 0.6
    //       ? 'High'
    //       : maxScore > 0.3
    //       ? 'Medium'
    //       : maxScore > 0.1
    //       ? 'Low'
    //       : maxScore > 0.036
    //       ? 'Very Low'
    //       : 'Extremely Low';

    //   return {
    //     score: finalScore,
    //     outputType,
    //   };
    // } catch (e) {
    //   if (isCoopErrorOfType(e, 'SignalPermanentError')) {
    //     return { score: e, type: 'ERROR' as const };
    //   }

    //   throw e;
    // }
  }
}
