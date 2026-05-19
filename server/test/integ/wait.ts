/**
 * Polling helpers for integration tests.
 *
 * Item submission is async (POST returns 202, worker processes off Redis,
 * writes to Scylla and ClickHouse), so tests poll the data stores until the
 * row appears or a timeout elapses.
 */
import { type ItemIdentifier } from '@roostorg/types';

import { type Dependencies } from '../../iocContainer/index.js';
import { itemIdentifierToScyllaItemIdentifier } from '../../scylla/index.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 250;

export async function waitFor<T>(
  what: string,
  check: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await check();
    if (result != null) return result;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${what}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Query Scylla directly rather than going through ItemInvestigationService:
 * that service falls back to the partial-items endpoint and the data warehouse
 * if Scylla returns nothing, which would mask a real Scylla write failure as a
 * passing test.
 *
 * Filtering by `item_identifier` alone matches the production lookup path
 * (`ItemInvestigationService.getItemByIdentifier`), which leans on the
 * secondary index on `item_identifier`. The table's partition key is
 * `(org_id, synthetic_thread_id)`, so a partial-partition-key restriction
 * (`org_id = ?` without `synthetic_thread_id`) would need `ALLOW FILTERING`.
 * Callers should still assert on `org_id` after the row comes back to guard
 * against the theoretical cross-org collision.
 *
 * Query errors are intentionally NOT swallowed — a structural Scylla error
 * (bad query, schema drift) should surface immediately instead of polling
 * itself into a misleading timeout.
 */
export async function waitForItemInScylla(
  deps: Pick<Dependencies, 'Scylla'>,
  opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
) {
  return waitFor(
    `item ${opts.itemIdentifier.id} in Scylla item_submission_by_thread`,
    async () => {
      const rows = await deps.Scylla.select({
        from: 'item_submission_by_thread',
        select: '*',
        where: [
          [
            'item_identifier',
            '=',
            itemIdentifierToScyllaItemIdentifier(opts.itemIdentifier),
          ],
        ],
      });
      return rows.length > 0 ? rows[0] : null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}

export async function waitForItemInClickHouse(
  deps: Pick<Dependencies, 'DataWarehouse' | 'Tracer'>,
  opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
) {
  const { orgId, itemIdentifier } = opts;
  return waitFor(
    `item ${itemIdentifier.id} in ClickHouse CONTENT_API_REQUESTS`,
    async () => {
      const rows = await deps.DataWarehouse.query(
        `SELECT item_id, item_type_id, event
           FROM analytics.CONTENT_API_REQUESTS
          WHERE org_id = ?
            AND item_id = ?
            AND item_type_id = ?
          LIMIT 1`,
        deps.Tracer,
        [orgId, itemIdentifier.id, itemIdentifier.typeId],
      );
      return rows.length > 0 ? rows[0] : null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}
