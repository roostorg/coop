#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * AT Protocol content proxy for local Coop demos.
 *
 * Serves AT Protocol posts as embeddable HTML pages for the MRT review iframe.
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

interface BskyEmbed {
  $type: string;
  // external link card
  external?: { uri: string; title: string; description: string; thumb?: string };
  // image grid
  images?: Array<{
    thumb: string;
    fullsize: string;
    alt: string;
    aspectRatio?: { width: number; height: number };
  }>;
  // video
  thumbnail?: string;
  alt?: string;
  // quote post
  record?: {
    author: { handle: string; displayName?: string };
    value: { text: string };
  };
  // recordWithMedia: record + media (images or external)
  media?: BskyEmbed;
}

interface BskyPost {
  uri: string;
  author: { handle: string; displayName?: string };
  record: { text: string; createdAt?: string };
  embed?: BskyEmbed;
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

function hostname(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return uri;
  }
}

function renderEmbed(embed: BskyEmbed, postUrl: string): string {
  const type = embed.$type;

  if (type === 'app.bsky.embed.external#view' && embed.external) {
    const { uri, title, description, thumb } = embed.external;
    return `
  <a class="embed-external" href="${escapeHtml(uri)}" target="_blank" rel="noopener">
    ${thumb ? `<img class="embed-external-thumb" src="${escapeHtml(thumb)}" alt="">` : ''}
    <div class="embed-external-meta">
      <div class="embed-external-title">${escapeHtml(title)}</div>
      ${description ? `<div class="embed-external-desc">${escapeHtml(description)}</div>` : ''}
      <div class="embed-external-host">${escapeHtml(hostname(uri))}</div>
    </div>
  </a>`;
  }

  if (type === 'app.bsky.embed.images#view' && embed.images?.length) {
    const imgs = embed.images
      .slice(0, 4)
      .map(
        (img) =>
          `<img src="${escapeHtml(img.thumb)}" alt="${escapeHtml(img.alt)}" loading="lazy">`,
      )
      .join('\n    ');
    const gridClass = embed.images.length === 1 ? 'embed-images single' : 'embed-images';
    return `\n  <div class="${gridClass}">\n    ${imgs}\n  </div>`;
  }

  if (type === 'app.bsky.embed.video#view') {
    return `
  <a class="embed-video" href="${escapeHtml(postUrl)}" target="_blank" rel="noopener">
    ${embed.thumbnail ? `<img src="${escapeHtml(embed.thumbnail)}" alt="${escapeHtml(embed.alt ?? '')}">` : ''}
    <div class="embed-video-play">&#9654;</div>
  </a>`;
  }

  if (type === 'app.bsky.embed.record#view' && embed.record) {
    const { author, value } = embed.record;
    const qName = author.displayName ? escapeHtml(author.displayName) : '';
    const qHandle = escapeHtml(author.handle);
    const qText = escapeHtml(value.text).replace(/\n/g, '<br>');
    return `
  <div class="embed-quote">
    <div class="embed-quote-author">
      ${qName ? `<span class="embed-quote-name">${qName}</span>` : ''}
      <span class="embed-quote-handle">@${qHandle}</span>
    </div>
    <div class="embed-quote-text">${qText}</div>
  </div>`;
  }

  if (type === 'app.bsky.embed.recordWithMedia#view') {
    const mediaPart = embed.media ? renderEmbed(embed.media, postUrl) : '';
    const recordPart = embed.record
      ? renderEmbed({ $type: 'app.bsky.embed.record#view', record: embed.record }, postUrl)
      : '';
    return mediaPart + recordPart;
  }

  return '';
}

function renderPost(post: BskyPost, postUrl: string): string {
  const { author, record, embed } = post;
  const name = author.displayName ? escapeHtml(author.displayName) : '';
  const handle = escapeHtml(author.handle);
  const text = escapeHtml(record.text).replace(/\n/g, '<br>');
  const date = escapeHtml(formatDate(record.createdAt));
  const embedHtml = embed ? renderEmbed(embed, postUrl) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>atproto post by @${handle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.5;
      color: #0f1419;
      background: #fff;
      padding: 20px;
    }
    img { filter: var(--img-filter, none); transition: filter 0.2s ease; cursor: zoom-in; }
    img:hover { filter: none; }
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
    .meta { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
    .date { color: #536471; font-size: 13px; }
    .link { color: #1d9bf0; text-decoration: none; font-size: 13px; }
    .link:hover { text-decoration: underline; }

    /* External link card */
    .embed-external {
      display: flex;
      flex-direction: column;
      border: 1px solid #cfd9de;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 12px;
      text-decoration: none;
      color: inherit;
    }
    .embed-external:hover { background: #f7f9f9; }
    .embed-external-thumb { width: 100%; max-height: 220px; object-fit: cover; }
    .embed-external-meta { padding: 10px 12px; }
    .embed-external-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
    .embed-external-desc { font-size: 13px; color: #536471; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .embed-external-host { font-size: 12px; color: #536471; }

    /* Image grid */
    .embed-images { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; border-radius: 8px; overflow: hidden; margin-top: 12px; }
    .embed-images.single { grid-template-columns: 1fr; }
    .embed-images img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .embed-images.single img { aspect-ratio: unset; max-height: 400px; object-fit: contain; background: #000; }

    /* Video */
    .embed-video { display: block; position: relative; border-radius: 8px; overflow: hidden; margin-top: 12px; }
    .embed-video img { width: 100%; display: block; }
    .embed-video-play {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 48px; color: #fff;
      text-shadow: 0 0 8px rgba(0,0,0,0.6);
      background: rgba(0,0,0,0.15);
    }

    /* Quote post */
    .embed-quote {
      border: 1px solid #cfd9de;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 12px;
      font-size: 14px;
    }
    .embed-quote-author { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
    .embed-quote-name { font-weight: 700; }
    .embed-quote-handle { color: #536471; }
    .embed-quote-text { word-break: break-word; }
  </style>
</head>
<body>
  <div class="card">
    <div class="author">
      ${name ? `<span class="display-name">${name}</span>` : ''}
      <span class="handle">@${handle}</span>
    </div>
    <p class="text">${text}</p>
    ${embedHtml}
    <div class="meta">
      ${date ? `<span class="date">${date}</span>` : ''}
      <a class="link" href="${escapeHtml(postUrl)}" target="_blank" rel="noopener">View on bsky.app</a>
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
      document.documentElement.style.setProperty('--img-filter', filters.length ? filters.join(' ') : 'none');
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
