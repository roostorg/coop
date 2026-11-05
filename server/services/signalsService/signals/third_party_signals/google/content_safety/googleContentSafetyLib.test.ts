import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ScalarTypes } from '@roostorg/coop-types';
import { vi } from 'vitest';

import { jsonParse, type JsonOf } from '../../../../../../utils/encoding.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { getGoogleContentSafetyScores } from './googleContentSafetyLib.js';

const execFileAsync = promisify(execFile);

describe('getGoogleContentSafetyScores for video', () => {
  let sourceVideo: Buffer;

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'content-safety-test-'));
    const file = path.join(dir, 'source.mp4');
    // prettier-ignore
    await execFileAsync('ffmpeg', [
      '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x480:rate=30',
      '-f', 'lavfi', '-i', 'sine=duration=3',
      '-shortest', file,
    ]);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is under a fresh mkdtemp dir
    sourceVideo = await readFile(file);
    await rm(dir, { recursive: true, force: true });
  });

  const tracer = { getActiveSpan: () => undefined } as unknown as Parameters<
    typeof getGoogleContentSafetyScores
  >[1];

  function makeFetchHTTP(video: Buffer) {
    const fetchHTTP = vi
      .fn()
      .mockImplementation(async (req: { method: string }) =>
        req.method === 'get'
          ? { ok: true, status: 200, headers: new Headers(), body: video }
          : { ok: true, status: 200, body: { reviewPriorities: ['HIGH'] } },
      );
    const classifyRequests = () =>
      fetchHTTP.mock.calls
        .map(([req]) => req as { url: string; method: string; body: string })
        .filter((req) => req.method === 'post')
        .map((req) => ({
          url: req.url,
          body: jsonParse(req.body as JsonOf<{ videos: string[] }>),
        }));
    return { fetchHTTP: fetchHTTP as unknown as FetchHTTP, classifyRequests };
  }

  it('sends a re-encoded video to the videos:classify endpoint', async () => {
    const { fetchHTTP, classifyRequests } = makeFetchHTTP(sourceVideo);

    const result = await getGoogleContentSafetyScores(fetchHTTP, tracer, {
      apiKey: 'test-key',
      mediaUrl: 'https://example.test/clip.mp4',
      mediaType: ScalarTypes.VIDEO,
    });

    expect(result).toEqual(['HIGH']);
    expect(classifyRequests()).toHaveLength(1);
    expect(classifyRequests()[0].url).toBe(
      'https://contentsafety.googleapis.com/v1beta1/videos:classify?key=test-key',
    );

    const sent = Buffer.from(classifyRequests()[0].body.videos[0], 'base64');
    const dir = await mkdtemp(path.join(tmpdir(), 'content-safety-test-'));
    const sentPath = path.join(dir, 'sent.webm');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is under a fresh mkdtemp dir
    await writeFile(sentPath, sent);
    // prettier-ignore
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries',
      'format=format_name:stream=codec_name,width,height',
      '-of', 'json', sentPath,
    ]);
    await rm(dir, { recursive: true, force: true });

    const probe = jsonParse(stdout as never) as {
      format: { format_name: string };
      streams: { codec_name: string; width?: number; height?: number }[];
    };
    expect(probe.format.format_name).toContain('webm');
    expect(probe.streams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codec_name: 'av1', width: 288, height: 288 }),
        expect.objectContaining({ codec_name: 'opus' }),
      ]),
    );
    expect(sent.length).toBeLessThan(sourceVideo.length);
  });

  it('fails permanently when the video cannot be decoded', async () => {
    const { fetchHTTP, classifyRequests } = makeFetchHTTP(
      Buffer.from('not a video'),
    );

    await expect(
      getGoogleContentSafetyScores(fetchHTTP, tracer, {
        apiKey: 'test-key',
        mediaUrl: 'https://example.test/broken.mp4',
        mediaType: ScalarTypes.VIDEO,
      }),
    ).rejects.toMatchObject({ name: 'SignalPermanentError' });
    expect(classifyRequests()).toHaveLength(0);
  });
});
