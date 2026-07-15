#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill each workshop org's review queues with a fixed set of sample posts,
 * so every team opens Coop to content (some crafted to trip the seeded scam
 * rules). Reuses the real ingestion endpoint (POST /api/v1/items/async), so
 * items run through HMA, rules, and routing exactly like live traffic.
 *
 * Reads org API keys and item-type IDs from the JSON that `seed-orgs` writes,
 * and the post templates from a bundled fixture. The Coop server must be up.
 *
 * Usage (from repo root, after seed-orgs and after the server is running):
 *   npm run backfill-items -- --base-url http://localhost:8080
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { jsonParse, jsonStringify, type JsonOf } from '../utils/encoding.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = await yargs(hideBin(process.argv))
  .options({
    'base-url': {
      type: 'string',
      default: 'http://localhost:8080',
      description: 'Coop API server base URL',
    },
    creds: {
      type: 'string',
      default: 'workshop-credentials.json',
      description: 'JSON written by seed-orgs (org API keys + item-type IDs)',
    },
    fixture: {
      type: 'string',
      default: resolve(HERE, 'fixtures/trustcon-sample-posts.json'),
      description: 'Sample-posts fixture to replay into every org',
    },
    'per-org': {
      type: 'number',
      description: 'Cap how many posts to submit per org (default: all)',
    },
    'batch-size': {
      type: 'number',
      default: 25,
      description: 'Items per POST request',
    },
  })
  .help()
  .parse();

type OrgCreds = {
  name: string;
  orgId: string;
  apiKey: string;
  postTypeId: string | null;
  accountTypeId: string | null;
};
type PostTemplate = { handle: string; text: string; images?: string[] };

function readJson<T>(path: string): T {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied CLI path
  const raw = readFileSync(path, 'utf8');
  return jsonParse(raw as JsonOf<T>);
}

function buildItems(org: OrgCreds, posts: PostTemplate[]) {
  const nowIso = new Date().toISOString();
  return posts.map((p, i) => {
    const did = `did:web:${p.handle}`;
    const rkey = `sample${String(i + 1).padStart(3, '0')}`;
    const atUri = `at://${did}/app.bsky.feed.post/${rkey}`;
    const data: Record<string, unknown> = {
      text: p.text,
      authorDid: { id: did, typeId: org.accountTypeId },
      authorHandle: p.handle,
      rkey,
      createdAt: nowIso,
      atUri,
      isLive: false,
    };
    if (p.images?.length) data.images = p.images;
    // A stable id keeps re-runs idempotent (same (id, typeId) within the org).
    return { id: atUri, typeId: org.postTypeId, data };
  });
}

async function submitBatch(
  baseUrl: string,
  apiKey: string,
  items: unknown[],
): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- one-shot setup CLI outside the DI request path; fetchHTTP's mocking/instrumentation add nothing here
  const res = await fetch(`${baseUrl}/api/v1/items/async`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: jsonStringify({ items }),
  });
  if (res.status !== 202) {
    throw new Error(`expected 202, got ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const orgs = readJson<OrgCreds[]>(argv.creds);
  const fixture = readJson<{ posts: PostTemplate[] }>(argv.fixture);
  let posts = fixture.posts;
  if (argv['per-org'] != null) posts = posts.slice(0, argv['per-org']);

  const baseUrl = argv['base-url'].replace(/\/$/, '');
  const batchSize = Math.max(1, argv['batch-size']);
  let okOrgs = 0;
  let totalItems = 0;

  for (const org of orgs) {
    if (!org.postTypeId || !org.accountTypeId) {
      console.warn(
        `⚠️  Skipping ${org.name} (${org.orgId}): missing item-type IDs. ` +
          `Was it seeded? Re-run seed-orgs with --seed.`,
      );
      continue;
    }
    const items = buildItems(org, posts);
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        await submitBatch(baseUrl, org.apiKey, items.slice(i, i + batchSize));
      }
      okOrgs++;
      totalItems += items.length;
      console.log(`✅ ${org.name}: submitted ${items.length} posts`);
    } catch (error) {
      console.error(`❌ ${org.name} (${org.orgId}) failed:`, error);
    }
  }

  console.log(
    `\n✅ Backfilled ${okOrgs}/${orgs.length} orgs, ${totalItems} items total.` +
      `\nItems are async (202); allow a moment for the queue to drain, then check each org's review queues.\n`,
  );
  process.exit(okOrgs === orgs.length ? 0 : 1);
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
