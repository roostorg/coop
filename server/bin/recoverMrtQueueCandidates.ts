/* eslint-disable no-console */

import { type Kysely } from 'kysely';
import { validate as isUuid } from 'uuid';

import {
  jobIdToGuid,
  type JobId,
} from '../services/manualReviewToolService/index.js';
import type { RecoveryCandidate, RecoveryPg } from './recoverMrtQueueLib.js';

const PAGE_SIZE = 1000;
const DECISION_CHUNK = 500;

function safeJobIdToGuid(jobId: JobId): string | null {
  const guid = jobIdToGuid(jobId);
  return isUuid(guid) ? guid : null;
}

export async function loadRecoveryCandidates(
  pgQuery: Kysely<RecoveryPg>,
  lookbackDays: number,
) {
  const byKey = new Map<string, RecoveryCandidate>();
  const checkedGuids = new Set<string>();
  const decidedGuids = new Set<string>();
  let totalRowsLoaded = 0;
  let cursorCreatedAt: Date | null = null;
  let cursorId: JobId | null = null;

  while (true) {
    let q = pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select([
        'id',
        'org_id',
        'queue_id',
        'item_id',
        'item_type_id',
        'created_at',
        'policy_ids',
      ])
      .where(
        'created_at',
        '>=',
        new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
      );

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
    totalRowsLoaded = totalRowsLoaded + page.length;

    const newOrUpdatedJobIds: JobId[] = [];

    for (const row of page) {
      const key = `${row.org_id}\x00${row.queue_id}\x00${row.item_type_id}\x00${row.item_id}`;
      const existing = byKey.get(key);
      if (
        existing == null ||
        new Date(row.created_at).getTime() > existing.latestCreatedAt.getTime()
      ) {
        byKey.set(key, {
          orgId: row.org_id,
          queueId: row.queue_id,
          itemId: row.item_id,
          itemTypeId: row.item_type_id,
          latestJobId: row.id,
          latestCreatedAt: new Date(row.created_at),
          policyIds: row.policy_ids,
        });
        newOrUpdatedJobIds.push(row.id);
      }
    }

    const last = page[page.length - 1];
    cursorCreatedAt = new Date(last.created_at);
    cursorId = last.id;

    const newGuids: string[] = [];
    for (const jobId of newOrUpdatedJobIds) {
      const guid = safeJobIdToGuid(jobId);
      if (guid == null) {
        console.warn(`Skipping malformed recovery job id: ${jobId}`);
        continue;
      }
      if (!checkedGuids.has(guid)) {
        checkedGuids.add(guid);
        newGuids.push(guid);
      }
    }

    for (let i = 0; i < newGuids.length; i += DECISION_CHUNK) {
      const chunk = newGuids.slice(i, i + DECISION_CHUNK);
      const decisionRows = await pgQuery
        .selectFrom('manual_review_tool.manual_review_decisions')
        .select(['id'])
        .where('id', 'in', chunk)
        .execute();
      for (const r of decisionRows) decidedGuids.add(r.id);
    }

    if (page.length < PAGE_SIZE) break;
  }

  console.log(
    `Loaded ${totalRowsLoaded} job_creations rows across paginated reads`,
  );
  console.log(`Deduplicated to ${byKey.size} distinct items`);

  return Array.from(byKey.values()).filter((c) => {
    const guid = safeJobIdToGuid(c.latestJobId);
    return guid != null && !decidedGuids.has(guid);
  });
}
