import opentelemetry from '@opentelemetry/api';

import { logJson } from './logging.js';

export class CoopMeter {
  /**
   * This counter is used to track item submissions that are run through the rule
   * engine. This includes items submitted thru submitItem, submitContent, and
   * submitReport but does not include item submissions from the partial items
   * endpoint.
   */
  public readonly itemSubmissionsCounter: opentelemetry.Counter;
  public readonly reportsCounter: opentelemetry.Counter;
  public readonly appealsCounter: opentelemetry.Counter;
  public readonly scyllaRecordAgeHistogram: opentelemetry.Histogram;
  // Counts the number of items Dequeued by item-processing-workers that are
  // meant to be processed. In the case of no errors, this metric should match
  // 1:1 with the `itemSubmissionsCounter`
  public readonly itemProcessingAttemptsCounter: opentelemetry.Counter;
  // Counts the number of errors thrown while processing item submissions in
  // the item-processing-worker nodes. A high ratio of failures:attempts likely
  // indicates a bug in the processing code or an infrastructure/network issue
  // that is preventing progress from being made
  public readonly itemProcessingFailuresCounter: opentelemetry.Counter;
  // Tracks the time a worker spends processing a single job.
  public readonly itemProcessingJobTime: opentelemetry.Histogram;
  // Snapshot of waiting + active jobs in the queue, sampled after each
  // job completes. Useful for detecting backpressure.
  public readonly itemProcessingQueueDepth: opentelemetry.Histogram;
  // Counts the number of items sent to the processing queue
  // this is mostly for debugging, and should allow us to confirm
  // the percentage of traffic we are sending to the queue and
  // expect to be processed by the worker deployment
  public readonly itemsEnqueued: opentelemetry.Counter;

  /**
   * Metrics related to the Manual Review Tool (MRT) lifecycle
   */
  public readonly manualReviewEventsCounter: opentelemetry.Counter;
  public readonly manualReviewDurationHistogram: opentelemetry.Histogram;
  private nextManualReviewWarningAt = 0;

  constructor() {
    const metricNamespace = 'coop-api';
    const myMeter = opentelemetry.metrics.getMeter('api-service-meter');
    /**
     * Metrics related to user requests to the API
     */
    this.itemSubmissionsCounter = myMeter.createCounter(
      `${metricNamespace}.items.counter`,
    );
    this.reportsCounter = myMeter.createCounter(
      `${metricNamespace}.reports.counter`,
    );
    this.appealsCounter = myMeter.createCounter(
      `${metricNamespace}.appeals.counter`,
    );

    /**
     * Metrics related to the Item Investigation Service
     * and its underlying Datastores
     */
    this.scyllaRecordAgeHistogram = myMeter.createHistogram(
      `${metricNamespace}.scyllaRecordAge.histogram`,
    );

    /**
     * Metrics related to the Item Processing Queue and
     * Item Processing Workers
     */
    this.itemProcessingAttemptsCounter = myMeter.createCounter(
      `${metricNamespace}.items.processing-attempts.counter`,
    );
    this.itemProcessingFailuresCounter = myMeter.createCounter(
      `${metricNamespace}.items.processing-failures.counter`,
    );
    this.itemsEnqueued = myMeter.createCounter(
      `${metricNamespace}.items.enqueued-to-processing-queue.counter`,
    );
    this.itemProcessingJobTime = myMeter.createHistogram(
      `${metricNamespace}.items.job-processing-time-ms.histogram`,
    );
    this.itemProcessingQueueDepth = myMeter.createHistogram(
      `${metricNamespace}.items.queue-depth.histogram`,
    );

    /**
     * Metrics related to the Manual Review Tool
     */
    this.manualReviewEventsCounter = myMeter.createCounter(
      `${metricNamespace}.manual_review.events.counter`,
      { unit: '1', description: 'Manual-review lifecycle operation counts' },
    );
    this.manualReviewDurationHistogram = myMeter.createHistogram(
      `${metricNamespace}.manual_review.duration_ms.histogram`,
      {
        unit: 'ms',
        description: 'Elapsed manual-review time, including idle time',
      },
    );
  }

  recordManualReviewEvent(
    event: string,
    attributes?: Record<string, string | number | boolean>,
  ) {
    try {
      this.manualReviewEventsCounter.add(1, {
        ...attributes,
        event,
      });
    } catch {
      this.logManualReviewTelemetryFailure('counter', event);
    }
  }

  recordManualReviewDuration(
    phase: string,
    start: Date | string | null,
    end: Date,
    attributes?: Record<string, string | number | boolean>,
  ) {
    const startMs =
      start instanceof Date
        ? start.getTime()
        : typeof start === 'string' && start.includes('T')
          ? Date.parse(start)
          : NaN;
    const value = end instanceof Date ? end.getTime() - startMs : NaN;
    if (!Number.isFinite(value) || value < 0) {
      this.recordManualReviewEvent(`timing_unavailable_${phase}`, attributes);
      return;
    }
    try {
      this.manualReviewDurationHistogram.record(value, {
        ...attributes,
        phase,
      });
    } catch {
      this.logManualReviewTelemetryFailure('histogram', phase);
    }
  }

  private logManualReviewTelemetryFailure(
    instrument: 'counter' | 'histogram',
    operation: string,
  ) {
    try {
      const now = Date.now();
      if (now < this.nextManualReviewWarningAt) return;
      this.nextManualReviewWarningAt = now + 60_000;
      // eslint-disable-next-line no-restricted-syntax -- Meter has no SafeTracer dependency.
      logJson({
        event: 'manual_review.telemetry',
        level: 'WARN',
        instrument,
        operation,
        outcome: 'error',
      });
    } catch {
      /* Logging must not affect review operations. */
    }
  }
}
