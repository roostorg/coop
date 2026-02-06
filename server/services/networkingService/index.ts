import { ReadableStream } from 'node:stream/web';
import { setTimeout } from 'node:timers/promises';
import { SpanKind } from '@opentelemetry/api';
// This library provides a reimplementation of the browser/W3C FormData object
// that supports streams as the value for form parts.
import { FormDataEncoder } from 'form-data-encoder';
import { FormData as NonWebCompatibleFormData } from 'formdata-node';
import { Agent, fetch, type FormData, type Headers } from 'undici';
import { xml2json } from 'xml-js';

import { b64EncodeArrayBuffer, jsonStringify } from '../../utils/encoding.js';
import { JSON } from '../../utils/json-schema-types.js';
import { assertUnreachable } from '../../utils/misc.js';
import type SafeTracer from '../../utils/SafeTracer.js';
import { MINUTE_MS } from '../../utils/time.js';
import { bodyCancellationReason } from './bodyCancellationReason.js';

/**
 * This enum determines how we handle and return the response body. If the
 * response has no body, the result will be undefined.
 *
 * - as-json will return the result of parsing the response's body as JSON.
 * - as-json-from-xml will parse the response body as an XML doc, and then
 *   return the parse tree result in a JSON-serializable object.
 * - as-array-buffer will return the body's contents loaded into an ArrayBuffer
 * - discard will ignore the response body and return undefined
 */
type ResponseBodyMappings = {
  'as-json': JSON;
  'as-json-from-xml': JSON;
  'as-array-buffer': ArrayBuffer;
  'as-readable-stream': ReadableStream;
  'as-blob': Blob;
  discard: undefined;
};

type HandleResponseBody = keyof ResponseBodyMappings;

// A symbol that we can stick on FormDataLikeWithStreams objects to
// unambiguously identify those objects as FormDataLikeWithStreams.
const formDataLikeWithStreams = Symbol();

export type FormDataLikeWithStreams = {
  [formDataLikeWithStreams]: true;
  [partName: string]: string | FileLikeWithStreams;
};

type FileLikeWithStreams = { data: ReadableStream; fileName?: string };

/**
 * The standards-compatible FormData object doesn't support using streams as the
 * value of its parts (non-string parts have to be Blob of File objects, both of
 * which can only be constructed, according to the Fetch spec, from a buffer of
 * all the underlying bytes). So, this function returns an object that can be
 * passed to our networking helper and that will get sent a multipart-form-data
 * body without buffering the part data.
 */
export function makeFormDataLikeWithStreams(parts: {
  [partName: string]: string | FileLikeWithStreams;
}): FormDataLikeWithStreams {
  return { ...parts, [formDataLikeWithStreams]: true };
}

function isFormDataLikeWithStreams(it: unknown): it is FormDataLikeWithStreams {
  return Boolean(
    typeof it === 'object' &&
      it != null &&
      (it as { [formDataLikeWithStreams]?: unknown })[formDataLikeWithStreams],
  );
}

// We don't have code for converting every body type to an ArrayBuffer, which is
// needed for signing, so we differentiate which body types can and can't be signed.
type SignableBody = string | URLSearchParams | ArrayBuffer;

/**
 * This is the type that should be passed to every query our app runs, and it
 * mirrors the inputs that fetch takes.
 */
export type CoopRequestQuery<T extends HandleResponseBody> = {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
  handleResponseBody: T;
  headers?: Record<string, string | ReadonlyArray<string>>;
  logRequestAndResponseBody?: 'ALWAYS' | 'ON_FAILURE' | 'NEVER';
  /**
   * Amount of time after which to fail the request and try to abort it,
   * measured from the time that the request starts to be sent.
   *
   * No timeout is used by default, but mosts requests should set one.
   *
   * The promise returned by {@link fetchHTTP} will _often_ reject with an
   * `TimeoutError` if this timeout is reached. (E.g., if {@link fetchHTTP}'s
   * promise doesn't resolve until the whole response body is available for
   * parsing, and that hasn't happened when the timeout occurs, the promise will
   * reject.) In other cases, though -- including most of the time when the
   * caller of {@link fetchHTTP} asks to get the response body as a stream --
   * {@link fetchHTTP}'s promise may resolve, but the stream it returns will be
   * [canceled](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/cancel)
   * when the timeout is hit and future reads from it will fail.
   */
  timeoutMs?: number;
} & (
  | {
      body?: SignableBody | ReadableStream | FormData | FormDataLikeWithStreams;
      signWith?: undefined;
    }
  | {
      body: SignableBody;
      signWith: (data: ArrayBuffer) => Promise<{ signature: ArrayBuffer }>;
    }
) &
  (
    | {
        handleResponseBody: Exclude<T, 'as-readable-stream'>;
        maxResponseSize?: '5mb' | '25mb' | '125mb';
        iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash?: boolean;
      }
    | {
        handleResponseBody: 'as-readable-stream';
        maxResponseSize?: '5mb' | '25mb' | '125mb' | 'unlimited';
        iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true;
      }
  );

