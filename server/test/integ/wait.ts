/**
 * Polling helpers for integration tests.
 *
 * Item submission is async (POST returns 202, worker processes off Redis,
 * writes to Scylla and ClickHouse), so tests poll the data stores until the
 * row appears or a timeout elapses.
 */
import { type ItemIdentifier } from '@roostorg/coop-types';

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

/**
 * Polls `analytics.ACTION_EXECUTIONS` for a row where the given action fired on
 * the given item submission. Returned by RuleEngine when a rule's conditions
 * match and the rule has actions attached; the row is written via
 * ActionPublisher after the worker finishes processing the submission.
 *
 * Tests use this to assert "the rule fired for this item" without coupling to
 * the rule's internals — we only care that the resulting action execution
 * landed in the warehouse.
 */
type ActionExecutionRow = {
  action_id: string;
  item_id: string | null;
  item_type_id: string | null;
  rules: string;
};

export async function waitForActionExecution(
  deps: Pick<Dependencies, 'DataWarehouse' | 'Tracer'>,
  opts: {
    orgId: string;
    actionId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
): Promise<ActionExecutionRow> {
  const { orgId, actionId, itemIdentifier } = opts;
  return waitFor(
    `action ${actionId} execution for item ${itemIdentifier.id} in ClickHouse ACTION_EXECUTIONS`,
    async () => {
      const rows = (await deps.DataWarehouse.query(
        `SELECT action_id, item_id, item_type_id, rules
           FROM analytics.ACTION_EXECUTIONS
          WHERE org_id = ?
            AND action_id = ?
            AND item_id = ?
            AND item_type_id = ?
          LIMIT 1`,
        deps.Tracer,
        [orgId, actionId, itemIdentifier.id, itemIdentifier.typeId],
      )) as readonly ActionExecutionRow[];
      return rows.length > 0 ? rows[0] : null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}

/**
 * Asserts the *absence* of an action execution. Proving a negative requires
 * waiting long enough that the worker would have written a row if it were
 * going to — but a fixed sleep races against rule evaluation latency.
 *
 * Instead we gate on `analytics.CONTENT_API_REQUESTS`, which `ItemProcessingWorker`
 * writes *after* `ruleEngine.runEnabledRules` returns (see the worker around
 * Scylla → rules → contentApiLogger). Once that row is visible, the rule path
 * for this submission has fully run; if no `ACTION_EXECUTIONS` row exists at
 * that point, none will.
 *
 * Both writes go through `analytics.bulkWrite` with the same default
 * batchTimeout, so seeing CONTENT_API_REQUESTS implies that batch interval
 * has elapsed — long enough for an ACTION_EXECUTIONS batch from the same
 * submission to have flushed.
 */
export async function assertNoActionExecution(
  deps: Pick<Dependencies, 'DataWarehouse' | 'Tracer'>,
  opts: {
    orgId: string;
    actionId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
) {
  const { orgId, actionId, itemIdentifier, timeoutMs } = opts;
  await waitForItemInClickHouse(deps, { orgId, itemIdentifier, timeoutMs });
  const rows = await deps.DataWarehouse.query(
    `SELECT action_id, item_id
       FROM analytics.ACTION_EXECUTIONS
      WHERE org_id = ?
        AND action_id = ?
        AND item_id = ?
        AND item_type_id = ?
      LIMIT 1`,
    deps.Tracer,
    [orgId, actionId, itemIdentifier.id, itemIdentifier.typeId],
  );
  if (rows.length > 0) {
    throw new Error(
      `Expected no action execution for action ${actionId} on item ${itemIdentifier.id}, but found one in ACTION_EXECUTIONS`,
    );
  }
}

export type ReportingServiceReportRow = {
  request_id: string;
  reported_item_id: string;
  reported_item_type_id: string;
  reporter_kind: string;
};

/**
 * Poll `REPORTING_SERVICE.REPORTS` for a row matching a reported item.
 *
 * `submitReport` writes via `dataWarehouseAnalytics.bulkWrite`, which may
 * batch before the row is queryable, so we poll rather than reading once.
 */
export async function waitForReportInClickHouse(
  deps: Pick<Dependencies, 'DataWarehouse' | 'Tracer'>,
  opts: {
    orgId: string;
    reportedItemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
): Promise<ReportingServiceReportRow> {
  const { orgId, reportedItemIdentifier } = opts;
  return waitFor(
    `report for item ${reportedItemIdentifier.id} in REPORTING_SERVICE.REPORTS`,
    async () => {
      const rows = await deps.DataWarehouse.query(
        `SELECT request_id, reported_item_id, reported_item_type_id, reporter_kind
           FROM REPORTING_SERVICE.REPORTS
          WHERE org_id = ?
            AND reported_item_id = ?
            AND reported_item_type_id = ?
          LIMIT 1`,
        deps.Tracer,
        [orgId, reportedItemIdentifier.id, reportedItemIdentifier.typeId],
      );
      return rows.length > 0 ? (rows[0] as ReportingServiceReportRow) : null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}

/**
 * Poll `manual_review_tool.job_creations` for a row.
 *
 * The MRT enqueue path inserts here after the BullMQ `addJob` returns, so a
 * report POST returning 201 doesn't guarantee the row is visible yet.
 *
 * Matches on `(org_id, item_id, item_type_id)` — the differentiator for the
 * NCMEC enqueue path vs the standard report path is exactly which item lands
 * here (the content vs the content creator), so callers should pass the item
 * they expect to see.
 */
export async function waitForJobCreationInPostgres(
  deps: Pick<Dependencies, 'KyselyPg'>,
  opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    timeoutMs?: number;
  },
) {
  const { orgId, itemIdentifier } = opts;
  return waitFor(
    `job_creations row for item ${itemIdentifier.id}`,
    async () => {
      const row = await deps.KyselyPg.selectFrom(
        'manual_review_tool.job_creations',
      )
        .select([
          'id',
          'org_id',
          'item_id',
          'item_type_id',
          'queue_id',
          'enqueue_source_info',
        ])
        .where('org_id', '=', orgId)
        .where('item_id', '=', itemIdentifier.id)
        .where('item_type_id', '=', itemIdentifier.typeId)
        .limit(1)
        .executeTakeFirst();
      return row ?? null;
    },
    { timeoutMs: opts.timeoutMs },
  );
}
