import { CoopMeter } from '../../../utils/CoopMeter.js';
import { ManualReviewMetrics } from './ManualReviewMetrics.js';

describe('native review metric semantics', () => {
  const meter = new CoopMeter();
  const metrics = new ManualReviewMetrics(meter);
  const attrs = {
    queue_id: 'queue',
    item_type_id: 'type',
    decision_type: 'IGNORE',
    automatic: false,
  };
  it('emits elapsed time from the correct boundary', () => {
    const record = jest.spyOn(meter.manualReviewDurationHistogram, 'record');
    metrics.duration('claim_elapsed', new Date(2000), new Date(5000), attrs);
    expect(record).toHaveBeenCalledWith(3000, {
      phase: 'claim_elapsed',
      ...attrs,
    });
  });
  it('accepts timestamps after BullMQ JSON serialization', () => {
    const record = jest.spyOn(meter.manualReviewDurationHistogram, 'record');
    metrics.duration(
      'total_to_decision',
      '2026-09-01T00:00:00.000Z',
      new Date('2026-09-01T00:00:05.000Z'),
      attrs,
    );
    expect(record).toHaveBeenCalledWith(5000, {
      phase: 'total_to_decision',
      ...attrs,
    });
  });
  it('invalid or missing timestamps do not become zero-duration samples', () => {
    const record = jest.spyOn(meter.manualReviewDurationHistogram, 'record');
    const add = jest.spyOn(meter.manualReviewEventsCounter, 'add');
    for (const start of [null, new Date(NaN), new Date(6000)])
      metrics.duration('claim_elapsed', start, new Date(5000), attrs);
    expect(record).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(3);
    expect(add).toHaveBeenCalledWith(1, {
      event: 'timing_unavailable_claim_elapsed',
      ...attrs,
    });
  });
  it('does not let metric failures affect a review', () => {
    jest
      .spyOn(meter.manualReviewEventsCounter, 'add')
      .mockImplementation(() => {
        throw new Error('exporter');
      });
    jest
      .spyOn(meter.manualReviewSnapshotGauge, 'record')
      .mockImplementation(() => {
        throw new Error('exporter');
      });
    expect(() => metrics.event('decision_stored', attrs)).not.toThrow();
    expect(() =>
      metrics.duration('claim_elapsed', null, new Date(), attrs),
    ).not.toThrow();
    expect(() =>
      metrics.gauge('success', 1, { queue_id: 'all' }),
    ).not.toThrow();
  });
  afterEach(() => jest.restoreAllMocks());
});
