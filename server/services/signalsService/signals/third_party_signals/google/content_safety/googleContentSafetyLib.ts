import { ScalarTypes } from '@roostorg/types';
import { type ReadonlyDeep } from 'type-fest';

import { jsonStringify } from '../../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../../utils/errors.js';
import { safeGet } from '../../../../../../utils/misc.js';
import type SafeTracer from '../../../../../../utils/SafeTracer.js';
import { type Bind2 } from '../../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { type SignalInput } from '../../../SignalBase.js';
import { fetchImage, fetchWithTimeout } from './fetchUtils.js';

export const GOOGLE_CONTENT_SAFETY_PRIORITIES = [
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'VERY_HIGH',
] as const;

export type GoogleContentSafetyPriority =
  (typeof GOOGLE_CONTENT_SAFETY_PRIORITIES)[number];

export interface GoogleContentSafetyOptions {
  apiKey: string;
  /** Timeout for requests to the API in milliseconds. */
  timeoutMs?: number;
  fetchHTTP: FetchHTTP;
}

export interface ClassificationResult {
  reviewPriorities: GoogleContentSafetyPriority[];
  modelVersion?: string;
}

export class GoogleContentSafetyClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchHTTP: FetchHTTP;
  private readonly baseUrl =
    'https://contentsafety.googleapis.com/v1beta1/images:classify';

  constructor(options: GoogleContentSafetyOptions) {
    if (!options.apiKey) {
      throw new Error('Google Content Safety API key is required.');
    }
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchHTTP = options.fetchHTTP;
  }

  /**
   * Classifies a single raw image (Buffer or Uint8Array).
   *
   * Prefer `classifyImages` when classifying multiple images.
   */
  public async classifyImage(
    image: Buffer | Uint8Array,
  ): Promise<GoogleContentSafetyPriority | undefined> {
    const priorities = await this.classifyImages([image]);
    return priorities[0];
  }

  /**
   * Classifies a list of raw images (Buffer or Uint8Array).
   *
   * This method is preferred over calling `classifyImage` multiple times, as it
   * batches the images into a single API request.
   */
  public async classifyImages(
    images: (Buffer | Uint8Array)[],
  ): Promise<ReadonlyDeep<GoogleContentSafetyPriority[]>> {
    const url = `${this.baseUrl}?key=${this.apiKey}`;

    const reqBody = {
      images: images.map((image) => {
        if (Buffer.isBuffer(image)) {
          return image.toString('base64');
        }
        return Buffer.from(image).toString('base64');
      }),
    };

    try {
      const response = await fetchWithTimeout(
        this.fetchHTTP,
        url,
        {
          method: 'post',
          headers: {'Content-Type': 'application/json'},
          body: jsonStringify(reqBody),
        },
        this.timeoutMs,
      );

      if (!response.ok) {
        throw new Error(
          `Google Content Safety API request failed with status ${response.status}`,
        );
      }

      const responseJson = (response.body ?? undefined) as
        | {
            reviewPriorities: GoogleContentSafetyPriority[];
            model_version: string;
          }
        | undefined;

      if (!responseJson?.reviewPriorities) {
        throw new Error('Google Content Safety API returned unexpected format');
      }

      return responseJson.reviewPriorities;
    } catch (error: unknown) {
      // Map known errors or rethrow
      if (error instanceof Error) {
        throw new Error(`Google Content Safety API Error: ${error.message}`);
      }
      throw error;
    }
  }
}

export async function runGoogleContentSafetyImageImpl(
  getGoogleContentSafetyCredentials: CachedGetCredentials<'GOOGLE_CONTENT_SAFETY_API'>,
  input: SignalInput<ScalarTypes['IMAGE']>,
  getGoogleContentSafetyScores: FetchGoogleContentSafetyScores,
) {
  const { value, orgId } = input;
  const credential = await getGoogleContentSafetyCredentials(orgId);

  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (!credential?.apiKey) {
    throw new Error('Missing API credentials');
  }

  const response = await getGoogleContentSafetyScores({
    imageUrl: value.value.url,
    apiKey: credential.apiKey,
  });

  if (response.length === 0) {
    throw new Error('Empty Google Content Safety API results');
  }

  const priority = response[0];

  return {
    score: priority,
    outputType: {
      scalarType: ScalarTypes.STRING,
      enum: GOOGLE_CONTENT_SAFETY_PRIORITIES,
      ordered: true as const,
    },
  };
}

export type FetchGoogleContentSafetyScores = Bind2<
  typeof getGoogleContentSafetyScores,
  FetchHTTP,
  SafeTracer
>;

const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const CONTENT_SAFETY_API_TIMEOUT_MS = 10_000;

export async function getGoogleContentSafetyScores(
  fetchHTTP: FetchHTTP,
  tracer: SafeTracer,
  req: { apiKey: string; imageUrl: string },
): Promise<ReadonlyDeep<GoogleContentSafetyPriority[]>> {
  const { apiKey, imageUrl } = req;

  let imageBuffer: Buffer;
  try {
    imageBuffer = await fetchImage(
      fetchHTTP,
      imageUrl,
      IMAGE_FETCH_TIMEOUT_MS,
    );
  } catch (e) {
    if (safeGet(e, ['name']) === 'ResponseExceededMaxSizeError') {
      throw makeSignalPermanentError('Response too large', {
        shouldErrorSpan: true,
      });
    }
    const activeSpan = tracer.getActiveSpan();
    if (activeSpan?.isRecording()) {
      activeSpan.recordException(e as Error);
    }
    throw new Error(
      `Failed to fetch image for Google Content Safety API: ${String(e)}`,
    );
  }

  try {
    const client = new GoogleContentSafetyClient({
      apiKey,
      fetchHTTP,
      timeoutMs: CONTENT_SAFETY_API_TIMEOUT_MS,
    });
    const priority = await client.classifyImage(imageBuffer);
    if (priority === undefined) {
      throw new Error('Empty Google Content Safety API results');
    }
    return [priority];
  } catch (e) {
    if (safeGet(e, ['name']) === 'ResponseExceededMaxSizeError') {
      throw makeSignalPermanentError('Response too large', {
        shouldErrorSpan: true,
      });
    }
    const activeSpan = tracer.getActiveSpan();
    if (activeSpan?.isRecording()) {
      activeSpan.recordException(e as Error);
    }
    throw e;
  }
}
