import { ScalarTypes } from '@roostorg/types';

import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../SignalBase.js';
import {
  runZentropiLabelerImpl,
  zentropiDocsUrl,
  zentropiEligibleSubcategories,
  zentropiGetDisabledInfo,
  zentropiIntegration,
  zentropiNeedsActionPenalties,
  zentropiNeedsMatchingValues,
  zentropiPricingStructure,
  zentropiRecommendedThresholds,
  zentropiSupportedLanguages,
  type FetchZentropiScores,
} from './zentropiUtils.js';

export default class ZentropiLabelerSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(
    protected readonly getZentropiCredentials: CachedGetCredentials<'ZENTROPI'>,
    protected readonly getZentropiScores: FetchZentropiScores,
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
      'Policy-steerable content classifier powered by Zentropi. ' +
      'Evaluates text against a custom policy defined by a published labeler. ' +
      'Returns a composite score: 0 = confidently safe, 0.5 = uncertain, 1 = confidently violating. ' +
      'Specify the labeler_version_id in the subcategory field.'
    );
  }

  override get docsUrl() {
    return zentropiDocsUrl();
  }

  override get integration() {
    return zentropiIntegration();
  }

  override get pricingStructure() {
    return zentropiPricingStructure();
  }

  override get recommendedThresholds() {
    return zentropiRecommendedThresholds();
  }

  override get supportedLanguages() {
    return zentropiSupportedLanguages();
  }

  override get eligibleSubcategories() {
    return zentropiEligibleSubcategories();
  }

  override get needsActionPenalties() {
    return zentropiNeedsActionPenalties();
  }

  override get needsMatchingValues() {
    return zentropiNeedsMatchingValues();
  }

  override async getDisabledInfo(orgId: string) {
    return zentropiGetDisabledInfo(orgId, this.getZentropiCredentials);
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
    );
  }
}
