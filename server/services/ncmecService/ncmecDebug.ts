import ncmecConfig from '#config/ncmec';

import { jsonStringify } from '../../utils/encoding.js';

// Opt-in debug logs + XML/JSON dumps for NCMEC submissions. `ncmecConfig.debug`
// requires `NCMEC_DEBUG` *and* a non-production environment, so we cannot leak
// reportable content in shared environments. Never log credentials.

export function ncmecDebugLog(
  event: string,
  fields: Record<string, unknown>,
): void {
  if (!ncmecConfig.debug) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(jsonStringify({ ncmecDebug: event, ...fields }));
}

export async function ncmecDebugDump(
  filename: string,
  contents: string,
): Promise<void> {
  if (!ncmecConfig.debug) {
    return;
  }
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'ncmec-reports');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), contents, 'utf-8');
  } catch {
    // Don't let local debugging IO break submission.
  }
}
