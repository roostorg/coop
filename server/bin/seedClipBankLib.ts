/* eslint-disable no-console */
// The directory comes from the operator running this CLI, so the paths below
// are expected to be non-literal.
/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Helpers for `bin/seed-clip-bank.ts`. Split out so the logic can be tested
 * without the IoC container; not intended for general reuse.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { type HmaService } from '../services/hmaService/index.js';

/** Larger files are skipped, so one stray file cannot exhaust memory. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export type SeedResult = {
  added: string[];
  failed: { file: string; error: string }[];
};

/** The image files directly inside `dir`, in name order. */
export async function listImageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() in IMAGE_TYPES,
    )
    .map((entry) => entry.name)
    .sort();
}

/**
 * Adds every image in `dir` to a hash bank. HMA hashes each image with every
 * signal type it has enabled, so with CLIP enabled the bank gets CLIP
 * embeddings too. Throws if the bank does not exist; a failure on one image is
 * recorded and the rest still run.
 */
export async function seedClipBank(args: {
  hmaService: Pick<
    HmaService,
    'getBank' | 'isClipEnabled' | 'addContentToBank'
  >;
  orgId: string;
  bankName: string;
  dir: string;
  dryRun: boolean;
  log?: (line: string) => void;
}): Promise<SeedResult> {
  const { hmaService, orgId, bankName, dir, dryRun, log = console.log } = args;

  const bank = await hmaService.getBank(orgId, bankName);
  if (!bank) {
    throw new Error(`No bank named "${bankName}" found for org ${orgId}.`);
  }

  const files = await listImageFiles(dir);
  if (files.length === 0) {
    throw new Error(`No image files (jpg, png, gif, webp) found in ${dir}.`);
  }
  log(`Bank "${bank.name}" (${bank.hma_name})`);
  if (!hmaService.isClipEnabled()) {
    log(
      'Note: HMA_CLIP_ENABLED is not set, so CLIP matching is off for this deployment.',
    );
  }

  const result: SeedResult = { added: [], failed: [] };
  // CLIP hashing is slow, so upload one image at a time.
  for (const name of files) {
    if (dryRun) {
      log(`  ${name}  would add`);
      continue;
    }
    try {
      const filePath = path.join(dir, name);
      const { size } = await stat(filePath);
      if (size > MAX_IMAGE_BYTES) {
        throw new Error(
          `file is ${size} bytes, over the ${MAX_IMAGE_BYTES} byte limit`,
        );
      }
      const bytes = await readFile(filePath);
      const content = await hmaService.addContentToBank(bank.hma_name, {
        file: new File([bytes], name, {
          type: IMAGE_TYPES[path.extname(name).toLowerCase()],
        }),
        contentType: 'photo',
        metadata: {
          content_id: createHash('sha256').update(bytes).digest('hex'),
          json: { file_name: name },
        },
      });
      result.added.push(name);
      log(`  ${name}  added (HMA content id ${content.id})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ file: name, error: message });
      log(`  ${name}  FAILED (${message})`);
    }
  }
  return result;
}
