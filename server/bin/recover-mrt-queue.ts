#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Re-enqueues items into a Manual Review Tool queue after Redis loss.
 *
 * Pending MRT job payloads only live in Redis (BullMQ); when a queue is
 * obliterated the items disappear from the moderator's queue. We rebuild
 * each job from:
 *   - `manual_review_tool.job_creations` (Postgres) -- the list of items
 *     ever enqueued and their policy ids
 *   - `REPORTING_SERVICE.REPORTS` (warehouse) -- the rebuilt reportHistory
 *   - `ItemInvestigationService.getItemByIdentifier` -- the item body,
 *     which cascades Scylla -> Partial Items endpoint -> warehouse
 *
 * Dry-run by default. Pass `--apply` to actually enqueue. Re-enqueueing is
 * idempotent: BullMQ dedups by (itemTypeId, itemId) per queue, and items
 * with an existing row in `manual_review_decisions` are filtered out.
 *
 * Mode (`default` vs `ncmec`) is auto-detected from whether --queueId
 * matches `ncmec_org_settings.default_ncmec_queue_id`. Pass --mode only to
 * override (rare).
 *
 * Usage:
 *   npm run recover-mrt-queue -- \
 *     --orgId "<orgId>" \
 *     --queueId "<queueId>" \
 *     [--mode default|ncmec] \
 *     [--since "2026-04-15T00:00:00Z"] \
 *     [--limit 5000] \
 *     [--apply] \
 *     [--no-report-history]
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import {
  jobIdToGuid,
  type JobId,
  type ReportHistory,
} from '../services/manualReviewToolService/index.js';
import { jsonStringify } from '../utils/encoding.js';
import {
  isRecoveryMode,
  itemKey,
  loadReportHistories,
  RECOVERY_MODES,
  runEnqueueWorkers,
  type Candidate,
  type RecoveryMode,
} from './recoverMrtQueueLib.js';

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_LIMIT = 10000;
const ENQUEUE_CONCURRENCY = 10;

const argv = await yargs(hideBin(process.argv))
  .strict()
  .options({
    orgId: {
      type: 'string',
      demandOption: true,
      description: 'Organization id whose queue is being recovered',
    },
    queueId: {
      type: 'string',
      demandOption: true,
      description: 'MRT queue id to recover into (must exist)',
    },
    mode: {
      type: 'string',
      choices: RECOVERY_MODES,
      description:
        'Job kind to re-enqueue. Defaults to auto-detect: "ncmec" if --queueId matches the org\'s default_ncmec_queue_id, otherwise "default". Pass explicitly to override (rare).',
    },
    since: {
      type: 'string',
      description: `ISO timestamp; only consider job_creations rows after this. Default: ${DEFAULT_LOOKBACK_DAYS} days ago.`,
    },
    limit: {
      type: 'number',
      default: DEFAULT_LIMIT,
      description: 'Maximum number of items to attempt to recover',
    },
    apply: {
      type: 'boolean',
      default: false,
      description:
        'Actually call enqueue. Without this flag the script is a dry-run.',
    },
    'no-report-history': {
      type: 'boolean',
      default: false,
      description:
        'Skip rebuilding reportHistory from the data warehouse (useful if the warehouse is unavailable or the job kind is not report-driven).',
    },
  })
  .help()
  .parse();

// Fail fast on obviously bad ids before issuing DB queries. SQL safety
// itself comes from Kysely parameterization, not this check.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
function assertIdShape(name: string, value: string) {
  if (!ID_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${name}: ${jsonStringify(value)}. Expected 1-64 chars of [A-Za-z0-9_-].`,
    );
  }
}

assertIdShape('orgId', argv.orgId);
assertIdShape('queueId', argv.queueId);

if (!Number.isInteger(argv.limit) || argv.limit <= 0 || argv.limit > 100_000) {
  throw new Error(
    `--limit must be a positive integer <= 100000, got ${argv.limit}`,
  );
}

const since = (() => {
  if (argv.since == null) {
    return new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(argv.since);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--since must be a valid ISO timestamp, got ${argv.since}`);
  }
  return parsed;
})();

function banner(label: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(label);
  console.log('═'.repeat(60));
}

type ResolvedMode = {
  mode: RecoveryMode;
  detectedMode: RecoveryMode;
  defaultNcmecQueueId: string | null;
  modeSource: string;
};

async function resolveMode(
  container: Awaited<ReturnType<typeof getBottle>>['container'],
): Promise<ResolvedMode> {
  const ncmecSettings = await container.NcmecService.getNcmecOrgSettings(
    argv.orgId,
  );
  const defaultNcmecQueueId = ncmecSettings?.defaultNcmecQueueId ?? null;
  const detectedMode: RecoveryMode =
    defaultNcmecQueueId != null && defaultNcmecQueueId === argv.queueId
      ? 'ncmec'
      : 'default';
  const explicitMode = isRecoveryMode(argv.mode) ? argv.mode : undefined;
  const mode: RecoveryMode = explicitMode ?? detectedMode;
  const modeSource =
    explicitMode != null
      ? `operator override (auto-detect would have been "${detectedMode}")`
      : 'auto-detected';
  return { mode, detectedMode, defaultNcmecQueueId, modeSource };
}

