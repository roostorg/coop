# Observability

Coop uses [OpenTelemetry](https://opentelemetry.io/docs/concepts/) to record traces and metrics, so you can see where a request spent its time and where it failed. See also [Local Development](local.md) and [Architecture](architecture.md).

## Overview

Telemetry is off by default. When you start the server with `npm run start:trace`, it loads the OpenTelemetry SDK and begins sending traces and metrics to an OpenTelemetry Collector. Locally, the collector passes traces on to Jaeger, where you can browse them.

```
server (start:trace) ──OTLP gRPC :4317──▶ otel-collector ──▶ Jaeger (UI :16686)
browser (opt-in)     ──OTLP HTTP :4318──▶ otel-collector
```

## Quick start

```sh
cd nodejs-instrumentation && npm ci && npm run build && cd ..
npm run up
cd server && npm run start:trace
```

Once the server is running, open Jaeger at [localhost:16686](http://localhost:16686) and select `COOP_TEST_SERVICE` (the `OTEL_SERVICE_NAME` in `server/.env.example`) to see recent requests.

You'll see a `metrics export failed (... 12 UNIMPLEMENTED ...)` message every 60 seconds, which is expected: the local collector only accepts traces. Workers started with `npm run runWorkerOrJob` don't load the SDK, so they aren't traced.

## Configuration

| Variable                                  | Package        | Purpose                                                    |
| ----------------------------------------- | -------------- | ---------------------------------------------------------- |
| `OTEL_SERVICE_NAME`                       | Server         | Service name in Jaeger                                     |
| `OTEL_EXPORTER_OTLP_*`                    | Server         | Standard OTLP exporter settings (default `localhost:4317`) |
| `GIT_COMMIT_SHA`, `GIT_REPOSITORY_URL`    | Server         | Added to the trace resource                                |
| `LOG_REQUEST_BODY`                        | Server         | Meant to record request bodies; currently has no effect    |
| `VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Client (build) | Enables frontend tracing                                   |

Keep in mind that spans can contain user content. SQL text and Redis commands are recorded by default, so review what they contain before sending traces to a shared backend.

## How it works

### Loading the SDK

Application code only uses `@opentelemetry/api`, which does nothing on its own. `npm run start:trace` brings it to life by preloading `nodejs-instrumentation` with `node --require`, so the SDK is in place before the app starts and can patch libraries such as `http` and `pg`.

From there, the SDK (`nodejs-instrumentation/src/autoinstrumentation.ts`):

- Exports over OTLP/gRPC, batching spans every 500 ms and metrics every 60 seconds. Pending spans are flushed on `SIGTERM`.
- Propagates context with the AWS X-Ray header (`X-Amzn-Trace-Id`), not W3C `traceparent`.
- Enables the standard Node.js auto-instrumentations. Outgoing HTTP spans are named `METHOD origin`, `/api/v1/ready` is ignored, and long Redis arguments are truncated.

Because the server is an ES module and the SDK is loaded with `--require` rather than OpenTelemetry's ESM loader hook, instrumentations only patch modules that are loaded with `require`. Postgres and Redis are still traced, since their code is loaded that way (Redis through BullMQ's CommonJS build), but Express isn't: its middleware spans come from the router instrumentation, so Coop's Express hook for `LOG_REQUEST_BODY` never runs. Redis commands are only traced inside an existing span, such as a request.

### Request tracing

Most spans come from auto-instrumentation, so a typical request already shows its middleware, resolvers, and queries. Unhandled REST errors are also recorded, on a `handleError:app` span from the Express error handler in `server/api.ts`.

### Background jobs

The trail stops at the job queue. Trace context isn't passed through BullMQ, so `ItemProcessingWorker` jobs start a new trace rather than continuing the request that enqueued them.

### Frontend tracing

Tracing can also start in the browser. Building the client with `VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` enables `client/src/FrontendTracer.ts`, which traces requests as `coop-ui` and adds the X-Ray header so server spans join the browser's trace. It also records request bodies. To use it locally, publish the collector's port 4318 and configure CORS on it.

### Deployments

The published Docker images don't include the SDK. Instead, `nodejs-instrumentation/Dockerfile` builds an image for injecting it with an init container, such as the OpenTelemetry Operator.

## Instrumenting code

### Adding spans

Auto-instrumentation shows what the infrastructure did, but not what the work meant. To add that context, inject `Tracer` (`SafeTracer`), which ends spans and records errors for you. See the server [README](https://github.com/roostorg/coop/blob/main/server/README.md#tracinglogging) for more examples.

```typescript
class MyService {
  constructor(private readonly tracer: Dependencies['Tracer']) {}

  async loadQueue(orgId: string) {
    return this.tracer.addActiveSpan(
      { resource: 'appeals', operation: 'loadQueue' },
      async (span) => {
        span.addEvent('cache miss', { orgId });
        return this.loadFromDb(orgId);
      },
    );
  }
}

export default inject(['Tracer'], MyService);
```

This creates a span named `loadQueue:appeals`, and the event shows up under its Logs in Jaeger. Keep names generic, so the same operation groups together across traces, and put IDs in attributes or events.

| Method          | Use                                                       |
| --------------- | --------------------------------------------------------- |
| `addActiveSpan` | Default. Work inside nests under the new span             |
| `addSpan`       | Times work without becoming the parent of spans inside it |
| `traced`        | Wraps a function so every call is traced                  |

If an error is thrown inside a span, the span is marked as failed, unless the error is a `CoopError` with `shouldErrorSpan: false`. For errors you catch and handle yourself, record them with `span.recordException(error)`.

Spans that describe meaningful operations belong in the codebase, and spans added only to investigate a problem should be removed before opening a PR.

### Metrics

Where traces follow individual requests, metrics track totals over time. `Meter` (`CoopMeter`) defines the server's counters and histograms, named `coop-api.*`, for item submissions and processing, reports, appeals, and manual review. See [Manual-review Telemetry](deployment.md#manual-review-telemetry) for the manual-review metrics.

Since the local collector doesn't accept them, collecting metrics means pointing `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` at a collector with a metrics pipeline.

### Logging

Coop leans on spans rather than log lines. `console` is disallowed by ESLint in server code, so diagnostic detail goes on spans as attributes or `span.addEvent()`, where it stays tied to the request. `logJson` and `logErrorJson` in `server/utils/logging.ts` cover startup, before the tracer exists.

## Available IOC Services

| Service  | Type         | Purpose                 |
| -------- | ------------ | ----------------------- |
| `Tracer` | `SafeTracer` | Span helpers            |
| `Meter`  | `CoopMeter`  | Counters and histograms |

## File Structure

```
nodejs-instrumentation/   # SDK setup and injection image
server/utils/SafeTracer.ts
server/utils/CoopMeter.ts
client/src/FrontendTracer.ts
otel-collector.yaml       # Local collector config
```
