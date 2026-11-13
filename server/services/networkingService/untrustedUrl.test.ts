import dns from 'node:dns';
import http from 'node:http';
import { trace } from '@opentelemetry/api';
import * as fc from 'fast-check';

import { makeTestWithFixture } from '../../test/utils.js';
import SafeTracer from '../../utils/SafeTracer.js';
import { fieldTypeHandlers } from '../itemProcessingService/fieldTypeHandlers.js';
import { fetchImage } from '../signalsService/signals/third_party_signals/google/content_safety/fetchUtils.js';
import { getOpenAiTranscription } from '../signalsService/signals/third_party_signals/open_ai/whisper/OpenAiWhisperTranscriptionSignal.js';
import { fetchHTTP, type FetchHTTP } from './index.js';
import { isBlockedMediaAddress } from './untrustedUrl.js';

describe('untrusted media destinations', () => {
  beforeEach(() => vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'false'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test.each([
    ['0.0.0.0', true, true],
    ['10.0.0.1', true, true],
    ['169.254.169.254', true, true],
    ['::ffff:10.0.0.1', true, true],
    ['::', true, true],
    ['::a00:1', true, true],
    ['1000::1', true, true],
    ['2001:db8::1', true, true],
    ['64:ff9b::7f00:1', true, true],
    ['2002:7f00:1::', true, true],
    ['fc00::1', true, true],
    ['fe80::1', true, true],
    ['127.0.0.2', true, false],
    ['::1', true, false],
    ['::ffff:127.0.0.2', true, false],
    ['8.8.8.8', false, false],
    ['2606:4700:4700::1111', false, false],
  ])(
    'applies address policy to %s with and without loopback opt-in',
    (address, blockedByDefault, blockedWithLoopback) => {
      expect(isBlockedMediaAddress(address, false)).toBe(blockedByDefault);
      expect(isBlockedMediaAddress(address, true)).toBe(blockedWithLoopback);
    },
  );

  test('treats IPv4 and IPv4-mapped IPv6 addresses identically', () => {
    fc.assert(
      fc.property(fc.ipV4(), fc.boolean(), (address, allowLoopback) => {
        expect(isBlockedMediaAddress(`::ffff:${address}`, allowLoopback)).toBe(
          isBlockedMediaAddress(address, allowLoopback),
        );
      }),
    );
  });

  test('applies the loopback opt-in throughout 127/8, without blocking adjacent public ranges', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255)),
        fc.boolean(),
        fc.constantFrom('', '::ffff:'),
        fc.constantFrom(126, 127, 128),
        (octets, allowLoopback, prefix, first) => {
          const address = `${prefix}${first}.${octets.join('.')}`;
          expect(isBlockedMediaAddress(address, allowLoopback)).toBe(
            first === 127 && !allowLoopback,
          );
        },
      ),
    );
  });

  const testWithServer = makeTestWithFixture(async () => {
    let requests: string[] = [];
    let connections = 0;
    const server = http.createServer((req, res) => {
      requests = [...requests, req.url!];
      if (req.url === '/redirect-blocked') {
        res.writeHead(302, { Location: `http://0.0.0.0:${port}/marker` });
      } else if (req.url === '/redirect-relative') {
        res.writeHead(302, { Location: '/marker' });
      } else {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          Connection: 'close',
        });
      }
      res.end('local-media-marker');
    });
    server.on('connection', () => connections++);
    await new Promise<void>((resolve) => server.listen(0, '::', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No server port');
    const port = address.port;
    const tracer = new SafeTracer(trace.getTracer('noop'));
    const request: FetchHTTP = async (query) => fetchHTTP(tracer, query);
    const download = async (url: string, isUntrustedUrl = true) =>
      request({
        url,
        isUntrustedUrl,
        method: 'get',
        handleResponseBody: 'as-array-buffer',
        timeoutMs: 1000,
      });
    return {
      port,
      requests: () => requests,
      fetch: request,
      download,
      connections: () => connections,
      async cleanup() {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      },
    };
  });

  const blockedError = {
    cause: { message: 'Untrusted media URL resolves to a blocked IP address' },
  };

  describe.each(['http', 'https'])('%s', (scheme) => {
    describe.each([
      '127.0.0.2',
      '127.1',
      '2130706434',
      '0x7f000002',
      '[::1]',
      '[::ffff:127.0.0.2]',
      'localhost',
    ])('%s', (host) => {
      testWithServer(
        'blocks loopback before connecting',
        async ({ port, download, connections }) => {
          await expect(
            download(`${scheme}://${host}:${port}/marker`),
          ).rejects.toMatchObject(blockedError);
          expect(connections()).toBe(0);
        },
      );
    });
  });

  testWithServer(
    'protects Google and Whisper downloads after media coercion',
    async ({ port, fetch, requests, connections }) => {
      const url = `http://127.0.0.2:${port}/marker`;
      const image = fieldTypeHandlers.IMAGE.coerce(url, []);
      if (!image || image instanceof Error)
        throw new Error('Expected a media URL');
      await expect(fetchImage(fetch, image.url, 100)).rejects.toMatchObject(
        blockedError,
      );
      await expect(
        getOpenAiTranscription(fetch, { url, apiKey: 'unused' }),
      ).rejects.toMatchObject(blockedError);
      expect(requests()).toEqual([]);
      expect(connections()).toBe(0);
    },
  );

  testWithServer(
    'keeps trusted internal calls and explicit loopback access separate from strict downloads',
    async ({ port, download, requests }) => {
      const url = `http://127.0.0.2:${port}/marker`;
      const trusted = await download(url, false);
      expect(Buffer.from(trusted.body!).toString()).toBe('local-media-marker');
      await expect(download(url)).rejects.toMatchObject(blockedError);
      vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'true');
      const allowed = await download(url);
      expect(Buffer.from(allowed.body!).toString()).toBe('local-media-marker');
      vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'false');
      await expect(download(url)).rejects.toMatchObject(blockedError);
      expect(requests()).toEqual(['/marker', '/marker']);
    },
  );

  testWithServer(
    'checks redirect destinations and still follows permitted relative redirects',
    async ({ port, download, requests }) => {
      vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'true');
      await expect(
        download(`http://127.0.0.2:${port}/redirect-blocked`),
      ).rejects.toMatchObject(blockedError);
      expect(requests()).toEqual(['/redirect-blocked']);
      const allowed = await download(
        `http://127.0.0.2:${port}/redirect-relative`,
      );
      expect(Buffer.from(allowed.body!).toString()).toBe('local-media-marker');
      expect(requests()).toEqual([
        '/redirect-blocked',
        '/redirect-relative',
        '/marker',
      ]);
    },
  );

  testWithServer(
    'checks all DNS answers on every new connection, without a second lookup',
    async ({ port, download, requests }) => {
      vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'true');
      let answers = [{ address: '127.0.0.2', family: 4 }];
      const lookup = vi
        .spyOn(dns, 'lookup')
        .mockImplementation((...args: unknown[]) => {
          const options = args[1] as dns.LookupOptions;
          const callback = args[2] as (
            error: null,
            address: string | dns.LookupAddress[],
            family?: number,
          ) => void;
          callback(null, options.all ? answers : answers[0].address, 4);
        });
      const url = `http://media.test:${port}/marker`;
      expect(Buffer.from((await download(url)).body!).toString()).toBe(
        'local-media-marker',
      );
      expect(lookup).toHaveBeenCalledTimes(1);
      // The next answer includes a forbidden fallback, even though its first IP is allowed.
      answers = [
        { address: '127.0.0.2', family: 4 },
        { address: '::', family: 6 },
      ];
      await expect(download(url)).rejects.toMatchObject(blockedError);
      expect(requests()).toEqual(['/marker']);
      answers = [{ address: '0.0.0.0', family: 4 }];
      await expect(
        download(`https://media.test:${port}/marker`),
      ).rejects.toMatchObject(blockedError);
      expect(requests()).toEqual(['/marker']);
    },
  );
});
