import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const FrontendTracer = async () => {
  const { ZoneContextManager } = await import('@opentelemetry/context-zone');

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'coop-ui',
    }),
  });

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: import.meta.env.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      }),
    ),
  );

  const contextManager = new ZoneContextManager();

  provider.register({
    contextManager,
    propagator: new AWSXRayPropagator(),
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-fetch': {
          propagateTraceHeaderCorsUrls: /.*/,
          clearTimingResources: true,
          applyCustomAttributesOnSpan(span, request, _result) {
            span.setAttribute(
              'http.request.body',
              request.body?.toString() ?? '',
            );
          },
        },
      }),
    ],
  });
};

export default FrontendTracer;
