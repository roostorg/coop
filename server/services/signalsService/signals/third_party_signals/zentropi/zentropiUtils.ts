import { ScalarTypes } from '@roostorg/coop-types';

import { jsonStringify } from '../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../utils/errors.js';
import { type Bind1 } from '../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import {
  type GetCredentials,
  type ZentropiModel,
} from '../../../../signalAuthService/signalAuthService.js';
import { type SignalInput } from '../../SignalBase.js';

export const ZENTROPI_API_MODEL_NAMES = {
  COPE_LATEST: 'cope-latest',
  COPE_B_A4B: 'cope-b-a4b',
  COPE_B_S1: 'cope-b-s1',
} as const satisfies Record<ZentropiModel, string>;

export interface ZentropiResponse {
  label: 0 | 1 | '0' | '1';
  confidence: number;
  explanation?: string;
}

export type FetchZentropiScores = Bind1<typeof getZentropiScores, FetchHTTP>;

// Zentropi rate-limits bursts with HTTP 429 and sheds load with HTTP 529.
// Retry those with exponential backoff (250 ms, 500 ms, 1 s, 2 s), honoring
// Retry-After, so a short burst does not silently turn the rule condition
// into ERRORED.
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5_000;

export async function getZentropiScores(
  fetchHTTP: FetchHTTP,
  params: {
    text: string;
    apiKey: string;
    labelerId?: string | null;
    labelerVersionId: string;
    model?: ZentropiModel | null;
  },
): Promise<ZentropiResponse> {
  const labelerId = params.labelerId?.trim();
  const model =
    params.model != null &&
    Object.hasOwn(ZENTROPI_API_MODEL_NAMES, params.model)
      ? ZENTROPI_API_MODEL_NAMES[params.model]
      : undefined;
  const body = jsonStringify({
    content_text: params.text,
    // A specific version ID is sufficient. Omit blank IDs rather than
    // sending empty strings or null to the API.
    ...(labelerId ? { labeler_id: labelerId } : {}),
    labeler_version_id: params.labelerVersionId,
    ...(model ? { model } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const response = await fetchHTTP({
      url: 'https://api.zentropi.ai/v1/label',
      method: 'post',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      handleResponseBody: 'as-json',
      timeoutMs: 5_000,
    });

    if (response.ok) {
      return response.body as unknown as ZentropiResponse;
    }
    if (response.status === 404 || response.status === 401) {
      throw makeSignalPermanentError(
        `Zentropi API error: ${response.status}${
          response.status === 404
            ? ' (labeler or version not found, or not deployed)'
            : ' (invalid API key)'
        }`,
        { shouldErrorSpan: true },
      );
    }
    // Zentropi rejects malformed requests with a 422 and unavailable models
    // with a 400; retrying won't help.
    if (response.status === 422 || response.status === 400) {
      throw makeSignalPermanentError(`Zentropi API error: ${response.status}`, {
        detail: getValidationErrorDetail(response.body),
        shouldErrorSpan: true,
      });
    }
    if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
      continue;
    }
    throw new Error(
      `Zentropi API error: ${response.status}${
        attempt > 1 ? ` (after ${attempt} attempts)` : ''
      }`,
    );
  }
}

function isRetryableStatus(status: number) {
  // 429: rate limited. 529: overloaded.
  return status === 429 || status === 529;
}

/**
 * Exponential backoff from BASE_RETRY_DELAY_MS, raised to the server's
 * Retry-After (seconds or an HTTP date) when that is longer, and capped at
 * MAX_RETRY_DELAY_MS so a rate-limited item does not stall the worker.
 */
function retryDelayMs(attempt: number, retryAfter: string | null) {
  const backoff = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(
    Math.max(backoff, retryAfterMs(retryAfter)),
    MAX_RETRY_DELAY_MS,
  );
}

function retryAfterMs(retryAfter: string | null) {
  if (retryAfter == null) {
    return 0;
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getValidationErrorDetail(body: unknown): string | undefined {
  const detail =
    body != null && typeof body === 'object' && 'detail' in body
      ? body.detail
      : undefined;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((it: unknown) =>
        it != null && typeof it === 'object' && 'msg' in it
          ? String(it.msg)
          : undefined,
      )
      .filter((it) => it != null);
    return messages.length > 0 ? messages.join('; ') : undefined;
  }
  return undefined;
}

export async function runZentropiLabelerImpl(
  getZentropiCredentials: GetCredentials<'ZENTROPI'>,
  input: SignalInput<ScalarTypes['STRING']>,
  fetchScores: FetchZentropiScores,
) {
  const { value, orgId, subcategory } = input;

  const credential = await getZentropiCredentials(orgId);

  if (!credential?.apiKey) {
    throw new Error('Missing Zentropi API credentials');
  }

  if (!subcategory) {
    throw makeSignalPermanentError('Missing Zentropi labeler version', {
      detail:
        'Select a Zentropi labeler version in the condition subcategory field.',
      shouldErrorSpan: true,
    });
  }

  // The subcategory is the version ID of one of the org's configured labeler
  // versions. Its parent labeler ID is optional for a specific version.
  const labelerVersion = credential.labelerVersions?.find(
    (it) => it.id === subcategory,
  );
  if (!labelerVersion) {
    throw makeSignalPermanentError('Missing Zentropi labeler version', {
      detail:
        `No Zentropi labeler version is configured for ` +
        `${subcategory}. Add it in the Zentropi integration settings.`,
      shouldErrorSpan: true,
    });
  }

  const response = await fetchScores({
    text: value.value,
    apiKey: credential.apiKey,
    labelerId: labelerVersion.labelerId,
    labelerVersionId: labelerVersion.id,
    model: labelerVersion.model,
  });

  // Composite score mapping:
  // label=1 (content matches the policy) → pass confidence through
  // label=0 (content does not match) → invert confidence
  // Result: 0 = confidently no match, 0.5 = uncertain, 1 = confidently a match
  const { label, confidence } = response;
  const score = Number(label) === 1 ? confidence : 1 - confidence;

  return {
    score,
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}
