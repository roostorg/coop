/**
 * WebSocket client for consuming events from Tap's /channel endpoint.
 * Handles reconnection with exponential backoff.
 */

import WebSocket from 'ws';

import { type TapEvent } from './types.js';

export type TapClientOptions = {
  tapUrl: string;
  onEvents: (events: TapEvent[]) => Promise<void>;
  onError?: (error: Error) => void;
  batchSize?: number;
  batchIntervalMs?: number;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
};

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 2;

export class TapClient {
  private ws: WebSocket | null = null;
  private readonly tapUrl: string;
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

  constructor(options: TapClientOptions) {
    this.tapUrl = options.tapUrl.replace(/\/$/, '');
    this.onEvents = options.onEvents;
    this.onError = options.onError ?? (() => {});
    this.batchSize = options.batchSize ?? 100;
    this.batchIntervalMs = options.batchIntervalMs ?? 1000;
    this.logger = options.logger ?? {
      info: console.log.bind(console),
      error: console.error.bind(console),
    };
  }

  connect(): void {
    if (this.shutdownRequested) return;

    const channelUrl = `${this.tapUrl.replace(/^http/, 'ws')}/channel`;
    this.logger.info(`[TapClient] Connecting to ${channelUrl}`);

    this.ws = new WebSocket(channelUrl);

    this.ws.on('open', () => {
      this.logger.info('[TapClient] Connected — waiting for events from tracked repos');
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString();
        const event = JSON.parse(text) as TapEvent;
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
        `[TapClient] Connection closed: ${code} ${reason.toString()}`,
      );
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      this.logger.error('[TapClient] WebSocket error:', err.message);
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
        this.logger.error('[TapClient] Batch processing error:', err);
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.shutdownRequested) return;

    this.logger.info(
      `[TapClient] Reconnecting in ${this.reconnectDelay}ms`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * RECONNECT_BACKOFF_FACTOR,
        MAX_RECONNECT_DELAY_MS,
      );
      this.connect();
    }, this.reconnectDelay);
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
