/**
 * Polling helpers for integration tests.
 *
 * Item submission is async (POST returns 202, worker processes off Redis,
 * writes to Scylla and ClickHouse), so tests poll the data stores until the
 * row appears or a timeout elapses.
 */
import { type ItemIdentifier } from '@roostorg/types';

import { type Dependencies } from '../../iocContainer/index.js';

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

export async function waitForItemInScylla(
  deps: Pick<Dependencies, 'ItemInvestigationService'>,
  opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
) {
  return waitFor(
    `item ${opts.itemIdentifier.id} in Scylla`,
    async () =>
      deps.ItemInvestigationService.getItemByIdentifier({
        orgId: opts.orgId,
        itemIdentifier: opts.itemIdentifier,
      }),
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
          WHERE org_id = {orgId:String}
            AND item_id = {itemId:String}
            AND item_type_id = {itemTypeId:String}
          LIMIT 1`,
        deps.Tracer,
        [
          { name: 'orgId', value: orgId },
          { name: 'itemId', value: itemIdentifier.id },
          { name: 'itemTypeId', value: itemIdentifier.typeId },
        ],
      );
      return rows.length > 0 ? rows[0] : null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}
