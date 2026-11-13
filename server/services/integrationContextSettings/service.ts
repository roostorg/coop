import type { SignalContextNeeds } from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { getIntegrationRegistry } from '../integrationRegistry/index.js';

// Rule evaluation reads this on every condition; a short TTL keeps that off
// Postgres. Saves on this instance invalidate immediately; other instances
// converge within the TTL.
const STATE_TTL_MS = 30_000;

type OrgIntegrationState = Readonly<{ configured: boolean }>;

class IntegrationContextSettingsService {
  // Only derived state is cached, never the stored config (it holds API keys).
  readonly #cache = new Map<
    string,
    { state: Promise<OrgIntegrationState>; expiresAt: number }
  >();

  constructor(
    private readonly signalAuthService: Dependencies['SignalAuthService'],
  ) {}

  async #getState(
    orgId: string,
    integrationId: string,
  ): Promise<OrgIntegrationState> {
    const key = `${orgId}:${integrationId}`;
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.state;
    const state = this.signalAuthService
      .getByIntegrationId(integrationId, orgId)
      .then((config) => ({ configured: config != null }));
    this.#cache.set(key, { state, expiresAt: Date.now() + STATE_TTL_MS });
    state.catch(() => {
      if (this.#cache.get(key)?.state === state) this.#cache.delete(key);
    });
    return state;
  }

  invalidate(orgId: string, integrationId: string) {
    this.#cache.delete(`${orgId}:${integrationId}`);
  }

  /**
   * The context to load for a signal. Nothing is loaded for an integration
   * the org hasn't configured, since its signals can't run.
   */
  async getEffectiveContextNeeds(opts: {
    orgId: string;
    signal: Readonly<{
      integration: string | null;
      contextNeeds?: SignalContextNeeds;
    }>;
  }): Promise<SignalContextNeeds | undefined> {
    const { orgId, signal } = opts;
    if (signal.integration == null || signal.contextNeeds == null) {
      return signal.contextNeeds;
    }
    const manifest = getIntegrationRegistry().getManifest(signal.integration);
    const { configured } = await this.#getState(orgId, signal.integration);
    if (!configured && manifest?.requiresConfig !== false) return undefined;
    return signal.contextNeeds;
  }
}

export default inject(['SignalAuthService'], IntegrationContextSettingsService);
export { IntegrationContextSettingsService };
