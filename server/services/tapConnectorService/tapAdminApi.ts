/**
 * Admin surface for the atproto connector. Jetstream has no HTTP admin API,
 * so these methods operate on the in-worker JetstreamClient: "repos" map to
 * the client's wantedDids filter and "stats" come from in-worker counters.
 * All methods are safe no-ops when no client is attached.
 */

import { type JetstreamClient } from './jetstreamClient.js';

export interface TapStats {
  repoCount: number;
  recordCount: number;
  outboxBuffer: number;
  isConnected: boolean;
}

export interface TapRepoInfo {
  did: string;
  handle?: string;
  recordCount?: number;
  isTracked: boolean;
}

export class TapAdminApi {
  private readonly client: JetstreamClient | null;

  constructor(client: JetstreamClient | null) {
    this.client = client;
  }

  async addRepos(dids: string[]): Promise<void> {
    this.client?.addDids(dids);
  }

  async removeRepos(dids: string[]): Promise<void> {
    this.client?.removeDids(dids);
  }

  async getRepoInfo(did: string): Promise<TapRepoInfo> {
    const isTracked = this.client?.wantedDids.includes(did) ?? false;
    return { did, isTracked };
  }

  async getStats(): Promise<TapStats> {
    return {
      repoCount: this.client?.wantedDids.length ?? 0,
      recordCount: this.client?.recordCount ?? 0,
      outboxBuffer: this.client?.bufferSize ?? 0,
      isConnected: this.client?.isConnected ?? false,
    };
  }

  async checkHealth(): Promise<boolean> {
    return this.client?.isConnected ?? false;
  }
}
