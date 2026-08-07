/**
 * Abstract interfaces for the Playbook Agent framework.
 *
 * Organizations bring their own infrastructure by implementing these interfaces.
 * The framework handles orchestration, safety constraints, and audit trail.
 *
 * @license Apache-2.0
 */

import type { PlaybookResult, QueryResult } from './playbookTypes.js';

// ── LLM Adapter ─────────────────────────────────────────────────────────────

export type LLMRequest = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly outputSchema?: Record<string, unknown>;
  readonly maxTokens?: number;
  readonly temperature?: number;
};

export type LLMResponse = {
  readonly content: string;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
};

/**
 * Adapter for LLM providers.
 *
 * Implementations may use OpenAI, Anthropic, local models, etc.
 * The framework never calls the LLM directly — all calls go through this interface.
 */
export interface ILLMAdapter {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// ── Evidence Store ──────────────────────────────────────────────────────────

export type EvidenceQuery = {
  readonly catalogId: string;
  readonly version: string;
  readonly parameters: Record<string, unknown>;
};

/**
 * Adapter for executing pre-approved evidence queries.
 *
 * Implementations execute catalog-referenced queries against the org's database.
 * The agent never writes SQL — it requests evidence by catalog ID.
 */
export interface IEvidenceStore {
  executeQuery(query: EvidenceQuery): Promise<QueryResult>;
}

// ── Artifact Store ──────────────────────────────────────────────────────────

export type PlaybookArtifact = {
  readonly sessionId: string;
  readonly playbookId: string;
  readonly artifactType: 'verdict' | 'evidence' | 'query_result' | 'confidence';
  readonly data: Record<string, unknown>;
  readonly createdAt: Date;
};

/**
 * Adapter for storing investigation artifacts.
 *
 * Artifacts are insert-only for compliance — they form an immutable evidence chain
 * for law enforcement referrals and audit purposes.
 */
export interface IArtifactStore {
  store(artifact: PlaybookArtifact): Promise<void>;
  getBySessionId(sessionId: string): Promise<readonly PlaybookArtifact[]>;
}

// ── Playbook Runner Interface ───────────────────────────────────────────────

export type PlaybookRunInput = {
  readonly playbookId: string;
  readonly inputContext: Record<string, unknown>;
  readonly sessionId?: string;
};

/**
 * Core runner interface that orchestrates a playbook investigation.
 */
export interface IPlaybookRunner {
  run(input: PlaybookRunInput): Promise<PlaybookResult>;
}
