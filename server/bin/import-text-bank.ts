#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Import a text bank from a JSON file into an org.
 *
 * Usage:
 *   npm run import-text-bank -- \
 *     --org-id <orgId> \
 *     --file <path>
 *
 * The input file should be a JSON file produced by export-text-bank.ts.
 */
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import { tryJsonParse } from '../utils/encoding.js';
import { isCoopErrorOfType } from '../utils/errors.js';

const argv = await yargs(hideBin(process.argv))
  .options({
    'org-id': {
      type: 'string',
      demandOption: true,
      description: 'Org ID to import the text bank into',
    },
    file: {
      type: 'string',
      demandOption: true,
      description: 'Path to the JSON file produced by export-text-bank.ts',
    },
  })
  .help()
  .parse();

type TextBankExport = {
  name: string;
  description: string | null;
  type: 'STRING' | 'REGEX';
  strings: string[];
};

function parseExportFile(filePath: string): TextBankExport {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Could not read file: ${filePath}`);
  }

  const parsed = tryJsonParse(raw);
  if (parsed === undefined) {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).name !== 'string' ||
    !['STRING', 'REGEX'].includes(
      (parsed as Record<string, unknown>).type as string,
    ) ||
    !Array.isArray((parsed as Record<string, unknown>).strings) ||
    !((parsed as Record<string, unknown>).strings as unknown[]).every(
      (s) => typeof s === 'string',
    )
  ) {
    throw new Error(
      `File does not look like a text bank export. Expected { name, type, strings, description? }.`,
    );
  }

  const data = parsed as Record<string, unknown>;
  return {
    name: data.name as string,
    description: typeof data.description === 'string' ? data.description : null,
    type: data.type as 'STRING' | 'REGEX',
    strings: data.strings as string[],
  };
}

async function importTextBank() {
  let exportData: TextBankExport;
  try {
    exportData = parseExportFile(argv.file);
  } catch (error: unknown) {
    console.error(
      `\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }

  const bottle = await getBottle();
  const container = bottle.container;

  try {
    const newBank = await container.ModerationConfigService.createTextBank(
      argv['org-id'],
      {
        name: exportData.name,
        description: exportData.description,
        type: exportData.type,
        strings: exportData.strings,
        ownerId: null,
      },
    );

    console.log(`\nText bank imported successfully!\n`);
    console.log(`Name:    ${newBank.name}`);
    console.log(`Type:    ${newBank.type}`);
    console.log(`Strings: ${newBank.strings.length}`);
    console.log(`New ID:  ${newBank.id}\n`);

    await container.closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    if (isCoopErrorOfType(error, 'MatchingBankNameExistsError')) {
      console.error(
        `\nA text bank named "${exportData.name}" already exists in org "${argv['org-id']}". Rename it first or delete the existing bank.\n`,
      );
    } else {
      console.error('\nError importing text bank:\n');
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

importTextBank().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
