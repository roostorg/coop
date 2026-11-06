import type { FetchHTTP } from '../../networkingService/index.js';

type Request = { url: string; apiKey: string };

declare function cached<T, U>(options: {
  producer: (key: T) => Promise<U>;
}): (key: T) => Promise<U>;

function toCachedFetcher<T, U>(fetcher: (key: T) => Promise<U>) {
  const cache = cached<T, U>({ producer: (key) => fetcher(key) });
  return (key: T) => cache(key);
}

async function onePrefix(fetchHTTP: FetchHTTP, request: Request) {
  return fetchHTTP({
    url: request.url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
}

async function twoPrefixes(
  fetchHTTP: FetchHTTP,
  token: string,
  request: Request,
) {
  return fetchHTTP({
    url: request.url, // $ hasUrlFlow
    headers: { Authorization: token },
    method: 'get',
    handleResponseBody: 'discard',
  });
}

export function makeCachedFetchers(fetchHTTP: FetchHTTP) {
  return {
    onePrefixFetcher: toCachedFetcher(onePrefix.bind(null, fetchHTTP)),
    twoPrefixFetcher: toCachedFetcher(
      twoPrefixes.bind(null, fetchHTTP, 'fixture-only'),
    ),
  };
}