async function loadCandidates(
  container: Awaited<ReturnType<typeof getBottle>>['container'],
): Promise<Candidate[]> {
  banner('Loading candidates from manual_review_tool.job_creations');

  // Page newest-first, dedupe by (item_type_id, item_id), and check decisions
  // per page so we stop on undecided count not distinct count, which could
  // be all-decided.
  const PAGE_SIZE = 1000;
  // Chunked to stay under Postgres's 65,535 bind-parameter cap.
  const DECISION_CHUNK = 500;
  const byItem = new Map<string, Candidate>();
  const checkedGuids = new Set<string>();
  const decidedGuids = new Set<string>();
  let totalRowsLoaded = 0;
  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;

  const countUndecided = () => {
    let n = 0;
    for (const c of byItem.values()) {
      if (!decidedGuids.has(jobIdToGuid(c.latestJobId))) n++;
    }
    return n;
  };

  while (true) {
    let q = container.KyselyPg.selectFrom('manual_review_tool.job_creations')
      .select(['id', 'item_id', 'item_type_id', 'created_at', 'policy_ids'])
      .where('org_id', '=', argv.orgId)
      .where('queue_id', '=', argv.queueId)
      .where('created_at', '>=', since);

    if (cursorCreatedAt != null && cursorId != null) {
      const cAt = cursorCreatedAt;
      const cId = cursorId;
      q = q.where((eb) =>
        eb.or([
          eb('created_at', '<', cAt),
          eb.and([eb('created_at', '=', cAt), eb('id', '<', cId)]),
        ]),
      );
    }

    const page = await q
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE_SIZE)
      .execute();

    if (page.length === 0) break;
    totalRowsLoaded += page.length;

    for (const row of page) {
      const key = `${row.item_type_id}\x00${row.item_id}`;
      const existing = byItem.get(key);
      if (
        existing == null ||
        new Date(row.created_at).getTime() > existing.latestCreatedAt.getTime()
      ) {
        byItem.set(key, {
          itemId: row.item_id,
          itemTypeId: row.item_type_id,
          latestJobId: row.id as JobId,
          latestCreatedAt: new Date(row.created_at),
          policyIds: row.policy_ids ?? [],
        });
      }
    }

    const last = page[page.length - 1];
    cursorCreatedAt = new Date(last.created_at);
    cursorId = last.id;

    // Resolve decisions for any guids we haven't checked yet, chunked to
    // stay under Postgres's 65,535 bind-parameter ceiling.
    const newGuids: string[] = [];
    for (const c of byItem.values()) {
      const guid = jobIdToGuid(c.latestJobId);
      if (!checkedGuids.has(guid)) {
        checkedGuids.add(guid);
        newGuids.push(guid);
      }
    }
    for (let i = 0; i < newGuids.length; i += DECISION_CHUNK) {
      const chunk = newGuids.slice(i, i + DECISION_CHUNK);
      const decisionRows = await container.KyselyPg.selectFrom(
        'manual_review_tool.manual_review_decisions',
      )
        .select(['id'])
        .where('org_id', '=', argv.orgId)
        .where('id', 'in', chunk)
        .execute();
      for (const r of decisionRows) decidedGuids.add(r.id);
    }

    if (countUndecided() >= argv.limit) break;
    if (page.length < PAGE_SIZE) break;
  }

  console.log(
    `Loaded ${totalRowsLoaded} job_creations rows across paginated reads`,
  );
  console.log(`Deduplicated to ${byItem.size} distinct items`);

  if (byItem.size === 0) return [];

  const candidates = Array.from(byItem.values())
    .filter((c) => !decidedGuids.has(jobIdToGuid(c.latestJobId)))
    .slice(0, argv.limit);
  console.log(
    `Filtered out ${decidedGuids.size} items that already have a decision (latest enqueue).`,
  );
  console.log(`Candidates to recover: ${candidates.length}`);
  return candidates;
}

async function maybeRebuildHistories(
  container: Awaited<ReturnType<typeof getBottle>>['container'],
  candidates: readonly Candidate[],
  mode: RecoveryMode,
): Promise<Map<string, ReportHistory>> {
  const out = new Map<string, ReportHistory>();
  if (argv['no-report-history'] || mode !== 'default') return out;

  banner('Rebuilding reportHistory from REPORTING_SERVICE.REPORTS');
  try {
    await loadReportHistories(container, argv.orgId, candidates, out);
    const withHistory = Array.from(out.values()).filter(
      (h) => h.length > 0,
    ).length;
    console.log(
      `Rebuilt history for ${withHistory}/${candidates.length} items`,
    );
  } catch (e: unknown) {
    console.warn(
      '\nWARNING: failed to rebuild reportHistory from data warehouse, continuing without it:',
      e instanceof Error ? e.message : e,
    );
  }
  return out;
}

