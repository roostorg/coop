import { SpanStatusCode, trace } from '@opentelemetry/api';
import { vi } from 'vitest';

import SafeTracer from '../utils/SafeTracer.js';
import ContentAccessService, {
  ContentAccessError,
  type ContentAccessRequest,
} from './contentAccessService.js';

const request: ContentAccessRequest = {
  orgId: 'private-org',
  actorId: 'private-actor',
  requestId: 'request-id',
  resourceType: 'review_job',
  resourceId: 'private-job',
  field: 'payload',
};

it.each(['authorize', 'record'] as const)(
  'traces sanitized %s failures without content or actor identifiers',
  async (stage) => {
    const tracer = trace.getTracer('content-access-test');
    const span = tracer.startSpan('test');
    const exception = vi.spyOn(span, 'recordException');
    const status = vi.spyOn(span, 'setStatus');
    const end = vi.spyOn(span, 'end');
    const start = vi.spyOn(tracer, 'startSpan').mockReturnValue(span);
    const secret = new Error('https://private.example/?token=secret');
    const service = new ContentAccessService(
      {
        [stage]: async () => {
          throw secret;
        },
      },
      new SafeTracer(tracer),
    );
    try {
      await expect(service.beforeAccess(request)).rejects.toEqual(
        new ContentAccessError('unavailable'),
      );
      expect(start).toHaveBeenCalledWith(
        `${stage}:ContentAccessService`,
        expect.objectContaining({
          attributes: expect.objectContaining({
            'content_access.stage': stage,
            'content_access.resource_type': 'review_job',
            'content_access.field': 'payload',
            'content_access.request_id': 'request-id',
          }),
        }),
      );
      const attributes = start.mock.calls[0][1].attributes as Record<
        string,
        unknown
      >;
      expect(
        Object.keys(attributes).filter((key) =>
          key.startsWith('content_access.'),
        ),
      ).toEqual([
        'content_access.stage',
        'content_access.resource_type',
        'content_access.field',
        'content_access.request_id',
      ]);
      expect(exception).toHaveBeenCalledTimes(1);
      expect(exception).toHaveBeenCalledWith(
        new ContentAccessError('unavailable'),
      );
      expect(exception).not.toHaveBeenCalledWith(secret);
      expect(status).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
      expect(end).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
    }
  },
);

it('does not create dependency spans with no configured callbacks', async () => {
  const tracer = trace.getTracer('content-access-test-noop');
  const start = vi.spyOn(tracer, 'startSpan');
  try {
    await expect(
      new ContentAccessService({}, new SafeTracer(tracer)).beforeAccess(
        request,
      ),
    ).resolves.toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  } finally {
    start.mockRestore();
  }
});