/**
 * This is the minimum amount of information necessary to return from a given
 * request. In the future, we might add other fields here to handle things like
 * buffers, GRPC, etc., but for now it only handles JSON parsing and ignoring
 * the body all together
 */
export type CoopResponse<T extends HandleResponseBody> = {
  status: number;
  ok: boolean;
  headers: Headers;
  body: ResponseBodyMappings[T] | undefined;
};

// This agent is used to configure various global undici settings, including the
// max number of open connections in the backing tcp connection pool. We set a
// limit to avoid running out of memory and, more generally, cuz it doesn't seem
// like a good idea for the process' stability to let undici open an unlimited
// number of connections.
// We added a 15 minute headers timeout because when we fetch samples from the
// external services, it can take a long time (because we're running 10s of
// thousands of items through a model), and we don't want the request to time out.
const bytesFromMegabytes = (megabytes: number) => megabytes * 1024 ** 2;
const agentMapping = {
  '5mb': new Agent({
    connections: 2_000,
    maxResponseSize: bytesFromMegabytes(5),
    headersTimeout: 15 * MINUTE_MS,
  }),
  '25mb': new Agent({
    connections: 2_000,
    maxResponseSize: bytesFromMegabytes(25),
    headersTimeout: 15 * MINUTE_MS,
  }),
  '125mb': new Agent({
    connections: 2_000,
    maxResponseSize: bytesFromMegabytes(125),
    headersTimeout: 15 * MINUTE_MS,
  }),
  unlimited: new Agent({
    connections: 2_000,
    maxResponseSize: -1,
    headersTimeout: 15 * MINUTE_MS,
  }),
} as const;

/**
 * This function performs an HTTP request and, based on the `handleResponseBody`
 * parameter, decides how and whether to return the response body.
 */
