import { ScalarTypes } from '@roostorg/types';

import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalResult,
  type SignalInput,
  type ImageValue,
} from './SignalBase.js';
import type { Dependencies } from '../../../iocContainer/index.js';
import type { HashBank } from '../../hmaService/dbTypes.js';
import { jsonStringify } from '../../../utils/encoding.js';

export default class ImageSimilarityDoesNotMatchSignal extends SignalBase<
  ScalarTypes['IMAGE'],
  { scalarType: ScalarTypes['BOOLEAN'] }
> {
  constructor(
    private readonly hmaService: Dependencies['HMAHashBankService'],
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.IMAGE_SIMILARITY_DOES_NOT_MATCH };
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  override get displayName() {
    return 'Image does not match hash bank';
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get description() {
    return (
      'Detects whether any images in the content do not match any images in a hash bank.'
    );
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
  }

  override get eligibleInputs() {
    return [ScalarTypes.IMAGE];
  }

  override get needsMatchingValues() {
    return true;
  }

  /**
   * Estimated cost of hashing image and computing similarity score
   */
  override getCost() {
    return 10;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
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

  override async run(
    input: SignalInput<ScalarTypes['IMAGE'], true>,
  ): Promise<SignalResult<{ scalarType: ScalarTypes['BOOLEAN'] }>> {
    const { value, matchingValues } = input;

    // The banks are already loaded and cached by the execution service
    const banks = matchingValues as unknown as HashBank[];

    if (!banks.length) {
      throw new Error('No banks provided for matching');
    }

    // Get the image value and its hashes
    const imageValue = value.value as ImageValue;

    if (!imageValue.hashes || Object.keys(imageValue.hashes).length === 0) {
      throw new Error('No hashes found in image value');
    }

    // Check all available hash types and collect matched banks
    const bankNames = banks.map(bank => bank.hma_name);
    const allMatchedBanks = new Set<string>();
    
    const hashCheckResults = await Promise.all(
      Object.entries(imageValue.hashes).map(async ([signalType, hash]) =>
        this.hmaService.checkImageMatchWithDetails(bankNames, signalType, hash)
      )
    );

    // Collect all matched banks from all hash types
    hashCheckResults.forEach(result => {
      result.matchedBanks.forEach(bank => allMatchedBanks.add(bank));
    });

    const doesNotMatch = allMatchedBanks.size === 0;

    // Map HMA bank names back to user-friendly bank names
    const checkedBankNames = banks.map(b => b.name);
    const matchedBankNames = Array.from(allMatchedBanks).map(hmaName => {
      const bank = banks.find(b => b.hma_name === hmaName);
      return bank?.name ?? hmaName;
    });

    return {
      score: doesNotMatch, // Return true if NONE matched
      outputType: { scalarType: ScalarTypes.BOOLEAN },
      // Store checked banks and any matches as metadata
      matchedValue: jsonStringify({ 
        checkedBanks: checkedBankNames,
        matchedBanks: matchedBankNames.length > 0 ? matchedBankNames : [],
      }),
    };
  }
}
