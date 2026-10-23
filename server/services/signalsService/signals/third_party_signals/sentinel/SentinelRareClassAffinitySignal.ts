import { ScalarTypes } from '@roostorg/coop-types';

import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { isValidUrl } from '../../../../../utils/url.js';
import { type ItemInvestigationService } from '../../../../itemInvestigationService/index.js';
import { type ItemSubmission } from '../../../../itemProcessingService/index.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import {
  makeSentinelService,
  SentinelServiceError,
} from '../../../../sentinelService/index.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../SignalBase.js';

const SENTINEL_DOCS_URL = 'https://github.com/Roblox/sentinel';

/** Prior thread messages included in scoring when the org sets no limit. */
const DEFAULT_THREAD_CONTEXT_LIMIT = 10;

/** Upper bound on prior messages, so a saved config cannot trigger a huge thread scan. */
const MAX_THREAD_CONTEXT_LIMIT = 100;

/**
 * Per-org Sentinel settings, stored as plain JSON since none are secret. A saved
 * config (even `{}`) means the org enabled Sentinel; without a valid http(s)
 * `apiUrl` the signal is disabled.
 */
type SentinelOrgConfig = {
  apiUrl?: string;
  topK?: number;
  minScoreToConsider?: number;
  threadContextWindowMinutes?: number;
  threadContextLimit?: number;
};

/** Returns an org's raw Sentinel config, or undefined if not enabled. */
type GetSentinelConfig = (
  orgId: string,
) => Promise<Record<string, unknown> | undefined>;

function parseSentinelConfig(
  raw: Record<string, unknown> | undefined,
): SentinelOrgConfig | undefined {
  if (raw == null) {
    return undefined;
  }
  const config: SentinelOrgConfig = {};
  if (typeof raw.apiUrl === 'string' && isValidUrl(raw.apiUrl.trim())) {
    config.apiUrl = raw.apiUrl.trim();
  }
  if (typeof raw.topK === 'number' && Number.isFinite(raw.topK)) {
    config.topK = raw.topK;
  }
  if (
    typeof raw.minScoreToConsider === 'number' &&
    Number.isFinite(raw.minScoreToConsider)
  ) {
    config.minScoreToConsider = raw.minScoreToConsider;
  }
  if (
    typeof raw.threadContextWindowMinutes === 'number' &&
    Number.isFinite(raw.threadContextWindowMinutes) &&
    raw.threadContextWindowMinutes > 0
  ) {
    config.threadContextWindowMinutes = raw.threadContextWindowMinutes;
  }
  if (
    typeof raw.threadContextLimit === 'number' &&
    Number.isFinite(raw.threadContextLimit) &&
    raw.threadContextLimit > 0
  ) {
    config.threadContextLimit = Math.min(
      raw.threadContextLimit,
      MAX_THREAD_CONTEXT_LIMIT,
    );
  }
  return config;
}

export default class SentinelRareClassAffinitySignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(
    private readonly getSentinelConfig: GetSentinelConfig,
    private readonly fetchHTTP: FetchHTTP,
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

  override async getDisabledInfo(orgId: string) {
    const config = parseSentinelConfig(await this.getSentinelConfig(orgId));
    if (config == null) {
      return {
        disabled: true as const,
        disabledMessage:
          'Sentinel is not enabled for this organization. Add it from the Integrations page to use this signal.',
      };
    }

    const apiUrl = config.apiUrl;
    if (apiUrl == null) {
      return {
        disabled: true as const,
        disabledMessage:
          'No valid Sentinel API URL is configured. Set an http(s) URL that is not a loopback address on the Integrations page.',
      };
    }

    try {
      const sentinelService = makeSentinelService(this.fetchHTTP, apiUrl);
      const health = await sentinelService.healthCheck();
      if (health.status !== 'ok' && health.status !== 'healthy') {
        return {
          disabled: true as const,
          disabledMessage:
            'Sentinel service is not healthy. Please ensure the Sentinel server is running and banks are loaded.',
        };
      }

      if (!health.banks_loaded) {
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
    const config =
      parseSentinelConfig(await this.getSentinelConfig(orgId)) ?? {};
    const apiUrl = config.apiUrl;

    if (apiUrl == null) {
      // Permanent: retrying cannot fix a missing URL.
      return {
        type: 'ERROR' as const,
        score: makeSignalPermanentError('Sentinel is not configured', {
          detail:
            'No valid Sentinel API URL is configured for this organization.',
          shouldErrorSpan: false,
        }),
      };
    }

    const sentinelService = makeSentinelService(this.fetchHTTP, apiUrl);

    const primaryText = String(value.value);
    const texts: string[] = [primaryText];

    // Include earlier messages from the same thread, since the patterns span messages.
    if (runtimeArgs?.threadIdentifier) {
      try {
        const priorLimit =
          config.threadContextLimit ?? DEFAULT_THREAD_CONTEXT_LIMIT;
        const threadItems =
          this.itemInvestigationService.getThreadSubmissionsByTime({
            orgId,
            threadId: runtimeArgs.threadIdentifier,
            // One extra, since the triggering message takes a slot and is skipped.
            limit: priorLimit + 1,
            ...(runtimeArgs.submissionTime != null
              ? { newestReturnedSubmissionDate: runtimeArgs.submissionTime }
              : {}),
            ...(config.threadContextWindowMinutes != null
              ? {
                  oldestReturnedSubmissionDate: new Date(
                    Date.now() - config.threadContextWindowMinutes * 60_000,
                  ),
                }
              : {}),
          });

        // The triggering submission is already stored in the thread, so skip
        // one copy of it to avoid counting it twice.
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
          if (texts.length > priorLimit) {
            break;
          }
        }
      } catch {
        // Best-effort: score the primary text alone if thread history fails.
      }
    }

    try {
      const response = await sentinelService.scoreTexts({
        texts,
        top_k: config.topK,
        min_score_to_consider: config.minScoreToConsider,
      });
      return {
        outputType: { scalarType: ScalarTypes.NUMBER },
        score: response.rare_class_affinity_score,
      };
    } catch (error) {
      if (error instanceof SentinelServiceError) {
        // Permanent: without a valid score, the signal cannot score this input.
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
 * Returns the text to score: the field named `contentTextFieldName` if given,
 * else the first non-empty string field. Undefined if there is none.
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

  // No field name: use the first non-empty string field.
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}
