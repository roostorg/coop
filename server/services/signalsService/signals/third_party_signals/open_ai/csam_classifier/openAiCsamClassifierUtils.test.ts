import { vi } from 'vitest';

import { jsonParse } from '../../../../../../utils/encoding.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { type GetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import {
  getOpenAiCsamClassifierScores,
  openAiCsamClassifierGetDisabledInfo,
} from './openAiCsamClassifierUtils.js';

const tracer = { getActiveSpan: () => undefined } as unknown as Parameters<
  typeof getOpenAiCsamClassifierScores
>[1];

describe('getOpenAiCsamClassifierScores request shape', () => {
  function makeFetchHTTPCapturing() {
    let captured: {
      url: string;
      headers: Record<string, string>;
      body: unknown;
    } = {
      url: '',
      headers: {},
      body: {},
    };
    const fetchHTTP = vi
      .fn()
      .mockImplementation(
        async (req: {
          url: string;
          headers: Record<string, string>;
          body: string;
        }) => {
          captured = {
            url: req.url,
            headers: req.headers,
            body: jsonParse(req.body as never),
          };
          return {
            ok: true,
            status: 200,
            body: {
              results: [
                { categories: {}, category_scores: {}, flagged: false },
              ],
            },
          };
        },
      ) as unknown as FetchHTTP;
    return { fetchHTTP, lastRequest: () => captured };
  }

  it('sends an image_url-typed input authenticated with the classifier key', async () => {
    const { fetchHTTP, lastRequest } = makeFetchHTTPCapturing();
    await getOpenAiCsamClassifierScores(fetchHTTP, tracer, {
      apiKey: 'sk-csam-test',
      imageUrl: 'https://example.test/pic.jpg',
    });
    expect(lastRequest().headers.Authorization).toBe('Bearer sk-csam-test');
    expect(lastRequest().body).toEqual({
      model: 'omni-moderation-csam-latest',
      input: [
        {
          type: 'image_url',
          image_url: { url: 'https://example.test/pic.jpg' },
        },
      ],
    });
  });
});

describe('openAiCsamClassifierGetDisabledInfo', () => {
  const makeGetCredentials = (
    credential: { apiKey: string; csamClassifierApiKey?: string } | undefined,
  ) => (async () => credential) as unknown as GetCredentials<'OPEN_AI'>;

  it('is disabled when the org only has the regular OpenAI API key', async () => {
    const info = await openAiCsamClassifierGetDisabledInfo(
      'org-1',
      makeGetCredentials({ apiKey: 'sk-regular' }),
    );
    expect(info.disabled).toBe(true);
  });

  it('is enabled when the org has a CSAM Classifier key', async () => {
    const info = await openAiCsamClassifierGetDisabledInfo(
      'org-1',
      makeGetCredentials({
        apiKey: 'sk-regular',
        csamClassifierApiKey: 'sk-csam',
      }),
    );
    expect(info.disabled).toBe(false);
  });
});

describe('getOpenAiCsamClassifierScores error handling', () => {
  const fetchReturning = (resp: {
    ok: boolean;
    status: number;
    body?: unknown;
  }) => vi.fn().mockResolvedValue(resp) as unknown as FetchHTTP;

  const call = async (fetchHTTP: FetchHTTP) =>
    getOpenAiCsamClassifierScores(fetchHTTP, tracer, {
      apiKey: 'sk-csam-test',
      imageUrl: 'https://example.test/pic.jpg',
    });

  async function rejectionName(p: Promise<unknown>): Promise<string> {
    try {
      await p;
      return 'DID_NOT_THROW';
    } catch (e) {
      return (e as { name?: string }).name ?? 'Error';
    }
  }

  it('throws a permanent error for a 4xx (bad or unauthorized key)', async () => {
    expect(
      await rejectionName(call(fetchReturning({ ok: false, status: 401 }))),
    ).toBe('SignalPermanentError');
    expect(
      await rejectionName(call(fetchReturning({ ok: false, status: 400 }))),
    ).toBe('SignalPermanentError');
  });

  it('throws a retryable error for 429 and 5xx', async () => {
    expect(
      await rejectionName(call(fetchReturning({ ok: false, status: 429 }))),
    ).not.toBe('SignalPermanentError');
    expect(
      await rejectionName(call(fetchReturning({ ok: false, status: 503 }))),
    ).not.toBe('SignalPermanentError');
  });

  it('throws a permanent error when the response has no results array', async () => {
    expect(
      await rejectionName(
        call(fetchReturning({ ok: true, status: 200, body: {} })),
      ),
    ).toBe('SignalPermanentError');
  });
});
