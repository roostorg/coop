import { Readable } from 'node:stream';

import type SafeTracer from '../../../../utils/SafeTracer.js';
import { type FetchHTTP } from '../../../networkingService/index.js';

/**
 * OPEN_AI_BASE_URL and GOOGLE_CONTENT_SAFETY_BASE_URL are read when their
 * modules are first imported, so each case re-imports the module through
 * `freshImport` to pick up the env value it sets. jest-light-runner runs
 * native ESM (no `jest.isolateModules`), so a unique query string on the
 * specifier is what forces a fresh module instance.
 *
 * Pins the two review findings on these overrides: an empty value must fall
 * back to the default rather than producing a URL like `/moderations`, and a
 * trailing slash must not double up into `/v1//moderations`.
 */

const ORIGINAL_OPEN_AI = process.env.OPEN_AI_BASE_URL;
const ORIGINAL_GOOGLE = process.env.GOOGLE_CONTENT_SAFETY_BASE_URL;

afterEach(() => {
  if (ORIGINAL_OPEN_AI === undefined) {
    delete process.env.OPEN_AI_BASE_URL;
  } else {
    process.env.OPEN_AI_BASE_URL = ORIGINAL_OPEN_AI;
  }
  if (ORIGINAL_GOOGLE === undefined) {
    delete process.env.GOOGLE_CONTENT_SAFETY_BASE_URL;
  } else {
    process.env.GOOGLE_CONTENT_SAFETY_BASE_URL = ORIGINAL_GOOGLE;
  }
});

let importCounter = 0;
async function freshImport<T>(specifier: string): Promise<T> {
  importCounter += 1;
  return (await import(`${specifier}?fresh=${importCounter}`)) as T;
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- test-only env reset
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function capturingFetch(respond: (req: { url: string }) => unknown) {
  const fetchHTTP = jest
    .fn()
    .mockImplementation(async (req: { url: string }) =>
      respond(req),
    ) as unknown as FetchHTTP;
  const urls = () =>
    (fetchHTTP as unknown as jest.Mock).mock.calls.map(
      ([req]: [{ url: string }]) => req.url,
    );
  return { fetchHTTP, urls };
}

describe('OPEN_AI_BASE_URL', () => {
  const tracer = {
    getActiveSpan: () => undefined,
  } as unknown as SafeTracer;
  const moderationResponse = {
    ok: true,
    status: 200,
    body: {
      results: [{ categories: {}, category_scores: {}, flagged: false }],
    },
  };

  async function moderationUrlWithEnv(value: string | undefined) {
    setEnv('OPEN_AI_BASE_URL', value);
    const { fetchHTTP, urls } = capturingFetch(() => moderationResponse);
    const { getOpenAiModerationScores } = await freshImport<
      typeof import('./open_ai/moderation/openAIModerationUtils.js')
    >('./open_ai/moderation/openAIModerationUtils.js');
    await getOpenAiModerationScores(fetchHTTP, tracer, {
      apiKey: 'sk-test',
      text: 'hello',
    });
    return urls()[0];
  }

  async function whisperUrlWithEnv(value: string | undefined) {
    setEnv('OPEN_AI_BASE_URL', value);
    const { fetchHTTP, urls } = capturingFetch((req) =>
      req.url === 'https://media.example/clip.mp3'
        ? {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'audio/mpeg' }),
            body: Readable.toWeb(Readable.from([Buffer.from('audio')])),
          }
        : { ok: true, status: 200, body: { text: 'transcribed' } },
    );
    const { getOpenAiTranscription } = await freshImport<
      typeof import('./open_ai/whisper/OpenAiWhisperTranscriptionSignal.js')
    >('./open_ai/whisper/OpenAiWhisperTranscriptionSignal.js');
    await getOpenAiTranscription(fetchHTTP, {
      url: 'https://media.example/clip.mp3',
      apiKey: 'sk-test',
    });
    // urls[0] is the media download; urls[1] is the transcription request.
    return urls()[1];
  }

  test('unset uses api.openai.com', async () => {
    expect(await moderationUrlWithEnv(undefined)).toBe(
      'https://api.openai.com/v1/moderations',
    );
    expect(await whisperUrlWithEnv(undefined)).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    );
  });

  test('empty value falls back to the default', async () => {
    expect(await moderationUrlWithEnv('')).toBe(
      'https://api.openai.com/v1/moderations',
    );
    expect(await whisperUrlWithEnv('')).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    );
  });

  test('override is used and a trailing slash does not double up', async () => {
    expect(await moderationUrlWithEnv('https://proxy.example/v1/')).toBe(
      'https://proxy.example/v1/moderations',
    );
    expect(await whisperUrlWithEnv('https://proxy.example/v1/')).toBe(
      'https://proxy.example/v1/audio/transcriptions',
    );
  });
});

describe('GOOGLE_CONTENT_SAFETY_BASE_URL', () => {
  const DEFAULT =
    'https://contentsafety.googleapis.com/v1beta1/images:classify';

  async function classifyUrlWithEnv(value: string | undefined) {
    setEnv('GOOGLE_CONTENT_SAFETY_BASE_URL', value);
    const { fetchHTTP, urls } = capturingFetch(() => ({
      ok: true,
      status: 200,
      body: { reviewPriorities: ['LOW'] },
    }));
    const { GoogleContentSafetyClient } = await freshImport<
      typeof import('./google/content_safety/googleContentSafetyLib.js')
    >('./google/content_safety/googleContentSafetyLib.js');
    const client = new GoogleContentSafetyClient({
      apiKey: 'g-test',
      fetchHTTP,
    });
    await client.classifyImages([Buffer.from('img')]);
    return urls()[0];
  }

  test('unset uses the Google endpoint', async () => {
    expect(await classifyUrlWithEnv(undefined)).toBe(`${DEFAULT}?key=g-test`);
  });

  test('empty value falls back to the default', async () => {
    expect(await classifyUrlWithEnv('')).toBe(`${DEFAULT}?key=g-test`);
  });

  test('override is used', async () => {
    expect(await classifyUrlWithEnv('https://proxy.example/classify')).toBe(
      'https://proxy.example/classify?key=g-test',
    );
  });
});
