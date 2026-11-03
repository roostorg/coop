import express, { type RequestHandler } from 'express';

import { download } from './helper.js';
import type { FetchHTTP } from './services/networkingService/index.js';
import { makeCachedFetchers } from './services/signalsService/helpers/makeCachedFetchers.js';
import { route } from './utils/route-helpers.js';
import { validateUrl } from './utils/url.js';

declare const deps: { fetchHTTP: FetchHTTP };
const app = express();

app.post('/direct', async (req, res) => {
  await deps.fetchHTTP({
    url: req.body.url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
  res.end();
});

app.post('/alias', async (req, res) => {
  const client = deps.fetchHTTP;
  await client({
    url: req.body.url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
  res.end();
});

app.post('/cross-file', async (req, res) => {
  await download(deps.fetchHTTP, req.body.url);
  res.end();
});

app.post('/validated', async (req, res) => {
  const url = req.body.url;
  validateUrl(url);
  await deps.fetchHTTP({
    url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
  res.end();
});

app.post('/fixed-destination', async (req, res) => {
  await deps.fetchHTTP({
    url: 'https://example.com/submit',
    method: 'post',
    body: req.body.url,
    handleResponseBody: 'discard',
  });
  res.end();
});

app.post('/overwrite', async (req, res) => {
  let url = req.body.url;
  url = 'https://example.com/fixed';
  await deps.fetchHTTP({
    url,
    method: 'get',
    handleResponseBody: 'discard',
  });
  res.end();
});

function makeHandler({ fetchHTTP }: { fetchHTTP: FetchHTTP }): RequestHandler {
  return async (req, res) => {
    await fetchHTTP({
      url: req.body.url, // $ hasUrlFlow
      method: 'get',
      handleResponseBody: 'discard',
    });
    res.end();
  };
}

const configured = route.post('/factory', (dependencies) => [
  makeHandler(dependencies),
]);
app[configured.method](configured.path, ...configured.handler(deps));

app.post('/response-source', async (_req, res) => {
  const response = await deps.fetchHTTP({
    url: 'https://example.com/config',
    method: 'get',
    handleResponseBody: 'as-json',
  });
  await deps.fetchHTTP({
    url: response.body.nextUrl, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
  res.end();
});

const fetchers = makeCachedFetchers(deps.fetchHTTP);
app.post('/cached-one-prefix', async (req, res) => {
  await fetchers.onePrefixFetcher({
    url: req.body.url,
    apiKey: 'fixture-only',
  });
  res.end();
});
app.post('/cached-two-prefixes', async (req, res) => {
  await fetchers.twoPrefixFetcher({
    url: req.body.url,
    apiKey: 'fixture-only',
  });
  res.end();
});
