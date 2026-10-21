import http from 'http';
import { trace } from '@opentelemetry/api';

import { makeTestWithFixture } from '../../test/utils.js';
import SafeTracer from '../../utils/SafeTracer.js';
import { fetchHTTP, type FetchHTTP } from '../networkingService/index.js';
import { uploadDownloadedMedia } from './ncmecReporting.js';

describe('uploadDownloadedMedia', () => {
  const testWithMediaServer = makeTestWithFixture(async () => {
    let markSocketClosed: () => void = () => {};
    const socketClosed = new Promise<void>((resolve) => {
      markSocketClosed = resolve;
    });
    const server = http.createServer((req, res) => {
      req.socket.on('close', markSocketClosed);
      switch (req.url) {
        case '/missing':
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.write('not found');
          break;
        case '/complete':
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end('media');
          break;
        default:
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.write(Buffer.alloc(1024));
          break;
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address == null || typeof address === 'string') {
      throw new Error('Media server did not bind to a port');
    }
    const tracer = new SafeTracer(trace.getTracer('noop'));
    const fetch: FetchHTTP = async (query) => fetchHTTP(tracer, query);

    return {
      fetch,
      baseURL: `http://localhost:${address.port}`,
      socketClosed,
      async cleanup() {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      },
    };
  });

  testWithMediaServer(
    'closes the download when sending the media fails',
    async ({ fetch, baseURL, socketClosed }) => {
      await expect(
        uploadDownloadedMedia(fetch, `${baseURL}/stalls`, async () => {
          throw new Error('upload failed');
        }),
      ).rejects.toThrow('upload failed');

      await socketClosed;
    },
  );

  testWithMediaServer(
    'closes the download when the media response is not ok',
    async ({ fetch, baseURL, socketClosed }) => {
      const send = vi.fn();

      await expect(
        uploadDownloadedMedia(fetch, `${baseURL}/missing`, send),
      ).rejects.toThrow(`Cannot download media from ${baseURL}/missing`);

      expect(send).not.toHaveBeenCalled();
      await socketClosed;
    },
  );

  testWithMediaServer(
    'returns the send result when the upload succeeds',
    async ({ fetch, baseURL }) => {
      const result = await uploadDownloadedMedia(
        fetch,
        `${baseURL}/complete`,
        async (body) => {
          let text = '';
          for await (const chunk of body) {
            text += Buffer.from(chunk).toString();
          }
          return text;
        },
      );

      expect(result).toBe('media');
    },
  );
});
