/**
 * WebSocket client for consuming events from Tap's /channel endpoint.
 * Handles reconnection with exponential backoff and ack support.
 */

import WebSocket from 'ws';

import { type TapEvent } from './types.js';

export type TapClientOptions = {
  tapUrl: string;
  onEvent: (event: TapEvent) => void;
  onError?: (error: Error) => void;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
};

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 2;

export class TapClient {
  private ws: WebSocket | null = null;
  private readonly tapUrl: string;
  private readonly onEvent: (event: TapEvent) => void;
  private readonly onError: (error: Error) => void;
  private readonly logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastAckedId: number | null = null;
  private shutdownRequested = false;

  constructor(options: TapClientOptions) {
    this.tapUrl = options.tapUrl.replace(/\/$/, '');
    this.onEvent = options.onEvent;
    this.onError = options.onError ?? (() => {});
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
      this.logger.info('[TapClient] Connected');
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString();
        const event = JSON.parse(text) as TapEvent;
        this.onEvent(event);
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

  /**
   * Send an acknowledgement for the last processed event ID.
   * This tells Tap not to replay events up to this ID.
   */
  ack(eventId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.lastAckedId = eventId;
      this.ws.send(JSON.stringify({ type: 'ack', id: eventId }));
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
