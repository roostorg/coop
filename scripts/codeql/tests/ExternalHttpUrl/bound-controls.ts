import express from 'express';

import type { FetchHTTP } from './services/networkingService/index.js';

declare const fetchHTTP: FetchHTTP;
const app = express();

async function onePrefix(client: FetchHTTP, url: string) {
  return client({
    url, // $ hasUrlFlow
    method: 'get',
    handleResponseBody: 'discard',
  });
}
class OnePrefixConsumer {
  constructor(private readonly send: (url: string) => unknown) {}
  run(url: string) {
    return this.send(url);
  }
}
const one = new OnePrefixConsumer(onePrefix.bind(null, fetchHTTP));
app.post('/one-prefix', async (req, res) => {
  await one.run(req.body.url);
  res.end();
});

async function twoPrefixes(client: FetchHTTP, token: string, url: string) {
  return client({
    url, // $ hasUrlFlow
    headers: { Authorization: token },
    method: 'get',
    handleResponseBody: 'discard',
  });
}
class TwoPrefixConsumer {
  constructor(private readonly send: (url: string) => unknown) {}
  run(url: string) {
    return this.send(url);
  }
}
function makeTwo(client: FetchHTTP) {
  return new TwoPrefixConsumer(twoPrefixes.bind(null, client, 'fixture-only'));
}
const two = makeTwo(fetchHTTP);
app.post('/two-prefixes', async (req, res) => {
  await two.run(req.body.url);
  res.end();
});

async function objectInput(
  client: FetchHTTP,
  request: { destination: string; body: string },
) {
  return client({
    url: request.destination,
    body: request.body,
    method: 'post',
    handleResponseBody: 'discard',
  });
}
class ObjectConsumer {
  constructor(
    private readonly send: (request: {
      destination: string;
      body: string;
    }) => unknown,
  ) {}
  run(request: { destination: string; body: string }) {
    return this.send(request);
  }
}
const object = new ObjectConsumer(objectInput.bind(null, fetchHTTP));
app.post('/fixed-object-destination', async (req, res) => {
  await object.run({
    destination: 'https://example.com/fixed',
    body: req.body.url,
  });
  res.end();
});

async function pinnedDestination(client: FetchHTTP, url: string, body: string) {
  return client({
    url,
    body,
    method: 'post',
    handleResponseBody: 'discard',
  });
}
class PinnedConsumer {
  constructor(private readonly send: (body: string) => unknown) {}
  run(body: string) {
    return this.send(body);
  }
}
const pinned = new PinnedConsumer(
  pinnedDestination.bind(null, fetchHTTP, 'https://example.com/pinned'),
);
app.post('/pinned-destination', async (req, res) => {
  await pinned.run(req.body.url);
  res.end();
});

async function overwrittenDestination(client: FetchHTTP, url: string) {
  url = 'https://example.com/overwritten';
  return client({
    url,
    method: 'get',
    handleResponseBody: 'discard',
  });
}
class OverwrittenConsumer {
  constructor(private readonly send: (url: string) => unknown) {}
  run(url: string) {
    return this.send(url);
  }
}
const overwritten = new OverwrittenConsumer(
  overwrittenDestination.bind(null, fetchHTTP),
);
app.post('/overwritten-destination', async (req, res) => {
  await overwritten.run(req.body.url);
  res.end();
});
