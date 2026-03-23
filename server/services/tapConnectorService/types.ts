/**
 * Type definitions for events received from the Tap firehose adapter.
 * See: https://docs.bsky.app/blog/introducing-tap
 */

export interface TapRecordEvent {
  id: number;
  type: 'record';
  record: {
    live: boolean;
    rev: string;
    did: string;
    collection: string;
    rkey: string;
    action: 'create' | 'update' | 'delete';
    cid: string;
    record: Record<string, unknown>;
  };
}

export interface TapIdentityEvent {
  id: number;
  type: 'identity';
  identity: {
    did: string;
    handle: string;
    isActive: boolean;
    status: string;
  };
}

export type TapEvent = TapRecordEvent | TapIdentityEvent;

/** Shape of an AT Protocol post record (app.bsky.feed.post). */
export interface ATProtoPostRecord {
  $type: 'app.bsky.feed.post';
  text: string;
  createdAt: string;
  langs?: string[];
  reply?: {
    parent: { uri: string; cid: string };
    root: { uri: string; cid: string };
  };
  embed?: {
    $type: string;
    images?: Array<{
      alt: string;
      image: { ref: { $link: string }; mimeType: string; size: number };
    }>;
  };
}

/** Shape of an AT Protocol profile record (app.bsky.actor.profile). */
export interface ATProtoProfileRecord {
  $type: 'app.bsky.actor.profile';
  displayName?: string;
  description?: string;
  avatar?: { ref: { $link: string }; mimeType: string; size: number };
  banner?: { ref: { $link: string }; mimeType: string; size: number };
  createdAt?: string;
}

export interface TapConnectorConfig {
  tapUrl: string;
  tapAdminPassword: string;
  batchSize: number;
  batchIntervalMs: number;
  orgId: string;
  apiKey: string;
}
