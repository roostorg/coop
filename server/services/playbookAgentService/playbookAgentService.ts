/**
 * Playbook Agent Service — Coop integration layer.
 *
 * Wraps the generic PlaybookRunner in Coop's service conventions:
 *   - BottleJS dependency injection
 *   - Graceful failure (never blocks the MRT enqueue path)
 *   - Coop-specific type mappings
 *
 * This service is called from JobEnrichment.enrichJobPayload() to run
 * a playbook investigation before a job is written to the MRT queue.
 *
 * @license Apache-2.0
 */

import type {
  IArtifactStore,
  IEvidenceStore,
  ILLMAdapter,
  PlaybookRunInput,
} from './interfaces.js';
import PlaybookRunner from './playbookRunner.js';
import type { Playbook, PlaybookResult } from './playbookTypes.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type PlaybookAgentServiceDeps = {
  readonly llmAdapter: ILLMAdapter;
  readonly evidenceStore: IEvidenceStore;
  readonly artifactStore: IArtifactStore;
  readonly playbooks: ReadonlyMap<string, Playbook>;
  readonly queuePlaybookMapping: ReadonlyMap<string, string>;
};

export type RunForJobInput = {
  readonly orgId: string;
  readonly queueId: string;
  readonly itemId: string;
  readonly itemTypeId: string;
  readonly itemData: Record<string, unknown>;
};

// ── Service ─────────────────────────────────────────────────────────────────

export class PlaybookAgentService {
  readonly #runner: PlaybookRunner;
  readonly #queuePlaybookMapping: ReadonlyMap<string, string>;

  constructor(deps: PlaybookAgentServiceDeps) {
    this.#runner = new PlaybookRunner(
      {
        llmAdapter: deps.llmAdapter,
        evidenceStore: deps.evidenceStore,
        artifactStore: deps.artifactStore,
      },
      deps.playbooks,
    );
    this.#queuePlaybookMapping = deps.queuePlaybookMapping;
  }

  /**
   * Run a playbook investigation for an MRT job, if the queue has one configured.
   *
   * Returns the PlaybookResult, or undefined if:
   *   - The queue has no playbook configured
   *   - The playbook run fails (failure is caught — never blocks enqueue)
   */
  async runForJob(input: RunForJobInput): Promise<PlaybookResult | undefined> {
    const playbookId = this.#queuePlaybookMapping.get(input.queueId);
    if (!playbookId) {
      return undefined;
    }

    const runInput: PlaybookRunInput = {
      playbookId,
      inputContext: {
        org_id: input.orgId,
        item_id: input.itemId,
        item_type_id: input.itemTypeId,
        ...input.itemData,
      },
    };

    try {
      return await this.#runner.run(runInput);
    } catch {
      return undefined;
    }
  }

  /**
   * Check whether a queue has a playbook configured.
   */
  hasPlaybookForQueue(queueId: string): boolean {
    return this.#queuePlaybookMapping.has(queueId);
  }
}

// ── Factory (BottleJS-compatible) ───────────────────────────────────────────

export default function makePlaybookAgentService(
  deps: PlaybookAgentServiceDeps,
): PlaybookAgentService {
  return new PlaybookAgentService(deps);
}
