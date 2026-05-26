import { jsonParse } from '../../../../../../utils/encoding.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { getOpenAiModerationScores } from './openAIModerationUtils.js';

/**
 * The multimodal request body is the contract change in this PR — the lib used
 * to send `{ input: text }` to the legacy moderation endpoint, and now sends
 * `{ model: 'omni-moderation-latest', input: [{type, ...}] }` to the multimodal
 * endpoint. Pinning the body shape here catches any future regression that
 * silently reverts to the legacy contract OpenAI no longer expects.
 */
describe('getOpenAiModerationScores request body shape', () => {
  function makeFetchHTTPCapturing() {
    let captured: { url: string; body: unknown } = { url: '', body: {} };
    const fetchHTTP = jest
      .fn()
      .mockImplementation(async (req: { url: string; body: string }) => {
        captured = { url: req.url, body: jsonParse(req.body as never) };
        return {
          ok: true,
          status: 200,
          body: {
            results: [{ categories: {}, category_scores: {}, flagged: false }],
          },
        };
      }) as unknown as FetchHTTP;
    return { fetchHTTP, lastRequest: () => captured };
  }

  const tracer = { getActiveSpan: () => undefined } as unknown as Parameters<
    typeof getOpenAiModerationScores
  >[1];

  it('builds a text-typed multimodal input when only text is provided', async () => {
    const { fetchHTTP, lastRequest } = makeFetchHTTPCapturing();
    await getOpenAiModerationScores(fetchHTTP, tracer, {
      apiKey: 'sk-test',
      text: 'hello world',
    });
    expect(lastRequest().url).toBe('https://api.openai.com/v1/moderations');
    expect(lastRequest().body).toEqual({
      model: 'omni-moderation-latest',
      input: [{ type: 'text', text: 'hello world' }],
    });
  });

  it('builds an image_url-typed multimodal input when only imageUrl is provided', async () => {
    const { fetchHTTP, lastRequest } = makeFetchHTTPCapturing();
    await getOpenAiModerationScores(fetchHTTP, tracer, {
      apiKey: 'sk-test',
      imageUrl: 'https://example.test/pic.jpg',
    });
    expect(lastRequest().body).toEqual({
      model: 'omni-moderation-latest',
      input: [
        {
          type: 'image_url',
          image_url: { url: 'https://example.test/pic.jpg' },
        },
      ],
    });
  });

  it('throws a SignalPermanentError when neither text nor imageUrl is provided', async () => {
    // Defensive guard — the typed entry points always pass one or the other,
    // so this only fires on caller bugs. Classified as permanent because a
    // retry with the same arguments yields the same failure.
    const { fetchHTTP } = makeFetchHTTPCapturing();
    await expect(
      getOpenAiModerationScores(fetchHTTP, tracer, { apiKey: 'sk-test' }),
    ).rejects.toMatchObject({
      name: 'SignalPermanentError',
      title: expect.stringMatching(/text.*imageUrl/),
    });
  });
});