export async function fetchHTTP<T extends HandleResponseBody>(
  tracer: SafeTracer,
  query: CoopRequestQuery<T>,
): Promise<CoopResponse<T>> {
  const url = new URL(query.url);

  return tracer.addActiveSpan(
    {
      resource: `${query.method.toUpperCase()} ${url.protocol}//${url.host}`,
      operation: 'http.request',
      kind: SpanKind.CLIENT,
      attributes: { 'url_details.path': url.pathname },
    },
    async (span) => {
      const {
        headers,
        method,
        body,
        handleResponseBody,
        timeoutMs = Infinity,
      } = query;

      const signature = await (async () => {
        if (!('signWith' in query) || query.signWith === undefined) {
          return undefined;
        }

        if (!body) {
          throw new Error('Cannot sign an HTTP request with no body');
        }

        // Cast to only those body types that are allowed when `signWith` is
        // given; we know we have `signWith` from the check above.
        const castBody = body as (CoopRequestQuery<HandleResponseBody> & {
          signWith: (...args: unknown[]) => never;
        })['body'];

        try {
          // If the body isn't already an ArrayBuffer, we need to encode the body
          // as an ArrayBuffer, so we first coerce it to a string from a `string |
          // URLSearchParams` type, and then encode it with TextEncoder
          const bodyBuffer =
            castBody instanceof ArrayBuffer
              ? castBody
              : new TextEncoder().encode(
                  // `satisfies` ensures that new body types, on which we can't
                  // necessarily just call toString, won't get accidentally
                  // handled incorrectly
                  (castBody satisfies string | URLSearchParams).toString(),
                );

          const { signature } = await query.signWith(bodyBuffer);
          return b64EncodeArrayBuffer(signature);
        } catch (e) {
          // Swallow exception and don't attach a signature header. One likely
          // explanation is that this org has no signing keys
          if (e instanceof Error) {
            span.recordException(e);
          }

          return undefined;
        }
      })();

      const [finalBody, extraHeaders] = (() => {
        if (!isFormDataLikeWithStreams(body)) {
          return [body, {}];
        }

        // Build the input for the body into a legacy node stream that
        // represents the data encoded with `application/multipart-form-data`.
        const formData = new NonWebCompatibleFormData();
        for (const [partName, partData] of Object.entries(body)) {
          if (typeof partData === 'string') {
            formData.append(partName, partData);
          } else {
            formData.set(partName, {
              ...(partData.fileName ? { name: partData.fileName } : {}),
              [Symbol.toStringTag]: 'File',
              stream() {
                return partData.data;
              },
            });
          }
        }

        const toReadableStream = (encoder: FormDataEncoder) => {
          const iterator = encoder.encode();
          return new ReadableStream({
            async pull(controller) {
              const { value, done } = await iterator.next();
              if (done) {
                return controller.close();
              }
              controller.enqueue(value);
            },
          });
        };

        const encoder = new FormDataEncoder(formData);

        return [toReadableStream(encoder), encoder.headers];
      })();

      const signal =
        timeoutMs > 0 && timeoutMs !== Infinity
          ? (() => {
              const controller = new AbortController();
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              setTimeout(timeoutMs).then(() => {
                controller.abort(
                  new DOMException(
                    `"Timeout limit reached ${timeoutMs}ms`,
                    'TimeoutError',
                  ),
                );
              });
              return controller.signal;
            })()
          : undefined;

      // NB: use of fetch here is okay, since this is our wrapper function that
      // should be used instead of fetch everywhere else in the codebase
      // eslint-disable-next-line no-restricted-syntax
      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
          ...extraHeaders,
          ...(signature ? { 'coop-signature': signature } : {}),
        },
        body: finalBody,
        duplex: finalBody instanceof ReadableStream ? 'half' : undefined,
        dispatcher: agentMapping[query.maxResponseSize ?? '5mb'],
        signal,
      });

      span.setAttribute('http.status_code', response.status);

      const [responseBody, bodyByteLength] = (await (async () => {
        // If the response has no body, bail early, and with a result that's
        // consistent across all handling strategies.
        //
        // TODO: Idk if HTTP responses can be sent in a way where the body gets
        // treated as 'present but empty', or how best to handle those (as it's
        // tricky to handle them uniformly in the as-readable-stream case, where
        // we presumably can't detect this 'empty body' situation without
        // starting to read the stream).
        if (response.body === null) {
          return [undefined, null];
        }

        switch (handleResponseBody) {
          case 'as-json': {
            const tempArrayBuffer = await response.arrayBuffer();

            try {
              const parsedJson = // eslint-disable-next-line no-restricted-syntax
                JSON.parse(
                  utf8DecodeBytes(new Uint8Array(tempArrayBuffer)),
                ) as JSON;

              return [parsedJson, tempArrayBuffer.byteLength];
            } catch (e) {
              // when parsing JSON fails, since in this case we explicity
              // called this function wiht 'as-json' we expect to recieve
              // JSON from the remote server, we should log the body of the
              // response to inspect, then re-throw the error so we are not
              // changing behavior for callers
              span.setAttribute(
                'responseBody',
                utf8DecodeBytes(new Uint8Array(tempArrayBuffer)),
              );
              throw e;
            }
          }
          case 'as-json-from-xml': {
            const tempArrayBuffer = await response.arrayBuffer();
            const parsedXML = // eslint-disable-next-line no-restricted-syntax
              JSON.parse(
                xml2json(utf8DecodeBytes(new Uint8Array(tempArrayBuffer)), {
                  compact: true,
                }),
              );

            return [parsedXML, tempArrayBuffer.byteLength];
          }
          case 'as-array-buffer':
            const arrayBuffer = await response.arrayBuffer();
            return [arrayBuffer, arrayBuffer.byteLength];
          case 'as-readable-stream':
            return [
              response.body,
              typeof response.headers.get('content-length') === 'string'
                ? parseInt(response.headers.get('content-length')!)
                : null,
            ];
          case 'as-blob':
            const blob = await response.blob();
            return [blob, blob.size];
          case 'discard':
            await response.body.cancel(bodyCancellationReason);
            return [undefined, null];
          default:
            assertUnreachable(
              handleResponseBody,
              'This should never be reached.',
            );
        }
      })()) satisfies [
        ResponseBodyMappings[HandleResponseBody],
        number | null,
      ] as [ResponseBodyMappings[T], number | null];

      if (bodyByteLength !== null) {
        span.setAttribute('response.bodyLength', bodyByteLength);
      }

      if (
        (query.logRequestAndResponseBody === 'ON_FAILURE' &&
          response.status >= 400) ||
        query.logRequestAndResponseBody === 'ALWAYS'
      ) {
        span.setAttribute(
          'http.request.body',
          body === undefined ? 'undefined' : jsonStringify(body),
        );
        span.setAttribute('http.response.body', jsonStringify(response.body));
      }

      return {
        status: response.status,
        ok: response.ok,
        body: responseBody,
        headers: response.headers,
      };
    },
  );
}

// TextDecoder reused by each utf8DecodeBytes call,
// so we don't have to create a new one for every fetchHttp request.
const textDecoder = new TextDecoder();

/**
 * Stolen from the undici source code for handling a response as a buffer.
 * Undici, in turn, is implementing this as defined in the WHATWG fetch spec.
 * See: https://github.com/nodejs/undici/blob/9a56796b3e61713f7f2e44ea8c9622b158697c45/lib/web/fetch/util.js#L1437
 */
function utf8DecodeBytes(buffer: Uint8Array) {
  if (buffer.length === 0) {
    return '';
  }

  // 1. Let buffer be the result of peeking three bytes from
  //    ioQueue, converted to a byte sequence.

  // 2. If buffer is 0xEF 0xBB 0xBF, then read three
  //    bytes from ioQueue. (Do nothing with those bytes.)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    buffer = buffer.subarray(3);
  }

  // 3. Process a queue with an instance of UTF-8’s
  //    decoder, ioQueue, output, and "replacement".
  const output = textDecoder.decode(buffer);

  // 4. Return output.
  return output;
}

export type FetchHTTP = <T extends HandleResponseBody>(
  query: CoopRequestQuery<T>,
) => Promise<CoopResponse<T>>;
