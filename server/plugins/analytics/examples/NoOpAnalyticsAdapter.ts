import type {
  IAnalyticsAdapter,
} from '../IAnalyticsAdapter.js';
import type {
  AnalyticsEventInput,
  AnalyticsQueryResult,
  AnalyticsWriteOptions,
} from '../types.js';

/**
 * No-op adapter useful for tests or environments where analytics are disabled.
 */
export class NoOpAnalyticsAdapter implements IAnalyticsAdapter {
  readonly name = 'noop-analytics';

  async writeEvents(
    _table: string,
    _events: readonly AnalyticsEventInput[],
    _options?: AnalyticsWriteOptions,
  ): Promise<void> {
    // Intentionally empty.
  }

  async query<T = AnalyticsQueryResult>(
    _sql: string,
    _params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    return [];
  }

  async flush(): Promise<void> {
    // Nothing buffered.
  }

  async close(): Promise<void> {
    // Nothing to tear down.
  }

  supportsCDC(): boolean {
    return false;
  }
}
