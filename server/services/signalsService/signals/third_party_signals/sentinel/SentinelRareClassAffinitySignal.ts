import { ScalarTypes } from '@roostorg/coop-types';

import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { type ItemInvestigationService } from '../../../../itemInvestigationService/index.js';
import { type ItemSubmission } from '../../../../itemProcessingService/index.js';
import {
  SentinelServiceError,
  type SentinelService,
} from '../../../../sentinelService/index.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../SignalBase.js';

const SENTINEL_DOCS_URL = 'https://github.com/UMass-Rescue/Sentinel';

/**
 * How many prior thread items to include in Sentinel scoring.
 * More context improves recall for pattern detection but adds latency.
 */
const DEFAULT_THREAD_CONTEXT_LIMIT = 10;

export default class SentinelRareClassAffinitySignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(
    private readonly sentinelService: SentinelService,
    private readonly itemInvestigationService: ItemInvestigationService,
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.SENTINEL_RARE_CLASS_AFFINITY };
  }

  override get displayName() {
    return 'Sentinel Rare Class Affinity';
  }

  override get description() {
    return `Sentinel is a contrastive-learning system that detects rare harmful text patterns (e.g., grooming) by measuring semantic affinity to curated example banks.

It compares submitted content against labeled positive (rare/harmful) and negative (common/normal) examples to produce a score between 0 and 1. Higher scores indicate stronger affinity to the rare class. Thread context is included when available, improving detection of patterns that span multiple messages.`;
  }

  override get docsUrl() {
    return SENTINEL_DOCS_URL;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get supportedLanguages(): 'ALL' {
    return 'ALL';
  }

  override get pricingStructure(): SignalPricingStructure {
    return SignalPricingStructure.FREE;
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  override getCost() {
    return 50;
  }

  override get needsMatchingValues() {
    return false;
  }

  override get eligibleSubcategories(): [] {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get integration() {
    return 'SENTINEL' as const;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  override async getDisabledInfo(_orgId: string) {
    try {
      const health = await this.sentinelService.healthCheck();
      if (health.status !== 'ok' && health.status !== 'healthy') {
        return {
          disabled: true as const,
          disabledMessage:
            'Sentinel service is not healthy. Please ensure the Sentinel server is running and banks are loaded.',
        };
      }

      const banksStatus = await this.sentinelService.getBanksStatus();
      if (!banksStatus.loaded) {
        return {
          disabled: true as const,
          disabledMessage:
            'Sentinel banks are not loaded. Please load the required model banks before using this signal.',
        };
      }

      return { disabled: false as const };
    } catch {
      return {
        disabled: true as const,
        disabledMessage:
          'Sentinel service is unavailable. Please ensure the Sentinel server is running and reachable.',
      };
    }
  }

  async run(
    input: SignalInput<
      ScalarTypes['STRING'],
      false,
      false,
      string,
      'SENTINEL_RARE_CLASS_AFFINITY'
    >,
  ) {
    const { value, orgId, runtimeArgs } = input;

    // The primary text to score is always the signal input value.
    const primaryText = String(value.value);
    const texts: string[] = [primaryText];

    // If thread context is available, fetch prior messages in the thread and
    // include their text in the scoring request. This provides contextual
    // signals that help Sentinel detect patterns spanning multiple messages.
    if (runtimeArgs?.threadIdentifier) {
      try {
        const threadItems =
          this.itemInvestigationService.getThreadSubmissionsByTime({
            orgId,
            threadId: runtimeArgs.threadIdentifier,
            limit: DEFAULT_THREAD_CONTEXT_LIMIT,
          });

        // `submitContent.ts` writes the current submission to the thread's
        // history *before* rules run (so thread-aware signals have context
        // available), and `getThreadSubmissionsByTime` is bounded by time,
        // not by item identity. That means the submission which triggered
        // this very signal run is indistinguishable from real "prior"
        // messages and comes back in `threadItems` too. Drop (at most) one
        // occurrence matching `primaryText` so it isn't double-counted,
        // which would otherwise skew the aggregate score Sentinel computes.
        let skippedSelf = false;
        for await (const { latestSubmission } of threadItems) {
          const itemText = extractTextFromSubmission(
            latestSubmission,
            runtimeArgs.contentTextFieldName,
          );
          if (itemText == null) {
            continue;
          }
          if (!skippedSelf && itemText === primaryText) {
            skippedSelf = true;
            continue;
          }
          texts.push(itemText);
        }
      } catch {
        // Thread context is best-effort. If it fails, we continue with just
        // the primary text rather than failing the entire signal execution.
      }
    }

    try {
      const response = await this.sentinelService.scoreTexts({ texts });
      return {
        outputType: { scalarType: ScalarTypes.NUMBER },
        score: response.rare_class_affinity_score,
      };
    } catch (error) {
      if (error instanceof SentinelServiceError) {
        return {
          type: 'ERROR' as const,
          score: makeSignalPermanentError('Sentinel scoring failed', {
            detail: error.message,
            shouldErrorSpan: false,
          }),
        };
      }
      throw error;
    }
  }
}

/**
 * Extract the text to score from an ItemSubmission.
 *
 * If a specific `contentTextFieldName` is given (derived from the condition's
 * input field), we look up that field by name. Otherwise, we collect the first
 * string-valued field we can find. Returns `undefined` if no suitable text is
 * found.
 */
function extractTextFromSubmission(
  submission: ItemSubmission,
  contentTextFieldName?: string,
): string | undefined {
  const data = submission.data as Record<string, unknown>;

  if (contentTextFieldName != null) {
    const rawValue = data[contentTextFieldName];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue;
    }
    return undefined;
  }

  // Fall back: return the first string field value in the item's data.
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}
