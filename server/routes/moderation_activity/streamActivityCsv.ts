import { type Writable } from 'node:stream';

import {
  activityCsvHeader,
  activityCsvLine,
  type ActivityCsvLookups,
  type ActivityRow,
} from '../../services/moderationActivityFeed/index.js';

async function writeChunk(out: Writable, chunk: string): Promise<void> {
  if (out.write(chunk)) {
    return;
  }
  await new Promise<void>((resolve) => {
    const done = () => {
      out.off('drain', done);
      out.off('close', done);
      resolve();
    };
    out.on('drain', done);
    out.on('close', done);
  });
}

export async function streamActivityCsv(opts: {
  pages: AsyncIterable<readonly ActivityRow[]>;
  out: Writable;
  includeActions: boolean;
  lookups: ActivityCsvLookups;
}): Promise<void> {
  const { pages, out, includeActions, lookups } = opts;
  let closed = false;
  out.once('close', () => {
    closed = true;
  });
  const isClosed = () => closed || out.destroyed;

  if (isClosed()) {
    return;
  }
  await writeChunk(out, activityCsvHeader(includeActions));
  for await (const page of pages) {
    if (isClosed()) {
      return;
    }
    await writeChunk(
      out,
      page.map((row) => activityCsvLine(row, includeActions, lookups)).join(''),
    );
  }
  if (!isClosed()) {
    out.end();
  }
}
