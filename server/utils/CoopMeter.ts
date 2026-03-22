import opentelemetry from '@opentelemetry/api';

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
  }
}
