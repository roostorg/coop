import { randomUUID } from 'node:crypto';

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
  // An additional restriction, not a replacement for Coop's authorization.
  authorize?: (request: ContentAccessRequest) => Promise<boolean>;
  record?: (event: ContentAccessEvent) => Promise<void>;
}>;

let registeredExtension: ContentAccessExtension | undefined;

export function registerContentAccessExtension(
  extension: ContentAccessExtension,
) {
  const previous = registeredExtension;
  registeredExtension = extension;
  return () => {
    if (registeredExtension === extension) registeredExtension = previous;
  };
}

export function getRegisteredContentAccessExtension() {
  return registeredExtension;
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

  constructor(extension: ContentAccessExtension = {}) {
    this.extension = Object.freeze({ ...extension });
  }

  async beforeAccess(request: ContentAccessRequest): Promise<void> {
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
    let allowed: boolean;
    try {
      allowed =
        this.extension.authorize === undefined ||
        (await this.extension.authorize(metadata)) === true;
      await this.extension.record?.(
        Object.freeze({
          ...metadata,
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          outcome: allowed ? 'authorized' : 'denied',
        }),
      );
    } catch {
      // Do not expose callback errors, which can contain credentials or content.
      throw new ContentAccessError('unavailable');
    }
    if (!allowed) throw new ContentAccessError('denied');
  }
}
