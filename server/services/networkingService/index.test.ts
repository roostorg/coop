import http from 'http';
import { ProxyTracerProvider } from '@opentelemetry/api';
import _ from 'lodash';

import { makeTestWithFixture } from '../../test/utils.js';
import SafeTracer from '../../utils/SafeTracer.js';
import { fetchHTTP } from './index.js';

const { omit } = _;

// This isn't every option, but it's the meaningfully-different ones.
const requiresFullBodyOptions = ['as-json', 'as-array-buffer'] as const;
const doesntRequireFullBodyOptions = ['as-readable-stream', 'discard'] as const;
const bodyParsingOptions = [
  ...requiresFullBodyOptions,
  ...doesntRequireFullBodyOptions,
] as const;

describe('fetchHTTP', () => {
  const testWithFakeServer = makeTestWithFixture(async () => {
    const port = Math.floor(Math.random() * 10000) + 10000;
    const server = await new Promise<http.Server>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        switch (req.url) {
          case '/never-responds':
            break;

          case '/only-sends-headers':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            break;

          case '/sends-incomplete-body':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write('{');
            break;

          default:
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('"Hello World"');
            break;
        }
      });
      server.listen(port, () => resolve(server));
      server.on('error', reject);
    });

    return {
      tracer: new SafeTracer(new ProxyTracerProvider().getTracer('noop')),
      baseURL: `http://localhost:${port}`,
      async cleanup() {
        await server.close();
      },
    };
  });

  testWithFakeServer(
    'should parse fetched json data from a server',
    async ({ baseURL, tracer }) => {
      const resp = await fetchHTTP(tracer, {
        url: new URL('/hello', baseURL).toString(),
        method: 'get',
        handleResponseBody: 'as-json',
      });

      expect(omit(resp, ['headers'])).toEqual({
        status: 200,
        ok: true,
        body: 'Hello World',
      });
    },
  );

  describe('timeout handling', () => {
    describe('if nothing is sent before the timeout', () => {
      testWithFakeServer(
        'should reject returned promise, regardless of body parsing setup',
        async ({ baseURL, tracer }) => {
          await Promise.all(
            bodyParsingOptions.map(async (handleResponseBody) => {
              try {
                await fetchHTTP(tracer, {
                  url: new URL('/never-responds', baseURL).toString(),
                  method: 'get',
                  handleResponseBody,
                  timeoutMs: 100,
                  iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
                  signWith: undefined,
                });
                throw new Error("should've rejected");
              } catch (e) {
                expect(e).toMatchObject({ name: 'TimeoutError' });
              }
            }),
          );
        },
      );
    });

    describe('if only headers are sent before the timeout', () => {
      testWithFakeServer(
        'should reject returned promise, regardless of body parsing settings',
        async ({ baseURL, tracer }) => {
          await Promise.all(
            bodyParsingOptions.map(async (handleResponseBody) => {
              try {
                await fetchHTTP<typeof handleResponseBody>(tracer, {
                  url: new URL('/only-sends-headers', baseURL).toString(),
                  method: 'get',
                  handleResponseBody,
                  timeoutMs: 100,
                  iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
                  signWith: undefined,
                });
                throw new Error("should've rejected");
              } catch (e) {
                expect(e).toMatchObject({ name: 'TimeoutError' });
              }
            }),
          );
        },
      );
    });

    describe('if an incomplete body was sent before the timeout', () => {
      testWithFakeServer(
        'should reject returned promise if the caller requested body parsing',
        async ({ baseURL, tracer }) => {
          await Promise.all(
            requiresFullBodyOptions.map(async (handleResponseBody) => {
              try {
                await fetchHTTP(tracer, {
                  url: new URL('/sends-incomplete-body', baseURL).toString(),
                  method: 'get',
                  handleResponseBody,
                  timeoutMs: 100,
                });
                throw new Error("should've rejected");
              } catch (e) {
                expect(e).toMatchObject({ name: 'TimeoutError' });
              }
            }),
          );
        },
      );

      testWithFakeServer(
        'should resolve the returned promise, but cancel the stream, if a stream for the body was requested',
        async ({ baseURL, tracer }) => {
          const resp = await fetchHTTP(tracer, {
            url: new URL('/sends-incomplete-body', baseURL).toString(),
            method: 'get',
            handleResponseBody: 'as-readable-stream',
            timeoutMs: 100,
            iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
          });

          try {
            // Try to consume the stream until the end, which should eventually
            // throw because the body won't be complete before the timeout.
            for await (const _x of resp.body!) {
            }
            throw new Error("consuming the stream should've thrown");
          } catch (e) {
            expect(e).toMatchObject({ name: 'TimeoutError' });
          }
        },
      );

      testWithFakeServer(
        'should resolve the returned promise and never error if no body was requested',
        async ({ baseURL, tracer }) => {
          const resp = await fetchHTTP(tracer, {
            url: new URL('/sends-incomplete-body', baseURL).toString(),
            method: 'get',
            handleResponseBody: 'discard',
            timeoutMs: 100,
          });

          expect(resp).toMatchObject({
            status: 200,
            ok: true,
            body: undefined,
          });
        },
      );
    });
  });
});
