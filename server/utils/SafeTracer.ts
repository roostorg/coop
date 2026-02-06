import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
  type SpanOptions,
  type Tracer,
} from '@opentelemetry/api';

import { CoopError } from './errors.js';
import { thrownValueToString } from './misc.js';

// The built-in Otel type for attributes incorrectly uses mutable array types
// for array-valued attributes (suggesting that the otel sdk might mutate the
// array given as the attributes, when it won't); this makes it
// impossible/annoying to pass readonly arrays as attributes. The built-in otel
// attributes type also indicates that null/undefined are legal attribute
// values, when they're in fact invalid and have undefined behavior.
type CorrectedAttributes = {
  [attributeKey: string]:
    | string
    | number
    | boolean
    | readonly string[]
    | readonly number[]
    | readonly boolean[];
};

type CorrectedSpanOptions = Omit<SpanOptions, 'attributes'> & {
  attributes?: CorrectedAttributes;
};

/**
 * In OpenTelemetry, a span represents a unit of work that's part of a larger
 * trace. OpenTelemetry spans all have a name, which can be an arbitrary string,
 * but the idea is to use a name that makes it easy to identify the "same"
 * operation across different traces by grouping by name. This lets you easily
 * get stats for the operation (e.g., median latency). So, "getUserById" might
 * be a good span name, but including the id of the user in the span name would
 * not be good (there'd be too many distinct span names for useful grouping).
 *
 * We use a structured (resource, operation) pair for spans. The idea is that
 * multiple resources can support the same operations, and observability tools
 * can let you group your spans by resource or by operation. E.g., there might
 * be an operation called `http.request`, which is the operation name the server
 * uses to refer to it handling of an incoming HTTP request. Then, each endpoint
 * might be a different resource. So, you could have a span for `(POST /content,
 * http.request)` and one for `(POST /report, http.request)`.
 *
 * This type takes a resource and operation, which is used to generate a
 * plain-string span name, but also capture this underlying (resource,
 * operation) structure so we can get the full value out of observability UIs.
 */
type StructuredSpanName = { resource: string; operation: string };

/**
 * As a convenience for callers, we exploit the fact that there's (currently) no
 * overlapping keys between StructuredSpanName and SpanOptions (and this is
 * unlikely to change) to allow callers to pass all the data in one blob.
 */
type SpanDescriptor = StructuredSpanName & CorrectedSpanOptions;

/**
 * This class builds on OpenTelemetry's built-in Tracer, but it exposes methods
 * that take care of a lot of fiddly error handling details automatically, so
 * that we don't have to duplicate + get those details right everywhere.
 */
export default class SafeTracer {
  constructor(private readonly tracer: Tracer) {}

