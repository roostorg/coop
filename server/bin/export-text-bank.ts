#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Export a text bank to a JSON file for sharing with another org.
 *
 * Usage:
 *   npm run export-text-bank -- \
 *     --bank-id <id> \
 *     --org-id <orgId> \
 *     [--output <path>]
 *
 * The output file can be imported into another org using import-text-bank.ts.
 */
import { writeFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import { jsonStringify } from '../utils/encoding.js';
import { isCoopErrorOfType } from '../utils/errors.js';

const argv = await yargs(hideBin(process.argv))
  .options({
    'bank-id': {
      type: 'string',
      demandOption: true,
      description: 'ID of the text bank to export',
    },
    'org-id': {
      type: 'string',
      demandOption: true,
      description: 'Org ID that owns the text bank',
    },
    output: {
      type: 'string',
      description: 'Output file path (defaults to <bank-name>.json)',
    },
  })
  .help()
  .parse();

async function exportTextBank() {
  const bottle = await getBottle();
  const container = bottle.container;

  try {
    const textBank = await container.ModerationConfigService.getTextBank({
      id: argv['bank-id'],
      orgId: argv['org-id'],
    });

    const exportData = {
      name: textBank.name,
      description: textBank.description ?? null,
      type: textBank.type,
      strings: textBank.strings,
    };

    const outputPath =
      argv.output ??
      `${textBank.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}.json`;

    writeFileSync(outputPath, jsonStringify(exportData) + '\n');

    console.log(`\nText bank exported successfully!\n`);
    console.log(`Name:    ${textBank.name}`);
    console.log(`Type:    ${textBank.type}`);
    console.log(`Strings: ${textBank.strings.length}`);
    console.log(`Output:  ${outputPath}\n`);

    await container.closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    if (isCoopErrorOfType(error, 'MatchingBankNotFoundError')) {
      console.error(
        `\nText bank not found: no bank with ID "${argv['bank-id']}" exists for org "${argv['org-id']}"\n`,
      );
    } else {
      console.error('\nError exporting text bank:\n');
      console.error(error);
    }

    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }

    process.exit(1);
  }
}

exportTextBank().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
