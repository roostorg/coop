import { CoopMeter } from '../../../utils/CoopMeter.js';
import ClaimOperations from '../modules/ClaimOperations.js';
import JobDecisioning from '../modules/JobDecisioning.js';
import SkipOperations from '../modules/SkipOperations.js';

const typed = <T>(value: unknown) => value as T;
const jobId =
  Buffer.from('bull').toString('base64url') +
  ':' +
  Buffer.from('c604cb4a-ec4c-4e96-a63a-9c2b9cc2fab5').toString('base64url');
const job = {
  id: jobId,
  orgId: 'org',
  createdAt: new Date(1000).toISOString(),
  payload: {
    kind: 'DEFAULT',
    item: {
      itemId: 'item',
      data: {},
      itemTypeIdentifier: { id: 'type', version: 'v' },
    },
  },
};

function setupDecision(execute: () => Promise<unknown>) {
  const meter = new CoopMeter();
  const events = jest.spyOn(meter.manualReviewEventsCounter, 'add');
  const durations = jest.spyOn(meter.manualReviewDurationHistogram, 'record');
  const removeJob = jest.fn(async () => {});
  const values = jest.fn(() => ({ execute }));
  const args: ConstructorParameters<typeof JobDecisioning> = [
    typed({ getJobs: async () => [job], removeJob }),
    typed({ insertInto: () => ({ values }) }),
    typed(async () => []),
    async () => {},
    typed({ getItemType: async () => null }),
    typed({
      addSpan: (_: unknown, fn: (span: unknown) => unknown) =>
        fn({ setAttribute: () => {} }),
      logSpanFailed: () => {},
    }),
    typed({}),
    typed({ getLatestClaimedAt: async () => new Date(3000) }),
    async () => false,
    meter,
  ];
  const instance = new JobDecisioning(...args);
  const input = typed<Parameters<typeof instance.submitDecision>[0]>({
    orgId: 'org',
    queueId: 'queue',
    jobId,
    lockToken: 'reviewer',
    reviewerId: 'reviewer',
    reviewerEmail: 'test@example.invalid',
    decisionReason: 'test',
    relatedActions: [],
    decisionComponents: [{ type: 'IGNORE' }],
  });
  return { instance, input, events, durations, removeJob, values };
}

describe('actual review persistence metric boundaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('records a decision only after insert resolves, even if subsequent queue removal fails', async () => {
    const before = Date.now();
    let resolve!: () => void;
    const stored = new Promise<void>((r) => {
      resolve = r;
    });
    const f = setupDecision(async () => stored);
    f.removeJob.mockRejectedValueOnce(new Error('redis unavailable'));
    const result = f.instance.submitDecision(f.input);
    const failure = expect(result).rejects.toThrow();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(f.values).toHaveBeenCalled();
    expect(f.events).not.toHaveBeenCalled();
    resolve();
    await failure;
    expect(f.events).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        event: 'decision_stored',
        queue_id: 'queue',
        automatic: false,
      }),
    );
    const claim = f.durations.mock.calls.find(
      ([, tags]) => tags?.phase === 'claim_elapsed',
    )![0];
    const total = f.durations.mock.calls.find(
      ([, tags]) => tags?.phase === 'total_to_decision',
    )![0];
    expect(claim).toBeGreaterThanOrEqual(before - 3000);
    expect(claim).toBeLessThanOrEqual(Date.now() - 3000);
    expect(total - claim).toBe(2000);
  });

  it.each([
    'database unavailable',
    'duplicate key value violates unique constraint "manual_review_decisions_pkey"',
  ])('does not emit a new decision on insert failure: %s', async (error) => {
    const f = setupDecision(async () => {
      throw new Error(error);
    });
    await expect(f.instance.submitDecision(f.input)).rejects.toThrow();
    expect(f.events).not.toHaveBeenCalled();
    expect(f.durations).not.toHaveBeenCalled();
  });

  it('automatic closes emit totals but never human claim timing', async () => {
    const before = Date.now();
    const f = setupDecision(async () => []);
    const automatic = {
      ...f.input,
      decisionComponents: undefined,
      automaticCloseDecision: { type: 'AUTOMATIC_CLOSE', reason: 'test' },
    };
    await f.instance.submitDecision(typed(automatic));
    expect(f.events).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        automatic: true,
        decision_type: 'AUTOMATIC_CLOSE',
      }),
    );
    expect(f.durations).toHaveBeenCalledTimes(1);
    expect(f.durations.mock.calls[0][1]).toEqual(
      expect.objectContaining({ phase: 'total_to_decision' }),
    );
    expect(f.durations.mock.calls[0][0]).toBeGreaterThanOrEqual(before - 1000);
  });

  it.each(['claim', 'skip'] as const)(
    '%s logging emits only after persistence and not on failure',
    async (kind) => {
      const meter = new CoopMeter();
      const events = jest.spyOn(meter.manualReviewEventsCounter, 'add');
      let resolve!: () => void;
      const executeTakeFirst = jest.fn(
        async () =>
          new Promise<void>((r) => {
            resolve = r;
          }),
      );
      const db = {
        insertInto: () => ({ values: () => ({ executeTakeFirst }) }),
      };
      const input = {
        orgId: 'org',
        queueId: 'queue',
        userId: 'reviewer',
        jobId,
      };
      const run =
        kind === 'claim'
          ? async () =>
              new ClaimOperations(typed(db), meter).logClaim(typed(input))
          : async () => new SkipOperations(typed(db), meter).logSkip(input);
      const pending = run();
      expect(events).not.toHaveBeenCalled();
      resolve();
      await pending;
      expect(events).toHaveBeenCalledWith(1, {
        event: `${kind}_recorded`,
        queue_id: 'queue',
      });
      events.mockClear();
      executeTakeFirst.mockRejectedValueOnce(new Error('database unavailable'));
      await expect(run()).rejects.toThrow();
      expect(events).not.toHaveBeenCalled();
    },
  );
});
