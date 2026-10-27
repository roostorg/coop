import http from 'http';
import { trace } from '@opentelemetry/api';

import { makeTestWithFixture } from '../../../../../../test/utils.js';
import SafeTracer from '../../../../../../utils/SafeTracer.js';
import {
  fetchHTTP,
  type FetchHTTP,
} from '../../../../../networkingService/index.js';
import { getOpenAiTranscription } from './OpenAiWhisperTranscriptionSignal.js';

describe('getOpenAiTranscription', () => {
  const testWithAudioServer = makeTestWithFixture(async () => {
    let markSocketClosed: () => void = () => {};
    const socketClosed = new Promise<void>((resolve) => {
      markSocketClosed = resolve;
    });
    const server = http.createServer((req, res) => {
      req.socket.on('close', markSocketClosed);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.write('not found');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address == null || typeof address === 'string') {
      throw new Error('Audio server did not bind to a port');
    }
    const tracer = new SafeTracer(trace.getTracer('noop'));
    const fetch: FetchHTTP = async (query) => fetchHTTP(tracer, query);

    return {
      fetch,
      audioURL: `http://localhost:${address.port}/audio.mp3`,
      socketClosed,
      async cleanup() {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      },
    };
  });

  testWithAudioServer(
    'closes a failed audio download before rejecting',
    async ({ fetch, audioURL, socketClosed }) => {
      await expect(
        getOpenAiTranscription(fetch, { url: audioURL, apiKey: 'test-key' }),
      ).rejects.toThrow('status code 404');

      await socketClosed;
    },
  );
});