function printSample(
  candidates: readonly Candidate[],
  reportHistoryByItem: Map<string, ReportHistory>,
) {
  banner('Sample of candidates (first 20)');
  for (const c of candidates.slice(0, 20)) {
    const histCount = reportHistoryByItem.get(itemKey(c))?.length ?? 0;
    console.log(
      `  type=${c.itemTypeId}  item=${c.itemId}  enqueuedAt=${c.latestCreatedAt.toISOString()}  policies=${c.policyIds.length}  history=${histCount}`,
    );
  }
  if (candidates.length > 20) {
    console.log(`  ... and ${candidates.length - 20} more`);
  }
}

async function main() {
  const bottle = await getBottle();
  const container = bottle.container;

  try {
    // Bypassing permissioning is safe here: back-office script run by an
    // operator on their own infra. Org ownership is still validated.
    const queue =
      await container.ManualReviewToolService.getQueueForOrgAndDangerouslyBypassPermissioning(
        { orgId: argv.orgId, queueId: argv.queueId },
      );
    if (queue == null) {
      console.error(
        `\nQueue ${argv.queueId} not found for org ${argv.orgId}. Aborting.`,
      );
      process.exit(2);
    }

    const { mode, defaultNcmecQueueId, modeSource } =
      await resolveMode(container);

    banner('Recovery configuration');
    console.log(`Org id:          ${argv.orgId}`);
    console.log(`Queue id:        ${argv.queueId}`);
    console.log(`Queue name:      ${queue.name}`);
    console.log(`Mode:            ${mode}  (${modeSource})`);
    console.log(`Since:           ${since.toISOString()}`);
    console.log(`Limit:           ${argv.limit}`);
    console.log(
      `Mutating?        ${argv.apply ? 'YES (--apply)' : 'no (dry run)'}`,
    );
    console.log(`Rebuild history? ${argv['no-report-history'] ? 'no' : 'yes'}`);

    const pendingNow =
      await container.ManualReviewToolService.getPendingJobCount({
        orgId: argv.orgId,
        queueId: argv.queueId,
      });
    console.log(`Pending now:     ${pendingNow}`);
    if (pendingNow > 0) {
      console.warn(
        '\nWARNING: queue is not empty. Recovery is still safe (BullMQ dedupes per item) but you may end up re-fetching item data unnecessarily. Consider stopping here unless you intentionally want to top-up.',
      );
    }

    // NcmecService always routes to the org's `default_ncmec_queue_id`. If
    // --mode ncmec was forced onto a different queue, items would silently
    // land in the wrong place, so refuse up front.
    if (mode === 'ncmec') {
      if (defaultNcmecQueueId == null) {
        console.error(
          `\nOrg ${argv.orgId} has no default_ncmec_queue_id configured. NCMEC recovery cannot route items. Aborting.`,
        );
        process.exit(2);
      }
      if (defaultNcmecQueueId !== argv.queueId) {
        console.error(
          `\n--queueId (${argv.queueId}) does not match this org's default NCMEC queue (${defaultNcmecQueueId}). NcmecService always routes to the configured default queue, so recovery would land items in the wrong place. Re-run with --queueId ${defaultNcmecQueueId}, or update ncmec_org_settings first.`,
        );
        process.exit(2);
      }
    }

    const candidates = await loadCandidates(container);
    if (candidates.length === 0) {
      console.log('Nothing to recover. Exiting.');
      await container.closeSharedResourcesForShutdown();
      process.exit(0);
    }

    const reportHistoryByItem = await maybeRebuildHistories(
      container,
      candidates,
      mode,
    );
    printSample(candidates, reportHistoryByItem);

    if (!argv.apply) {
      banner('Dry run -- no changes made');
      console.log(
        `Re-run with --apply to actually re-enqueue ${candidates.length} items.`,
      );
      await container.closeSharedResourcesForShutdown();
      process.exit(0);
    }

    // Concurrency-bounded so we don't hammer item-data sources or BullMQ.
    banner('Re-enqueueing items');
    const stats = await runEnqueueWorkers(
      container,
      argv.orgId,
      argv.queueId,
      candidates,
      mode,
      reportHistoryByItem,
      ENQUEUE_CONCURRENCY,
    );

    banner('Done');
    console.log(`Enqueued: ${stats.enqueued}`);
    console.log(`Skipped:  ${stats.skipped}`);
    console.log(`Failed:   ${stats.failed}`);

    await container.closeSharedResourcesForShutdown();
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error: unknown) {
    console.error('\nError running recovery script:\n');
    console.error(error);
    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
