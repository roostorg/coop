/* eslint-disable no-console */
/**
 * Populate the benign HMA hash bank with local images.
 *
 * `seed-trustcon` creates an empty hash bank ("CCF known-content stand-in
 * (benign)") per org but leaves it empty. There is no in-app image upload
 * (the hash-bank UI only wires external exchange feeds), so this script posts
 * each local image to HMA through the HMAHashBankService, giving the demo real
 * hash matches without a TVEC hash set.
 *
 * Run after seed-orgs/seed-trustcon and with the HMA service up.
 *
 * Usage (from repo root):
 *   npm run seed-hash-bank-images -- --org-id <id>
 *   npm run seed-hash-bank-images -- --all
 *   npm run seed-hash-bank-images -- --all --images-dir "trustcon/benign images"
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import { jsonParse, type JsonOf } from '../utils/encoding.js';

const DEFAULT_BANK_NAME = 'CCF known-content stand-in (benign)';
const MIME_BY_EXT = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

// repo root is two levels up from server/bin
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

const argv = await yargs(hideBin(process.argv))
  .options({
    'org-id': {
      type: 'string',
      description: 'Seed a single org by ID',
    },
    all: {
      type: 'boolean',
      default: false,
      description: 'Seed every org in the credentials file (--creds)',
    },
    creds: {
      type: 'string',
      default: 'workshop-credentials.json',
      description: 'JSON written by seed-orgs (used with --all)',
    },
    'images-dir': {
      type: 'string',
      default: path.join(REPO_ROOT, 'trustcon', 'benign images'),
      description: 'Folder of images to add to the bank',
    },
    'bank-name': {
      type: 'string',
      default: DEFAULT_BANK_NAME,
      description: 'Name of the hash bank to populate',
    },
  })
  .check((a) => {
    if (!a['org-id'] && !a.all) {
      throw new Error('Provide --org-id <id> or --all');
    }
    return true;
  })
  .help()
  .parse();

type OrgCreds = { orgId: string; name?: string };

function resolveOrgs(): { orgId: string; name: string }[] {
  const singleOrgId = argv['org-id'];
  if (singleOrgId != null) {
    return [{ orgId: singleOrgId, name: singleOrgId }];
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied CLI path
  const raw = readFileSync(argv.creds, 'utf8');
  const orgs = jsonParse(raw as JsonOf<OrgCreds[]>);
  return orgs.map((o) => ({ orgId: o.orgId, name: o.name ?? o.orgId }));
}

async function main(): Promise<void> {
  const imagesDir = argv['images-dir'];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied CLI path
  if (!existsSync(imagesDir)) {
    console.error(`Images dir not found: ${imagesDir}`);
    process.exit(1);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied CLI path
  const files = (await readdir(imagesDir)).filter(
    (f) => MIME_BY_EXT.get(path.extname(f).toLowerCase()) != null,
  );
  if (files.length === 0) {
    console.error(`No images (jpg/jpeg/png/webp) in ${imagesDir}`);
    process.exit(1);
  }
  console.log(`Adding ${files.length} image(s) from ${imagesDir}`);

  const bottle = await getBottle();
  const container = bottle.container;
  const hma = container.HMAHashBankService;

  const orgs = resolveOrgs();
  let totalAdded = 0;
  let skippedOrgs = 0;

  for (const org of orgs) {
    const bank = await hma.getBank(org.orgId, argv['bank-name']);
    if (!bank) {
      console.warn(
        `⚠️  ${org.name} (${org.orgId}): no bank "${argv['bank-name']}" — ` +
          `run seed-trustcon/seed-orgs first. Skipping.`,
      );
      skippedOrgs++;
      continue;
    }

    let added = 0;
    for (const file of files) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- files come from the operator-supplied images dir
      const buffer = await readFile(path.join(imagesDir, file));
      const mime = MIME_BY_EXT.get(path.extname(file).toLowerCase());
      const blob = new Blob([buffer], { type: mime });
      try {
        await hma.addContentToBank(bank.hma_name, {
          file: blob,
          contentType: 'photo',
          metadata: { content_id: file },
        });
        added++;
      } catch (error) {
        console.error(`   ✗ ${file}: ${(error as Error).message}`);
      }
    }
    totalAdded += added;
    console.log(
      `✅ ${org.name} (${org.orgId}): added ${added}/${files.length} to "${bank.name}"`,
    );
  }

  console.log(
    `\nDone. ${totalAdded} image(s) added across ${orgs.length - skippedOrgs} org(s).`,
  );
  process.exit(skippedOrgs > 0 ? 1 : 0);
}

await main();
