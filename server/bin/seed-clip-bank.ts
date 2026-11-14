#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Adds the images in a directory to a hash bank. HMA hashes each image with
 * every signal type it has enabled, so with CLIP enabled the bank gets CLIP
 * embeddings as well.
 *
 * The bank must already exist (create it under Automated Enforcement, Matching
 * Banks). Images are only compared with CLIP if they were added while CLIP was
 * enabled in HMA, so seed again after enabling it. Running this twice
 * on the same directory adds the images twice: HMA cannot list a bank, so
 * there is nothing to check against. Use --dry-run to see what would be added.
 *
 * Usage:
 *   pnpm run seed-clip-bank \
 *     --org "<orgId>" \
 *     --bank "<bank name>" \
 *     --dir "<directory of images>" \
 *     [--dry-run]
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import { seedClipBank } from './seedClipBankLib.js';

const argv = await yargs(hideBin(process.argv))
  .strict()
  .options({
    org: { type: 'string', demandOption: true, description: 'Organization ID' },
    bank: { type: 'string', demandOption: true, description: 'Bank name' },
    dir: {
      type: 'string',
      demandOption: true,
      description: 'Directory of image files to add',
    },
    'dry-run': {
      type: 'boolean',
      default: false,
      description: 'List the images without adding them',
    },
  })
  .help()
  .parse();

async function main() {
  const { container } = await getBottle();
  try {
    const result = await seedClipBank({
      hmaService: container.HMAHashBankService,
      orgId: argv.org,
      bankName: argv.bank,
      dir: argv.dir,
      dryRun: argv['dry-run'],
    });
    console.log(
      `${result.added.length} added, ${result.failed.length} failed` +
        (argv['dry-run'] ? ' (dry run, nothing was added)' : ''),
    );
    process.exit(result.failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

await main();
