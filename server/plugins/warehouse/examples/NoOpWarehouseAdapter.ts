import type { IWarehouseAdapter } from '../IWarehouseAdapter.js';
import type {
  WarehouseQueryResult,
  WarehouseTransactionFn,
} from '../types.js';

export class NoOpWarehouseAdapter implements IWarehouseAdapter {
  readonly name = 'noop-warehouse';

  async query<T = WarehouseQueryResult>(
    _sql: string,
    _params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    return [];
  }

  async transaction<T>(fn: WarehouseTransactionFn<T>): Promise<T> {
    // Execute the callback with the no-op query function.
    return fn(this.query.bind(this));
  }

  async flush(): Promise<void> {
    // No buffers maintained.
  }

  async close(): Promise<void> {
    // No external resources.
  }
}
