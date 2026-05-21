#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * AT Protocol content proxy for local Coop demos.
 *
 * Serves Bluesky posts as embeddable HTML pages for the MRT review iframe.
 * A proxy is necessary because bsky.app sets X-Frame-Options: SAMEORIGIN,
 * preventing direct embedding.
 *
 * Prerequisites:
 *   Set VITE_CONTENT_URL_PATTERN=bsky.app in client/.env
 *
 * Usage:
 *   npm run atproto:proxy
 *
 * Options:
 *   --port   Port to listen on  [default: 4000]
 */

import http from 'node:http';
import process from 'node:process';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const port = Number(getArg('--port') ?? '4000');

const BSKY_API = 'https://public.api.bsky.app/xrpc';

function isDid(s: string): boolean {
  return s.startsWith('did:');
}

async function resolveActor(actor: string): Promise<string> {
  if (isDid(actor)) return actor;
  const res = await fetch(
    `${BSKY_API}/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
  );
  if (!res.ok) throw new Error(`Failed to resolve actor ${actor}: ${res.status}`);
  const data = (await res.json()) as { did: string };
  return data.did;
}

interface BskyPost {
  uri: string;
  author: { handle: string; displayName?: string };
  record: { text: string; createdAt?: string };
}

async function fetchPost(did: string, rkey: string): Promise<BskyPost> {
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const res = await fetch(
    `${BSKY_API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`,
  );
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
  const data = (await res.json()) as { thread: { post: BskyPost } };
  return data.thread.post;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPost(post: BskyPost, bskyUrl: string): string {
  const { author, record } = post;
  const name = author.displayName ? escapeHtml(author.displayName) : '';
  const handle = escapeHtml(author.handle);
  const text = escapeHtml(record.text).replace(/\n/g, '<br>');
  const date = escapeHtml(formatDate(record.createdAt));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bluesky post by @${handle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.5;
      color: #0f1419;
      background: #fff;
      padding: 20px;
      transition: filter 0.2s ease;
    }
    .card {
      border: 1px solid #cfd9de;
      border-radius: 12px;
      padding: 16px;
      max-width: 600px;
    }
    .author { display: flex; flex-direction: column; margin-bottom: 12px; }
    .display-name { font-weight: 700; font-size: 15px; }
    .handle { color: #536471; font-size: 14px; }
    .text { font-size: 16px; margin-bottom: 12px; word-break: break-word; }
    .meta { display: flex; align-items: center; gap: 12px; }
    .date { color: #536471; font-size: 13px; }
    .link { color: #1d9bf0; text-decoration: none; font-size: 13px; }
    .link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="author">
      ${name ? `<span class="display-name">${name}</span>` : ''}
      <span class="handle">@${handle}</span>
    </div>
    <p class="text">${text}</p>
    <div class="meta">
      ${date ? `<span class="date">${date}</span>` : ''}
      <a class="link" href="${escapeHtml(bskyUrl)}" target="_blank" rel="noopener">View on Bluesky</a>
    </div>
  </div>
  <script>
    // Blur strengths (levels 1–3) mapped to CSS pixel values
    var BLUR_PX = [0, 4, 8, 16];

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || data.type !== 'customControl') return;
      var filters = [];
      if (data.blur > 0) {
        filters.push('blur(' + (BLUR_PX[Math.min(data.blur, 3)] ?? 8) + 'px)');
      }
      if (data.grayscale) {
        filters.push('grayscale(100%)');
      }
      document.body.style.filter = filters.join(' ');
    });
  </script>
</body>
</html>`;
}

function errorPage(status: number, message: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#c00"><h2>${status}</h2><p>${escapeHtml(message)}</p></body></html>`;
}

const BSKY_URL_RE = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/;

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' || !req.url) {
    res.writeHead(405);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${port}`);
  const contentUrl = reqUrl.searchParams.get('contentUrl');

  if (!contentUrl) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(errorPage(400, 'Missing contentUrl parameter'));
    return;
  }

  const match = BSKY_URL_RE.exec(contentUrl);
  if (!match) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(errorPage(400, `Unrecognized URL: ${contentUrl}`));
    return;
  }

  const [, actor, rkey] = match;

  try {
    const did = await resolveActor(actor);
    const post = await fetchPost(did, rkey);
    const html = renderPost(post, contentUrl);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors *",
    });
    res.end(html);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR: ${String(err)}`);
    res.writeHead(502, { 'Content-Type': 'text/html' });
    res.end(errorPage(502, `Failed to fetch post: ${String(err)}`));
  }
});

server.listen(port, () => {
  console.log(`atproto content proxy listening on http://localhost:${port}`);
  console.log(
    `Also ensure VITE_CONTENT_URL_PATTERN=bsky.app is set in client/.env\n`,
  );
});
