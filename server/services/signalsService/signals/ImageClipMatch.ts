import { ScalarTypes } from '@roostorg/coop-types';

import type { Dependencies } from '../../../iocContainer/index.js';
import { jsonStringify } from '../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../utils/errors.js';
import type { HashBank } from '../../hmaService/dbTypes.js';
import { isClipEmbedding } from '../../hmaService/index.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type ImageValue,
  type SignalInput,
  type SignalResult,
} from './SignalBase.js';

export default class ImageClipMatchSignal extends SignalBase<
  ScalarTypes['IMAGE'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(private readonly hmaService: Dependencies['HMAHashBankService']) {
    super();
  }

  override get id() {
    return { type: SignalType.IMAGE_CLIP_MATCH };
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  override get displayName() {
    return 'Image similarity (CLIP)';
  }

  override get description() {
    return (
      'Compares what an image shows with the images in the selected banks, ' +
      'and scores how similar the closest one is, from 0 to 1. ' +
      'Images that are not close enough to any image in the banks score 0. ' +
      'By default only images that are at least 90% similar get a score, so ' +
      'a rule can ask for a closer match than that, but not a looser one. ' +
      'Only images submitted, and added to a bank, while CLIP is enabled on ' +
      'the deployment can be compared.'
    );
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  /**
   * The signal is listed everywhere, but only works where the operator has
   * deployed HMA with CLIP and set HMA_CLIP_ENABLED.
   */
  override async getDisabledInfo() {
    return this.hmaService.isClipEnabled()
      ? { disabled: false as const }
      : {
          disabled: true as const,
          disabledMessage:
            'CLIP is not enabled on this deployment. See the "HMA with CLIP" guide in the docs to turn it on.',
        };
  }

  override get eligibleInputs() {
    return [ScalarTypes.IMAGE];
  }

  override get needsMatchingValues() {
    return true;
  }

  /**
   * Estimated cost of looking an embedding up in the banks. The embedding
   * itself is created when the image is submitted.
   */
  override getCost() {
    return 10;
  }

  override get allowedInAutomatedRules() {
    return true;
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
  ): Promise<SignalResult<{ scalarType: ScalarTypes['NUMBER'] }>> {
    const { value, matchingValues } = input;

    // The banks are already loaded and cached by the execution service.
    const banks = matchingValues as unknown as HashBank[];

    // Each of these is a case where no score can be determined, so retrying
    // cannot help. They are expected, so they do not mark the span as failed.
    if (banks.length === 0) {
      throw makeSignalPermanentError('No hash banks were selected', {
        detail: 'This signal needs at least one hash bank to compare with.',
        shouldErrorSpan: false,
      });
    }
    if (!this.hmaService.isClipEnabled()) {
      throw makeSignalPermanentError('CLIP is not available', {
        detail: 'This deployment has not enabled CLIP (HMA_CLIP_ENABLED).',
        shouldErrorSpan: false,
      });
    }
    const embedding = (value.value as ImageValue).embeddings?.clip_float;
    if (!isClipEmbedding(embedding)) {
      throw makeSignalPermanentError('This image has no CLIP embedding', {
        detail:
          'Embeddings are only created for images submitted while CLIP is ' +
          'enabled on the deployment, so this image cannot be compared.',
        shouldErrorSpan: false,
      });
    }

    // An error from HMA is deliberately not caught: it is not a
    // reason to say there is no match, and the engine may retry it.
    const { matchedBanks, closestDistance } =
      await this.hmaService.findClosestClipMatch(
        banks.map((bank) => bank.hma_name),
        embedding,
      );

    // Cosine distance 0 is identical and 1 is unrelated, so 1 - distance reads
    // as a similarity. Nothing close enough to any bank is a 0.
    const score =
      closestDistance === undefined
        ? 0
        : Math.min(1, Math.max(0, 1 - closestDistance));

    // Map HMA bank names back to user-friendly bank names
    const matchedBankNames = matchedBanks.map(
      (hmaName) =>
        banks.find((bank) => bank.hma_name === hmaName)?.name ?? hmaName,
    );

    return {
      score,
      outputType: { scalarType: ScalarTypes.NUMBER },
      // Store matched banks as metadata for frontend display
      matchedValue:
        matchedBankNames.length > 0
          ? jsonStringify({ matchedBanks: matchedBankNames })
          : undefined,
    };
  }
}
