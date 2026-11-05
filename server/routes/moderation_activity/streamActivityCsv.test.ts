import { Writable } from 'node:stream';

import {
  activityCsvHeader,
  activityCsvLine,
  type ActivityCsvLookups,
  type ActivityRow,
} from '../../services/moderationActivityFeed/index.js';
import { streamActivityCsv } from './streamActivityCsv.js';

const row = (id: string): ActivityRow => ({
  kind: 'DECISION',
  id,
  ts: new Date('2026-08-05T14:00:00Z'),
  payload: {
    id,
    jobId: id,
    queueId: null,
    reviewerId: '',
    decisions: [{ type: 'IGNORE' }],
    decisionReason: null,
    assignedAt: null,
    jobCreatedAt: null,
  },
});

const lookups: ActivityCsvLookups = {
  actionNames: new Map(),
  policyNames: new Map(),
  queueNames: new Map(),
  reviewerNames: new Map(),
  uiUrl: 'https://coop.example',
};

const stream = async (pages: AsyncIterable<ActivityRow[]>, out: Writable) =>
  streamActivityCsv({ pages, out, includeActions: false, lookups });

const slowSink = (onChunk: (chunk: string) => void = () => {}) =>
  new Writable({
    highWaterMark: 1,
    write(chunk, _enc, cb) {
      onChunk(String(chunk));
      setImmediate(cb);
    },
  });

describe('streamActivityCsv', () => {
  it('writes the header and every row, then ends, while waiting for each drain', async () => {
    let written = '';
    const out = slowSink((chunk) => {
      written += chunk;
    });
    let pulls: { buffered: number; closeListeners: number }[] = [];
    async function* pages() {
      for (let i = 0; i < 30; i += 1) {
        pulls = [
          ...pulls,
          {
            buffered: out.writableLength,
            closeListeners: out.listenerCount('close'),
          },
        ];
        yield [row(`d-${i}`)];
      }
    }

    await stream(pages(), out);

    expect(pulls).toHaveLength(30);
    expect(pulls.every((it) => it.buffered === 0)).toBe(true);
    expect(Math.max(...pulls.map((it) => it.closeListeners))).toBeLessThan(3);
    expect(written).toBe(
      activityCsvHeader(false) +
        Array.from({ length: 30 }, (_, i) =>
          activityCsvLine(row(`d-${i}`), false, lookups),
        ).join(''),
    );
    expect(out.writableEnded).toBe(true);
  });

  it('stops paging when the response closes', async () => {
    const out = slowSink();
    let pulled = 0;
    let finished = false;
    async function* pages() {
      try {
        for (;;) {
          pulled += 1;
          yield [row(`d-${pulled}`)];
          out.destroy();
        }
      } finally {
        finished = true;
      }
    }

    await stream(pages(), out);

    expect(pulled).toBeLessThanOrEqual(2);
    expect(finished).toBe(true);
  });

  it('pulls nothing when the response already closed', async () => {
    const out = slowSink();
    out.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    let pulled = 0;
    async function* pages() {
      pulled += 1;
      yield [row('d-1')];
    }

    await stream(pages(), out);

    expect(pulled).toBe(0);
  });
});
