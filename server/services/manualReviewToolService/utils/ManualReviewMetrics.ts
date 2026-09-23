import { type CoopMeter } from '../../../utils/CoopMeter.js';

export type ReviewMetricAttributes = {
  queue_id: string;
  item_type_id?: string;
  decision_type?: string;
  automatic?: boolean;
};

// Metrics must not change review behaviour if an exporter fails.
export class ManualReviewMetrics {
  constructor(private readonly meter?: CoopMeter) {}

  event(event: string, attributes: ReviewMetricAttributes) {
    try {
      this.meter?.manualReviewEventsCounter.add(1, { event, ...attributes });
    } catch {
      /* Best-effort telemetry, not an audit ledger. */
    }
  }

  gauge(
    kind: string,
    value: number,
    attributes: ReviewMetricAttributes & { state?: string },
  ) {
    try {
      this.meter?.manualReviewSnapshotGauge.record(value, {
        kind,
        ...attributes,
      });
    } catch {
      /* Best-effort telemetry. */
    }
  }

  duration(
    phase: string,
    start: Date | string | null,
    end: Date,
    attributes: ReviewMetricAttributes,
  ) {
    const startMs =
      start instanceof Date
        ? start.getTime()
        : typeof start === 'string' && start.includes('T')
          ? Date.parse(start)
          : NaN;
    const value = end instanceof Date ? end.getTime() - startMs : NaN;
    if (!Number.isFinite(value) || value < 0) {
      this.event(`timing_unavailable_${phase}`, attributes);
      return;
    }
    try {
      this.meter?.manualReviewDurationHistogram.record(value, {
        phase,
        ...attributes,
      });
    } catch {
      /* Best-effort telemetry. */
    }
  }
}
