import { jsonStringify } from '../../utils/encoding.js';

// Opt-in debugging utilities for the NCMEC submission flow. Activate by
// setting `NCMEC_DEBUG=1` on a dev machine. Logs structured one-liners to
// stderr and dumps XML/JSON payloads to `ncmec-reports/` (gitignored) so the
// exact bytes we sent to NCMEC can be replayed via curl.
//
// Disabled in `NODE_ENV=production` so we cannot accidentally leak reportable
// content in shared environments. Never log credentials or request/response
// headers from this module.

export function ncmecDebugEnabled(): boolean {
  return (
    process.env.NCMEC_DEBUG === '1' && process.env.NODE_ENV !== 'production'
  );
}

export function ncmecDebugLog(
  event: string,
  fields: Record<string, unknown>,
): void {
  if (!ncmecDebugEnabled()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(jsonStringify({ ncmecDebug: event, ...fields }));
}

export async function ncmecDebugDump(
  filename: string,
  contents: string,
): Promise<void> {
  if (!ncmecDebugEnabled()) {
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
