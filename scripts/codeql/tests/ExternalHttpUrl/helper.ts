import type { FetchHTTP } from './services/networkingService/index.js';

export async function download(client: FetchHTTP, url: string) {
  return client({
    url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
}
