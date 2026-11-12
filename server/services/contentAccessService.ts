import { randomUUID } from 'node:crypto';

import { type default as SafeTracer } from '../utils/SafeTracer.js';

export type ContentAccessResource = Readonly<{
  resourceType: 'review_job' | 'item' | 'review_comment' | 'review_decision';
  resourceId: string;
  itemTypeId?: string;
  submissionId?: string;
  field: 'payload' | 'data' | 'commentText' | 'decisionReason';
}>;

export type ContentAccessRequest = ContentAccessResource &
  Readonly<{
    orgId: string;
    actorId: string;
    requestId: string;
  }>;

export type ContentAccessEvent = ContentAccessRequest &
  Readonly<{
    eventId: string;
    occurredAt: string;
    outcome: 'authorized' | 'denied';
  }>;

export type ContentAccessExtension = Readonly<{
  // Per callback; defaults to 5 seconds.
  timeoutMs?: number;
  // An additional restriction, not a replacement for Coop's authorization.
  authorize?: (
    request: ContentAccessRequest,
    signal: AbortSignal,
  ) => Promise<boolean>;
  record?: (event: ContentAccessEvent, signal: AbortSignal) => Promise<void>;
}>;

const registrations = new Map<symbol, ContentAccessExtension>();

export function registerContentAccessExtension(
  extension: ContentAccessExtension,
) {
  const id = Symbol();
  registrations.set(id, extension);
  return () => {
    registrations.delete(id);
  };
}

export function getRegisteredContentAccessExtension() {
  return [...registrations.values()].at(-1);
}

// Shared by the dependency container and its wiring tests.
export function makeContentAccessService(
  extension?: ContentAccessExtension,
  tracer?: SafeTracer,
) {
  return new ContentAccessService(
    extension ?? getRegisteredContentAccessExtension(),
    tracer,
  );
}

export class ContentAccessError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable') {
    super(
      reason === 'denied'
        ? 'Content access denied.'
        : 'Content access verification is unavailable.',
    );
    this.name = 'ContentAccessError';
  }
}

export default class ContentAccessService {
  private readonly extension: ContentAccessExtension;
  private readonly timeoutMs: number;

  constructor(
    extension: ContentAccessExtension = {},
    private readonly tracer?: SafeTracer,
  ) {
    this.timeoutMs =
      extension.timeoutMs === undefined ? 5_000 : extension.timeoutMs;
    if (
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs < 1 ||
      this.timeoutMs > 2_147_483_647
    ) {
      throw new RangeError(
        'Content access timeoutMs must be a positive 32-bit timer duration.',
      );
    }
    // Preserve prototype methods and their original receiver, including private fields.
    this.extension = Object.freeze({
      authorize: extension.authorize?.bind(extension),
      record: extension.record?.bind(extension),
    });
  }

  get enabled() {
    return (
      this.extension.authorize !== undefined ||
      this.extension.record !== undefined
    );
  }

  private async invoke<T>(
    stage: 'authorize' | 'record',
    request: ContentAccessRequest,
    callback: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const run = async () => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new ContentAccessError('unavailable');
          // Reject first so an abort listener cannot resolve access after expiry.
          reject(error);
          controller.abort(error);
        }, this.timeoutMs);
      });
      try {
        return await Promise.race([callback(controller.signal), deadline]);
      } catch {
        // Sanitize before SafeTracer sees the failure; raw exceptions may contain secrets.
        throw new ContentAccessError('unavailable');
      } finally {
        clearTimeout(timer);
      }
    };
    return this.tracer
      ? this.tracer.addSpan(
          {
            resource: 'ContentAccessService',
            operation: stage,
            attributes: {
              'content_access.stage': stage,
              'content_access.resource_type': request.resourceType,
              'content_access.field': request.field,
              'content_access.request_id': request.requestId,
            },
          },
          run,
        )
      : run();
  }

  async beforeAccess(request: ContentAccessRequest): Promise<void> {
    if (!this.enabled) return;
    // Reconstruct the metadata so callers cannot accidentally pass content to a sink.
    const metadata: ContentAccessRequest = Object.freeze({
      orgId: request.orgId,
      actorId: request.actorId,
      requestId: request.requestId,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      ...(request.itemTypeId === undefined
        ? {}
        : { itemTypeId: request.itemTypeId }),
      ...(request.submissionId === undefined
        ? {}
        : { submissionId: request.submissionId }),
      field: request.field,
    });
    const { authorize, record } = this.extension;
    const allowed =
      authorize === undefined ||
      (await this.invoke('authorize', metadata, async (signal) =>
        authorize(metadata, signal),
      )) === true;
    if (record) {
      const event: ContentAccessEvent = Object.freeze({
        ...metadata,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        outcome: allowed ? 'authorized' : 'denied',
      });
      await this.invoke('record', metadata, async (signal) =>
        record(event, signal),
      );
    }
    if (!allowed) throw new ContentAccessError('denied');
  }
}
