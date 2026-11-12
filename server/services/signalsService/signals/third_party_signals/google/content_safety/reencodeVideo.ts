import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { makeSignalPermanentError } from '../../../../../../utils/errors.js';
import { safeGet } from '../../../../../../utils/misc.js';

const execFileAsync = promisify(execFile);

// Fixed negative offset recommended by Google so sampled frames aren't
// predictable.
const START_OFFSET_SECONDS = '-0.132';
const FFMPEG_TIMEOUT_MS = 20_000;

/**
 * Re-encodes a video into the format the Content Safety API requires. Uses
 * temp files because some MP4s can't be read from a pipe.
 */
export async function reencodeVideoForContentSafety(
  video: Buffer,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'coop-content-safety-'));
  const inputPath = path.join(dir, 'input');
  const outputPath = path.join(dir, 'output.webm');

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is under a fresh mkdtemp dir
    await writeFile(inputPath, video);
    // prettier-ignore
    await execFileAsync('ffmpeg', [
      '-nostdin', '-loglevel', 'error',
      '-ss', START_OFFSET_SECONDS,
      '-i', inputPath,
      '-c:v', 'libsvtav1', '-crf', '36',
      '-c:a', 'libopus', '-b:a', '8k',
      '-filter:v', 'fps=1:round=up,scale=288:288',
      outputPath,
    ], { timeout: FFMPEG_TIMEOUT_MS });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is under a fresh mkdtemp dir
    return await readFile(outputPath);
  } catch (e) {
    // Timeouts can be retried; other failures (e.g. an unreadable file) can't.
    if (safeGet(e, ['killed']) === true) {
      throw e;
    }
    throw makeSignalPermanentError('Video could not be re-encoded', {
      shouldErrorSpan: true,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
