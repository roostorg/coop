import { Headers } from 'undici';

import {
  type CoopRequestQuery,
  type CoopResponse,
  type FetchHTTP,
  type HandleResponseBody,
} from '../../services/networkingService/index.js';

/** Shape of one recorded outgoing fetchHTTP call. */
export type RecordedFetchHTTPCall = {
  url: string;
  method: string;
  body: unknown;
  headers?: Record<string, string | ReadonlyArray<string>>;
};

/** Records every outgoing fetchHTTP call and returns canned CyberTip
 * responses. */
export function makeStubFetchHTTP(
  reportId: string,
  fileId: string,
  opts: { preservationUrl?: string } = {},
): {
  fetchHTTP: FetchHTTP;
  calls: RecordedFetchHTTPCall[];
} {
  const calls: RecordedFetchHTTPCall[] = [];
  const preservationUrl = opts.preservationUrl;
  const ok = <T extends HandleResponseBody>(body: unknown): CoopResponse<T> =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the stub returns a canned body through a slot typed by the caller's T.
    ({
      status: 200,
      ok: true,
      headers: new Headers(),
      body,
    }) as CoopResponse<T>;
  const fetchHTTP: FetchHTTP = async <T extends HandleResponseBody>(
    query: CoopRequestQuery<T>,
  ): Promise<CoopResponse<T>> => {
    const { url, method, body, headers } = query;
    // eslint-disable-next-line functional/immutable-data -- request recorder mutates by design
    calls.push({ url, method, body, headers });

    // media download for #upload
    if (method === 'get') {
      const stream = new ReadableStream({
        start(ctr) {
          ctr.enqueue(new TextEncoder().encode('fake-media-bytes'));
          ctr.close();
        },
      });
      return ok<T>(stream);
    }
    // NCMEC CyberTip protocol — every XML endpoint returns responseCode=0.
    // /submit, /upload, /fileinfo use `reportResponse`; /finish uses
    // `reportDoneResponse`.
    if (
      url.endsWith('/ispws/submit') ||
      url.endsWith('/ispws/upload') ||
      url.endsWith('/ispws/fileinfo')
    ) {
      const isSubmit = url.endsWith('/ispws/submit');
      const isUpload = url.endsWith('/ispws/upload');
      return ok<T>({
        reportResponse: {
          responseCode: { _text: '0' },
          ...(isSubmit ? { reportId: { _text: reportId } } : {}),
          ...(isUpload ? { fileId: { _text: fileId } } : {}),
        },
      });
    }
    if (url.endsWith('/ispws/finish')) {
      return ok<T>({
        reportDoneResponse: {
          responseCode: { _text: '0' },
          reportId: { _text: reportId },
          files: [{ fileId: { _text: fileId } }],
        },
      });
    }
    if (preservationUrl != null && url === preservationUrl) {
      return ok<T>(undefined);
    }
    throw new Error(`stub fetchHTTP: unexpected request ${method} ${url}`);
  };
  return { fetchHTTP, calls };
}
