/**
 * WebSocket client for consuming events from the public Bluesky Jetstream.
 * Maps Jetstream messages to the internal TapEvent shape so downstream
 * ingestion logic is unchanged. Handles reconnection with exponential backoff.
 */

import WebSocket from 'ws';

import { type TapEvent } from './types.js';

export type JetstreamClientOptions = {
  jetstreamUrl: string;
  wantedDids?: string[];
  wantedCollections?: string[];
  onEvents: (events: TapEvent[]) => Promise<void>;
  onError?: (error: Error) => void;
  batchSize?: number;
  batchIntervalMs?: number;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
};

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 2;

/** Shape of a Jetstream commit message. */
interface JetstreamCommitMessage {
  did: string;
  time_us: number;
  kind: 'commit';
  commit: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

/** Shape of a Jetstream identity message. */
interface JetstreamIdentityMessage {
  did: string;
  time_us: number;
  kind: 'identity';
  identity: {
    did: string;
    handle?: string;
    seq: number;
    time: string;
  };
}

/** Shape of a Jetstream account message. */
interface JetstreamAccountMessage {
  did: string;
  time_us: number;
  kind: 'account';
  account: {
    active: boolean;
    did: string;
    seq: number;
    time: string;
  };
}

type JetstreamMessage =
  | JetstreamCommitMessage
  | JetstreamIdentityMessage
  | JetstreamAccountMessage;

export class JetstreamClient {
  private ws: WebSocket | null = null;
  private readonly jetstreamUrl: string;
  private readonly wantedCollections?: string[];
  private readonly wantedDidSet: Set<string>;
  private readonly onEvents: (events: TapEvent[]) => Promise<void>;
  private readonly onError: (error: Error) => void;
  private readonly logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  private readonly batchSize: number;
  private readonly batchIntervalMs: number;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shutdownRequested = false;
  private buffer: TapEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private recordCounter = 0;

  constructor(options: JetstreamClientOptions) {
    this.jetstreamUrl = options.jetstreamUrl;
    this.wantedCollections = options.wantedCollections;
    this.wantedDidSet = new Set(options.wantedDids ?? []);
    this.onEvents = options.onEvents;
    this.onError = options.onError ?? (() => {});
    this.batchSize = options.batchSize ?? 100;
    this.batchIntervalMs = options.batchIntervalMs ?? 1000;
    this.logger = options.logger ?? {
      info: console.log.bind(console),
      error: console.error.bind(console),
    };
  }

  private buildUrl(): string {
    let url = this.jetstreamUrl;
    for (const collection of this.wantedCollections ?? []) {
      url += `${url.includes('?') ? '&' : '?'}wantedCollections=${encodeURIComponent(collection)}`;
    }
    for (const did of this.wantedDidSet) {
      url += `${url.includes('?') ? '&' : '?'}wantedDids=${encodeURIComponent(did)}`;
    }
    return url;
  }

  connect(): void {
    if (this.shutdownRequested) return;

    const url = this.buildUrl();
    this.logger.info(`[JetstreamClient] Connecting to ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.logger.info('[JetstreamClient] Connected — waiting for events');
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString();
        const message = JSON.parse(text) as JetstreamMessage;
        const event = mapJetstreamMessage(message);
        if (!event) return;

        this.recordCounter++;
        this.buffer.push(event);

        if (this.buffer.length >= this.batchSize) {
          this.flush();
        } else if (!this.flushTimer) {
          this.flushTimer = setTimeout(
            () => this.flush(),
            this.batchIntervalMs,
          );
        }
      } catch (err) {
        this.onError(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.info(
        `[JetstreamClient] Connection closed: ${code} ${reason.toString()}`,
      );
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      this.logger.error('[JetstreamClient] WebSocket error:', err.message);
      this.onError(err);
    });
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.buffer;
    this.buffer = [];

    if (batch.length > 0) {
      this.onEvents(batch).catch((err) => {
        this.logger.error('[JetstreamClient] Batch processing error:', err);
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.shutdownRequested) return;

    this.logger.info(
      `[JetstreamClient] Reconnecting in ${this.reconnectDelay}ms`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * RECONNECT_BACKOFF_FACTOR,
        MAX_RECONNECT_DELAY_MS,
      );
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Immediately reconnect with the current filters, e.g. after the tracked
   * DID list changes. Tears down the existing socket without triggering the
   * backoff reconnect scheduled by the 'close' handler.
   */
  private restart(): void {
    if (this.shutdownRequested) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners('close');
      this.ws.close();
      this.ws = null;
    }

    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.connect();
  }

  /** DIDs the connection is currently filtered to (empty = all). */
  get wantedDids(): string[] {
    return Array.from(this.wantedDidSet);
  }

  /** Number of mapped events received since startup. */
  get recordCount(): number {
    return this.recordCounter;
  }

  /** Number of events buffered awaiting the next flush. */
  get bufferSize(): number {
    return this.buffer.length;
  }

  /** Append DIDs to the tracked filter and reconnect to apply them. */
  addDids(dids: string[]): void {
    let changed = false;
    for (const did of dids) {
      if (!this.wantedDidSet.has(did)) {
        this.wantedDidSet.add(did);
        changed = true;
      }
    }
    if (changed) this.restart();
  }

  /** Remove DIDs from the tracked filter and reconnect to apply the change. */
  removeDids(dids: string[]): void {
    let changed = false;
    for (const did of dids) {
      if (this.wantedDidSet.delete(did)) {
        changed = true;
      }
    }
    if (changed) this.restart();
  }

  async close(): Promise<void> {
    this.shutdownRequested = true;

    // Flush remaining
    this.flush();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Maps a raw Jetstream message to the internal TapEvent shape. Returns null
 * for messages we don't handle.
 */
function mapJetstreamMessage(message: JetstreamMessage): TapEvent | null {
  if (message.kind === 'commit') {
    const { commit } = message;
    return {
      id: message.time_us,
      type: 'record',
      record: {
        live: true,
        rev: commit.rev,
        did: message.did,
        collection: commit.collection,
        rkey: commit.rkey,
        action: commit.operation,
        cid: commit.cid ?? '',
        record: commit.record ?? {},
      },
    };
  }

  if (message.kind === 'identity') {
    return {
      id: message.time_us,
      type: 'identity',
      identity: {
        did: message.identity.did,
        handle: message.identity.handle ?? '',
        isActive: true,
        status: '',
      },
    };
  }

  if (message.kind === 'account') {
    return {
      id: message.time_us,
      type: 'identity',
      identity: {
        did: message.account.did,
        handle: '',
        isActive: message.account.active,
        status: '',
      },
    };
  }

  return null;
}
