import { ScalarTypes } from '@roostorg/types';

import { jsonStringify } from '../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { type Bind1 } from '../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../types/Integration.js';
import { type RecommendedThresholds } from '../../../types/RecommendedThresholds.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { type SignalDisabledInfo, type SignalInput } from '../../SignalBase.js';

export interface ZentropiResponse {
  label: 0 | 1 | '0' | '1';
  confidence: number;
  explanation?: string;
}

export type FetchZentropiScores = Bind1<
  typeof getZentropiScores,
  FetchHTTP
>;

export async function getZentropiScores(
  fetchHTTP: FetchHTTP,
  params: {
    text: string;
    apiKey: string;
    labelerVersionId: string;
  },
): Promise<ZentropiResponse> {
  const response = await fetchHTTP({
    url: 'https://api.zentropi.ai/v1/label',
    method: 'post',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: jsonStringify({
      content_text: params.text,
      labeler_version_id: params.labelerVersionId,
    }),
    handleResponseBody: 'as-json',
    timeoutMs: 5_000,
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 401) {
      throw makeSignalPermanentError(
        `Zentropi API error: ${response.status}${
          response.status === 404
            ? ' (invalid labeler_version_id)'
            : ' (invalid API key)'
        }`,
        { shouldErrorSpan: true },
      );
    }
    throw new Error(`Zentropi API error: ${response.status}`);
  }

  return response.body as unknown as ZentropiResponse;
}

export async function runZentropiLabelerImpl(
  getZentropiCredentials: CachedGetCredentials<'ZENTROPI'>,
  input: SignalInput<ScalarTypes['STRING']>,
  fetchScores: FetchZentropiScores,
) {
  const { value, orgId, subcategory } = input;

  const credential = await getZentropiCredentials(orgId);
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (!credential?.apiKey) {
    throw new Error('Missing Zentropi API credentials');
  }

  if (!subcategory) {
    throw new Error(
      'Missing labeler_version_id in subcategory. ' +
        'Specify a Zentropi labeler_version_id in the condition subcategory field.',
    );
  }

  const response = await fetchScores({
    text: value.value,
    apiKey: credential.apiKey,
    labelerVersionId: subcategory,
  });

  // Composite score mapping:
  // label=1 (violating) → pass confidence through
  // label=0 (safe) → invert confidence
  // Result: 0 = confidently safe, 0.5 = uncertain, 1 = confidently violating
  const { label, confidence } = response;
  const score = Number(label) === 1 ? confidence : 1 - confidence;

  return {
    score,
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}

export function zentropiDocsUrl(): string {
  return 'https://docs.zentropi.ai';
}

export function zentropiIntegration(): Integration {
  return Integration.ZENTROPI;
}

export function zentropiPricingStructure(): SignalPricingStructure {
  return SignalPricingStructure.SUBSCRIPTION;
}

export function zentropiRecommendedThresholds(): RecommendedThresholds {
  return {
    highPrecisionThreshold: 0.8,
    highRecallThreshold: 0.6,
  };
}

export function zentropiSupportedLanguages(): 'ALL' {
  return 'ALL';
}

export function zentropiEligibleSubcategories() {
  return [];
}

export function zentropiNeedsActionPenalties() {
  return false;
}

export function zentropiNeedsMatchingValues() {
  return false;
}

export async function zentropiGetDisabledInfo(
  orgId: string,
  getZentropiCredentials: CachedGetCredentials<'ZENTROPI'>,
): Promise<SignalDisabledInfo> {
  const credential = await getZentropiCredentials(orgId);
  return !credential?.apiKey
    ? {
        disabled: true as const,
        disabledMessage:
          'You need to input your Zentropi API key to use Zentropi signals',
      }
    : { disabled: false as const };
}
