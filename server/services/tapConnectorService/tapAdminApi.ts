/**
 * HTTP client for Tap's admin/management API endpoints.
 * Used for managing tracked repos and fetching stats.
 */

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
  private readonly baseUrl: string;
  private readonly adminPassword: string;

  constructor(baseUrl: string, adminPassword: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.adminPassword = adminPassword;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.adminPassword) {
      headers['Authorization'] = `Bearer ${this.adminPassword}`;
    }
    return headers;
  }

  async addRepos(dids: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/repos/add`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ dids }),
    });
    if (!response.ok) {
      throw new Error(
        `Tap addRepos failed: ${response.status} ${await response.text()}`,
      );
    }
  }

  async removeRepos(dids: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/repos/remove`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ dids }),
    });
    if (!response.ok) {
      throw new Error(
        `Tap removeRepos failed: ${response.status} ${await response.text()}`,
      );
    }
  }

  async getRepoInfo(did: string): Promise<TapRepoInfo> {
    const response = await fetch(`${this.baseUrl}/info/${did}`, {
      headers: this.headers,
    });
    if (!response.ok) {
      if (response.status === 404) {
        return { did, isTracked: false };
      }
      throw new Error(
        `Tap getRepoInfo failed: ${response.status} ${await response.text()}`,
      );
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      did,
      handle: data.handle as string | undefined,
      recordCount: data.recordCount as number | undefined,
      isTracked: true,
    };
  }

  async getStats(): Promise<TapStats> {
    const response = await fetch(`${this.baseUrl}/stats`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Tap getStats failed: ${response.status} ${await response.text()}`,
      );
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      repoCount: (data.repoCount as number) ?? 0,
      recordCount: (data.recordCount as number) ?? 0,
      outboxBuffer: (data.outboxBuffer as number) ?? 0,
      isConnected: (data.isConnected as boolean) ?? false,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
