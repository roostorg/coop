import type {
  CoopResponse,
  FetchHTTP,
} from '../../../../../networkingService/index.js';

export async function fetchWithTimeout(
  fetchHTTP: FetchHTTP,
  url: string,
  options: {
    method: 'post';
    headers: Record<string, string>;
    body: string;
  },
  timeoutMs: number,
): Promise<CoopResponse<'as-json'>> {
  return fetchHTTP({
    url,
    method: 'post',
    headers: options.headers,
    body: options.body,
    timeoutMs,
    handleResponseBody: 'as-json',
  });
}

export async function fetchMedia(
  fetchHTTP: FetchHTTP,
  url: string,
  timeoutMs: number,
  maxResponseSize?: '5mb' | '25mb',
): Promise<Buffer> {
  const response = await fetchHTTP({
    url,
    method: 'get',
    timeoutMs,
    handleResponseBody: 'as-array-buffer',
    maxResponseSize,
  });

  if (!response.ok || response.body === undefined) {
    throw new Error(
      `Failed to fetch media: ${response.status} ${response.headers.get('content-type') ?? 'unknown'}`,
    );
  }

  return Buffer.from(response.body);
}
