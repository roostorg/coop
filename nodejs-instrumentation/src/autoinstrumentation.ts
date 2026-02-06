/* eslint-disable no-console */
// We'll load this file with `node --require` before starting our servers, to
// instrument our app automatically and configure where to send traces.
//
// NB: these imports are written with `import` syntax, since TS seems to require
// that in order to load the type definitions properly. But TS knows that we're
// in a CJS context (which, unfortunately, we have to be b/c node's `--require`
// flag only supports CJS modules) because of the `.cts` extension, so it
// transpiles these imports to require calls as needed.
//
// NB: the order here is important, to make sure that instrumentations load
// first. That's part of why we want these compiled to use `require()` too,
// rather than true imports, which I believe would be topologically sorted
// before being executed. Accordingly, we disable import sorting below.
// prettier-ignore
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type DiagLogFunction,
  type DiagLogger,
} from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { awsEc2Detector } from '@opentelemetry/resource-detector-aws';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import {
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  Resource,
} from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
class JsonConsoleDiagLogger implements DiagLogger {
  public readonly diagConsoleLogger = new DiagConsoleLogger();
  private formatMessage(message: string): string {
    // eslint-disable-next-line no-restricted-syntax
    return JSON.stringify({ message });
  }

  error: DiagLogFunction = (message, ...args) =>
    this.diagConsoleLogger.error(this.formatMessage(message), ...args);
  warn: DiagLogFunction = (message, ...args) =>
    this.diagConsoleLogger.warn(this.formatMessage(message), ...args);
  info: DiagLogFunction = (message, ...args) =>
    this.diagConsoleLogger.info(this.formatMessage(message), ...args);
  debug: DiagLogFunction = (message, ...args) =>
    this.diagConsoleLogger.debug(this.formatMessage(message), ...args);
  verbose: DiagLogFunction = (message, ...args) =>
    this.diagConsoleLogger.verbose(this.formatMessage(message), ...args);
}
diag.setLogger(new JsonConsoleDiagLogger(), DiagLogLevel.INFO);

const serviceName = process.env.OTEL_SERVICE_NAME;
const exporter = new OTLPTraceExporter();

function getApproxStringLength(arg: unknown): number {
  if (typeof arg === 'string' || arg instanceof Buffer) {
    return arg.length;
  } else if (Array.isArray(arg)) {
    return arg.reduce<number>(
      (acc, cur) => acc + getApproxStringLength(cur),
      0,
    );
  }

  // Handle arg typeof arg === 'number' or something unexpected.
  // Args should hopefully be (number | string | Buffer) | (number | string | Buffer)[]
  return 10;
}

const sdk = new NodeSDK({
  autoDetectResources: true,
  traceExporter: exporter,
  textMapPropagator: new AWSXRayPropagator(),
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      maxExportBatchSize: 400,
      scheduledDelayMillis: 500,
      maxQueueSize: 4096,
    }),
  ],
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  resource: Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.GIT_COMMIT_SHA,
      'git.commit.sha': process.env.GIT_COMMIT_SHA,
      'git.repository_url': process.env.GIT_REPOSITORY_URL,
    }),
  ),
  resourceDetectors: [
    // Standard resource detectors.
    containerDetector,
    envDetector,
    hostDetector,
    osDetector,
    processDetector,

    // NB: we don't use the EKS detectors because it seemed to result in
    // ocassional crashes of the server on startup, and may be causing an
    // (unexpected and substrantial) increase in memory usage.
    // If we bring back the EKS detector, we need to order it before the EC2 one, per
    // https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/resourcedetectionprocessor/README.md#ordering
    awsEc2Detector,
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        /**
         * A hook that's called both when our server receives an incoming
         * HTTP request, and when it makes an outgoing HTTP request.
         *
         * We use this hook to give the span a more precise name on outgoing
         * requests, which is very helpful when reviewing our traces, without
         * increasing the cardinality too much.
         *
         * NB: if we start making HTTP calls that don't go through a load balancer
         * (e.g., if we're calling out to another Coop service, and the client
         * knows about the currently-running instances of the service), then adding
         * host to the span name could increase the cardinality too much. See
         * https://github.com/open-telemetry/opentelemetry-specification/pull/416#discussion_r369591004
         * But we'll cross that bridge when we come to it; for now, this is much better.
         */
        requestHook(span, request) {
          // Because the hook is called on incoming and outgoing requests,
          // we need to make sure we're dealing w/ an outgoing request.
          if (!('read' in request)) {
            const origin = request.protocol + '//' + request.host;
            const spanName = `${request.method} ${origin}`;
            span.updateName(spanName);

            span.setAttribute('resource.name', spanName);
            span.setAttribute('operation.name', 'http.request');
          }
        },
        headersToSpanAttributes: {
          client: { responseHeaders: ['content-length'] },
          server: {
            requestHeaders: [
              'x-forwarded-for',
              'x-forwarded-proto',
              'x-forwarded-host',
              'x-amzn-trace-id',
              'original-host',
            ],
            responseHeaders: ['content-length'],
          },
        },
        ignoreIncomingRequestHook(request) {
          return request.url === '/api/v1/ready';
        },
      },
      '@opentelemetry/instrumentation-express': {
        requestHook(span, requestInfo) {
          if (process.env.LOG_REQUEST_BODY === 'true')
            span.setAttribute(
              'http.request.body',
              // eslint-disable-next-line no-restricted-syntax
              JSON.stringify(requestInfo.request.body),
            );
        },
      },

      // TODO: eventually use the host being looked up as the `resource.name`
      // Blocked on https://github.com/open-telemetry/opentelemetry-js-contrib/pull/1178
      // '@opentelemetry/instrumentation-dns': {},
      '@opentelemetry/instrumentation-fs': {
        createHook() {
          return false;
        },
        endHook(_fnName, { args, span }) {
          // If the first arg is a string, assume it's the name of the file/dir
          // to operate on (read, write, delete, mv, etc).
          if (typeof args[0] === 'string') {
            span.setAttribute('resource.name', args[0]);
          }
        },
      },
      '@opentelemetry/instrumentation-ioredis': {
        // truncate long command args to avoid dropping spans when exporting
        dbStatementSerializer: (cmdName, cmdArgs) => {
          return `${cmdName} ${cmdArgs
            .map((arg) => {
              return getApproxStringLength(arg) < 100
                ? arg
                : '[Large Argument Omitted]';
            })
            .join(' ')}`;
        },
      },
    }),
  ],
});

// initialize the SDK and register with the OpenTelemetry API
// this enables the API to record telemetry
sdk.start();

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
