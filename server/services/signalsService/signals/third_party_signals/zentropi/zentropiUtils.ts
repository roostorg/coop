import { ScalarTypes } from '@roostorg/coop-types';

import { jsonStringify } from '../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { type Bind1 } from '../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { type SignalInput } from '../../SignalBase.js';
import { type FetchOpenAICompatibleScore } from '../openai_compatible/openaiCompatibleUtils.js';

export type GetPolicyText = (
  orgId: string,
  policyId: string,
) => Promise<string | null>;

export interface ZentropiResponse {
  label: 0 | 1 | '0' | '1';
  confidence: number;
  explanation?: string;
}

export type FetchZentropiScores = Bind1<typeof getZentropiScores, FetchHTTP>;

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
  fetchZentropiScores: FetchZentropiScores,
  fetchOpenAICompatibleScore: FetchOpenAICompatibleScore,
  getPolicyText: GetPolicyText,
) {
  const { value, orgId, subcategory } = input;
  const credential = await getZentropiCredentials(orgId);

  if (!subcategory) {
    throw new Error(
      'Missing criteria in subcategory. ' +
        'Specify a Zentropi labeler_version_id (hosted) or policy criteria text (self-hosted) ' +
        'in the condition subcategory field.',
    );
  }

  // Resolve policy reference to criteria text, stripping any HTML markup.
  const resolvedCriteria = subcategory.startsWith('policy:')
    ? await resolvePolicyCriteria(
        getPolicyText,
        orgId,
        subcategory.slice('policy:'.length),
      )
    : subcategory;

  if (credential?.selfHosted != null) {
    const { selfHosted } = credential;
    const base = {
      baseUrl: selfHosted.baseUrl,
      model: selfHosted.model,
      apiKey: selfHosted.apiKey,
      criteria: resolvedCriteria,
      content: value.value,
    };
    const params =
      selfHosted.format === 'openai_chat'
        ? {
            ...base,
            format: 'openai_chat' as const,
            systemPromptTemplate:
              selfHosted.systemPromptTemplate ?? '{criteria}',
            userMessageTemplate: selfHosted.userMessageTemplate ?? '{content}',
          }
        : { ...base, format: 'cope' as const };
    const { score } = await fetchOpenAICompatibleScore(params);
    return { score, outputType: { scalarType: ScalarTypes.NUMBER } };
  }

  if (!credential?.apiKey) {
    throw new Error('Missing Zentropi API credentials');
  }

  const response = await fetchZentropiScores({
    text: value.value,
    apiKey: credential.apiKey,
    labelerVersionId: resolvedCriteria,
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

async function resolvePolicyCriteria(
  getPolicyText: GetPolicyText,
  orgId: string,
  policyId: string,
): Promise<string> {
  const text = await getPolicyText(orgId, policyId);
  if (!text) {
    throw makeSignalPermanentError(
      `Policy ${policyId} not found or has no policy text`,
      { shouldErrorSpan: true },
    );
  }
  // Strip HTML tags that may be present in rich-text policy descriptions.
  const stripped = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) {
    throw makeSignalPermanentError(
      `Policy ${policyId} has no usable criteria text after removing HTML formatting`,
      { shouldErrorSpan: true },
    );
  }
  return stripped;
}