  #onSpanSuccess<T>(span: Span, returnValue: T) {
    // NB: we intentionally don't set SpanStatus.OK here, as we wouldn't want to
    // that override the span's status if it's been set explicitly to ERROR
    // (e.g., to indicate an error that was recovered from or swallowed, which
    // led the span-creation function to still return/resolve successfully). See
    // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/api.md#set-status
    span.end();
    return returnValue;
  }

  #onSpanFailure(span: Span, thrownValue: unknown): never {
    this.logSpanFailed(span, thrownValue);
    span.end();
    throw thrownValue;
  }

  #wrapSpanFn<T>(fn: (span: Span) => T) {
    return (span: Span) => {
      try {
        const res = fn(span);
        const resIsPromiseLike =
          res &&
          typeof res === 'object' &&
          'then' in res &&
          typeof res.then === 'function';

        return resIsPromiseLike
          ? ((res as { then: Promise<Awaited<T>>['then'] }).then(
              (ultimateResult) => this.#onSpanSuccess(span, ultimateResult),
              (e) => this.#onSpanFailure(span, e),
            ) as T)
          : this.#onSpanSuccess(span, res);
      } catch (error) {
        this.#onSpanFailure(span, error);
      }
    };
  }

  /**
   * In OTel, spans have a name + kind. Our app forms spans using resource
   * and operation components, to make it easier to review traces. We turn
   * those components into a valid, unstructured Otel span name, while
   * preserving the components as attributes in that span. That's what this
   * function does.
   */
  #spanDescriptorToOtelData(it: SpanDescriptor) {
    const { operation, resource, ...spanOpts } = it;

    // We prefix the final operation name w/ "app." to differentiate these
    // manual operations from ones added by auto instrumentation libs.
    const appOperation = `app.${operation}`;

    return {
      name: `${operation}:${resource}`,
      options: {
        attributes: {
          'resource.name': resource,
          'operation.name': appOperation,
          ...spanOpts.attributes,
        },
        // Default span kind to internal, though the opts on an
        // individual span can override this.
        kind: SpanKind.INTERNAL,
        ...spanOpts,
      },
    };
  }

  addActiveSpan<T>(spanDescriptor: SpanDescriptor, fn: (span: Span) => T): T {
    const { name, options } = this.#spanDescriptorToOtelData(spanDescriptor);

    return this.tracer.startActiveSpan(
      name,
      options satisfies CorrectedSpanOptions as SpanOptions,
      this.#wrapSpanFn(fn),
    );
  }

  addSpan<T>(spanDescriptor: SpanDescriptor, fn: (span: Span) => T): T {
    const { name, options } = this.#spanDescriptorToOtelData(spanDescriptor);

    const span = this.tracer.startSpan(
      name,
      options satisfies CorrectedSpanOptions as SpanOptions,
    );
    return this.#wrapSpanFn(fn)(span);
  }

  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Takes a function and returns a new function that will run the original
   * function, but trace its work as the active span.
   *
   * DO NOT USE THIS IF THE ORIGINAL FUNCTION IS GENERIC (i.e., has type
   * parameters), as TS will likely lose the parameteric-ness of the function's
   * signature and have to type each parameter using its constraint.
   *
   * The original function doesn't receive the span as an argument, so doesn't
   * need to know (and can't easily know) that it's being traced. If the
   * function does need the span (e.g., to set other attributes on it or log
   * failure in a custom way), use {@link addActiveSpan} instead.
   *
   * @param spanDescriptor Describes the span to create. Allows an extra field,
   *  `attributesFromArgs`, which can return attributes to add to the span
   *  dynamically, based on the arguments passed to the wrapped function.
   * @param fn The function to wrap
   * @returns A new function that will run the original function, but track its
   *   work as the active span.
   */
  traced<Args extends unknown[], Return>(
    spanDescriptor: SpanDescriptor & {
      attributesFromArgs?: (args: Args) => CorrectedAttributes;
    },
    fn: (this: void, ...args: Args) => Return,
  ): (...args: Args) => Return {
    return (...args: Args) => {
      const finalDescriptor = spanDescriptor.attributesFromArgs
        ? {
            ...spanDescriptor,
            attributes: {
              ...spanDescriptor.attributes,
              ...spanDescriptor.attributesFromArgs(args),
            },
          }
        : spanDescriptor;

      return this.addActiveSpan(finalDescriptor, () => fn(...args));
    };
  }

  /**
   * Use this function in error cases within spans. Specifically, this function
   * records the exception on the span as well as setting the span's status code
   * to ERROR. This means that we're not only recording what the error is, but
   * our observability tools will know that the span itself errored out.
   *
   * You don't need to use this if your function was wrapped in {@link addSpan}
   * or {@link addActiveSpan} _and it throws/rejects when it fails_, as those
   * functions will automatically call this function in those cases w/ the
   * thrown or rejection value.
   */
  logSpanFailed(span: Span, error: unknown) {
    if (error instanceof Error) {
      span.recordException(error);
    }
    // when we explicitly indicate the exception shouldn't mark span status as ERROR, we return early
    if (error instanceof CoopError && !error.shouldErrorSpan) {
      return;
    }

    // otherwise we set the span status to ERROR
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: thrownValueToString(error),
    });
  }

  logActiveSpanFailedIfAny(error: unknown) {
    const span = this.getActiveSpan();
    span && span.isRecording() && this.logSpanFailed(span, error);
  }
}
