import { ScalarTypes } from '@roostorg/coop-types';

import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../types/Integration.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../SignalBase.js';
import { type FetchOpenAICompatibleScore } from '../openai_compatible/openaiCompatibleUtils.js';
import {
  runZentropiLabelerImpl,
  type FetchZentropiScores,
  type GetPolicyText,
} from './zentropiUtils.js';

export default class ZentropiLabelerSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(
    protected readonly getZentropiCredentials: CachedGetCredentials<'ZENTROPI'>,
    protected readonly getZentropiScores: FetchZentropiScores,
    protected readonly fetchOpenAICompatibleScore: FetchOpenAICompatibleScore,
    protected readonly getPolicyText: GetPolicyText,
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.ZENTROPI_LABELER };
  }

  override get displayName() {
    return 'Zentropi Labeler';
  }

  override get description() {
    return (
      'Policy-steerable content classifier powered by the CoPE model. ' +
      'Evaluates text against a custom policy. ' +
      'Returns a composite score: 0 = confidently safe, 0.5 = uncertain, 1 = confidently violating. ' +
      'For Zentropi hosted: specify the labeler_version_id in the subcategory field. ' +
      'For self-hosted: specify the policy criteria text in the subcategory field.'
    );
  }

  override get docsUrl() {
    return 'https://docs.zentropi.ai';
  }

  override get integration() {
    return Integration.ZENTROPI;
  }

  override get pricingStructure() {
    return SignalPricingStructure.SUBSCRIPTION;
  }

  override get recommendedThresholds() {
    return {
      highPrecisionThreshold: 0.8,
      highRecallThreshold: 0.6,
    };
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get needsMatchingValues() {
    return false;
  }

  override async getDisabledInfo(orgId: string) {
    const credential = await this.getZentropiCredentials(orgId);
    if (credential?.selfHosted != null) {
      return { disabled: false as const };
    }
    return !credential?.apiKey
      ? {
          disabled: true as const,
          disabledMessage:
            'You need to configure either a Zentropi API key or a self-hosted model endpoint to use this signal',
        }
      : { disabled: false as const };
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  /**
   * Placeholder estimate
   */
  override getCost() {
    return 20;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  async run(input: SignalInput<ScalarTypes['STRING']>) {
    return runZentropiLabelerImpl(
      this.getZentropiCredentials,
      input,
      this.getZentropiScores,
      this.fetchOpenAICompatibleScore,
      this.getPolicyText,
    );
  }
}
