import { sql } from 'kysely';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import makeDummyMrtJobPayload from '../../../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../../utils/encoding.js';
import {
  type JobId,
  type ManualReviewJob,
} from '../manualReviewToolService.js';

describe('DecisionAnalytics', () => {
  const testWithDecisions = () =>
    makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org } = await createOrg(
        {
          PrismaPg: deps.PrismaPg,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const { user } = await createUser(deps.PrismaPg, org.id);
      const { queue } = await createMrtQueue({
        orgId: org.id,
        mrtService: deps.ManualReviewToolService,
        userId: user.id,
      });

      // `manual_review_decisions.created_at` is `GeneratedAlways` in the
      // Kysely schema (DB default now()), so a typed `.values()` insert
      // can't set it. `insertDecision` inserts the row, then overwrites
      // `created_at` with a raw update so tests can control ordering
      // deterministically.
      const insertDecision = async (createdAt: Date) => {
        const id = uuidv1();
        const jobPayload: ManualReviewJob = {
          ...makeDummyMrtJobPayload(),
          id: uuidv1() as JobId,
          orgId: org.id,
        };
        await deps.KyselyPg.insertInto(
          'manual_review_tool.manual_review_decisions',
        )
          .values({
            id,
            job_payload: jobPayload,
            queue_id: queue.id,
            reviewer_id: user.id,
            org_id: org.id,
            decision_components: [{ type: 'IGNORE' }],
            related_actions: [],
          })
          .execute();
        await sql`
          update manual_review_tool.manual_review_decisions
          set created_at = ${createdAt}
          where id = ${id}
        `.execute(deps.KyselyPg);
        return id;
      };

      return {
        org,
        user,
        queue,
        mrtService: deps.ManualReviewToolService,
        insertDecision,
      };
    });

  const baseTime = new Date('2026-01-01T00:00:00.000Z');
  const minutesAfterBase = (minutes: number) =>
    new Date(baseTime.getTime() + minutes * 60_000);

  /**
   * Pages through the entire activity feed for `orgId` via
   * `getDecisionsForActivityFeed`, following each page's last row into the
   * next cursor, and returns every decision id encountered in page order.
   */
  const collectAllPages = async (opts: {
    mrtService: Dependencies['ManualReviewToolService'];
    orgId: string;
    limit: number;
  }) => {
    const { mrtService, orgId, limit } = opts;
    let ids: string[] = [];
    let cursor: { ts: Date; id: string } | undefined;
    for (;;) {
      const page = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId,
        input: {},
        cursor,
        limit,
      });
      ids = [...ids, ...page.map((decision) => decision.id)];
      if (page.length < limit) {
        break;
      }
      const last = page[page.length - 1];
      cursor = { ts: last.createdAt, id: last.id };
    }
    return ids;
  };

  testWithDecisions()(
    'paginates using a cursor',
    async ({ org, mrtService, insertDecision }) => {
      const ids = await Promise.all([
        insertDecision(minutesAfterBase(0)),
        insertDecision(minutesAfterBase(1)),
        insertDecision(minutesAfterBase(2)),
      ]);

      const firstPage = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: {},
        limit: 2,
      });
      expect(firstPage.map((d) => d.id)).toEqual([ids[2], ids[1]]);

      const last = firstPage[firstPage.length - 1];
      const secondPage = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: {},
        cursor: { ts: last.createdAt, id: last.id },
        limit: 2,
      });
      expect(secondPage.map((d) => d.id)).toEqual([ids[0]]);
    },
  );

  testWithDecisions()(
    'a cursor without an id returns only decisions strictly before its time',
    async ({ org, mrtService, insertDecision }) => {
      const before = await insertDecision(minutesAfterBase(0));
      await insertDecision(minutesAfterBase(1));
      await insertDecision(minutesAfterBase(1));

      const page = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: {},
        cursor: { ts: minutesAfterBase(1), id: null },
        limit: 10,
      });

      expect(page.map((d) => d.id)).toEqual([before]);
    },
  );

  testWithDecisions()(
    'returns every seeded decision exactly once across pages, with no gaps',
    async ({ org, mrtService, insertDecision }) => {
      const ids = await Promise.all([
        insertDecision(minutesAfterBase(0)),
        insertDecision(minutesAfterBase(1)),
        insertDecision(minutesAfterBase(2)),
        insertDecision(minutesAfterBase(3)),
        insertDecision(minutesAfterBase(4)),
      ]);

      const collected = await collectAllPages({
        mrtService,
        orgId: org.id,
        limit: 2,
      });

      expect(collected.length).toEqual(ids.length);
      expect(new Set(collected).size).toEqual(ids.length);
      expect(new Set(collected)).toEqual(new Set(ids));
    },
  );

  testWithDecisions()(
    'neither loses nor repeats rows that share a created_at, across a page boundary that splits them',
    async ({ org, mrtService, insertDecision }) => {
      const tiedTimestamp = minutesAfterBase(5);
      const earlier = await insertDecision(minutesAfterBase(0));
      const tiedIds = await Promise.all([
        insertDecision(tiedTimestamp),
        insertDecision(tiedTimestamp),
      ]);
      const allIds = [earlier, ...tiedIds];

      // limit: 1 forces the two tied rows onto separate pages, exercising
      // the `id` tie-break leg of the `(created_at, id)` sort key.
      const collected = await collectAllPages({
        mrtService,
        orgId: org.id,
        limit: 1,
      });

      expect(collected.length).toEqual(allIds.length);
      expect(new Set(collected)).toEqual(new Set(allIds));

      const [firstTied, secondTied, last] = collected;
      expect(last).toEqual(earlier);
      expect(new Set([firstTied, secondTied])).toEqual(new Set(tiedIds));
      expect(firstTied > secondTied).toBe(true);
    },
  );

  testWithDecisions()(
    'returns the newest page in created_at DESC order when there is no cursor',
    async ({ org, mrtService, insertDecision }) => {
      const oldest = await insertDecision(minutesAfterBase(0));
      const middle = await insertDecision(minutesAfterBase(1));
      const newest = await insertDecision(minutesAfterBase(2));

      const page = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: {},
        limit: 10,
      });

      expect(page.map((d) => d.id)).toEqual([newest, middle, oldest]);
      const timestamps = page.map((d) => d.createdAt.getTime());
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    },
  );

  testWithDecisions()(
    'getRecentDecisions still returns offset-paged decisions in created_at DESC order after the extraction',
    async ({ org, mrtService, insertDecision }) => {
      const oldest = await insertDecision(minutesAfterBase(0));
      const middle = await insertDecision(minutesAfterBase(1));
      const newest = await insertDecision(minutesAfterBase(2));

      const firstPage = await mrtService.getRecentDecisions({
        userPermissions: [],
        orgId: org.id,
        input: { page: 0 },
      });
      expect(firstPage.map((d) => d.id)).toEqual([newest, middle, oldest]);

      // Offset paging: page 100 rows at a time, so page 1 is past the end of
      // a 3-row result set and must come back empty.
      const secondPage = await mrtService.getRecentDecisions({
        userPermissions: [],
        orgId: org.id,
        input: { page: 1 },
      });
      expect(secondPage).toEqual([]);
    },
  );
});

describe('DecisionAnalytics aggregations', () => {
  const day = new Date('2026-01-01T00:00:00.000Z');
  const at = (minutes: number) => new Date(day.getTime() + minutes * 60_000);
  const range = {
    startDate: new Date('2025-12-31T00:00:00.000Z'),
    endDate: new Date('2026-01-02T00:00:00.000Z'),
  };

  // Two IGNORE decisions on two different items, each on a job created at
  // `day`, decided 60 and 120 minutes later, claimed 10 minutes before the
  // decision. One skip.
  const testWithAnalytics = makeTransactionalTestWithFixture(
    async ({ deps }) => {
      const db = deps.KyselyPg;
      const { org } = await createOrg(
        {
          KyselyPg: db,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const { user } = await createUser(db, org.id);
      const { queue } = await createMrtQueue({
        orgId: org.id,
        mrtService: deps.ManualReviewToolService,
        userId: user.id,
      });

      const decisions = await Promise.all(
        [60, 120].map(async (decidedAfterMinutes) => {
          const decisionId = uuidv1();
          const job: ManualReviewJob = {
            ...makeDummyMrtJobPayload({ createdAt: day }),
            id: uuidv1() as JobId,
            orgId: org.id,
          };
          await sql`
            insert into manual_review_tool.job_creations
              (id, org_id, queue_id, item_id, item_type_id, created_at, enqueue_source_info, policy_ids)
            values (${job.id}, ${org.id}, ${queue.id}, ${job.payload.item.itemId},
              ${job.payload.item.itemTypeIdentifier.id}, ${day},
              ${jsonStringify({ kind: 'REPORT' })}::jsonb, '{}')
          `.execute(db);
          await sql`
            insert into manual_review_tool.manual_review_decisions
              (id, job_payload, queue_id, reviewer_id, org_id, created_at, assigned_at, decision_components, related_actions)
            values (${decisionId}, ${jsonStringify(job)}::jsonb, ${queue.id}, ${user.id}, ${org.id},
              ${at(decidedAfterMinutes)}, ${at(decidedAfterMinutes - 10)},
              array[${jsonStringify({ type: 'IGNORE' })}::jsonb], '{}')
          `.execute(db);
          return { decisionId, job };
        }),
      );
      await sql`
        insert into manual_review_tool.dim_mrt_decisions_materialized
        select * from manual_review_tool.dim_mrt_decisions where org_id = ${org.id}
      `.execute(db);

      const mrtService = deps.ManualReviewToolService;
      await mrtService.logSkip({
        orgId: org.id,
        queueId: queue.id,
        jobId: decisions[0].job.id,
        userId: user.id,
      });

      return { org, user, queue, decisions, mrtService };
    },
  );

  const iso = (time: unknown) => new Date(time as string).toISOString();

  testWithAnalytics(
    'getDecisionCounts buckets distinct items by day and type',
    async ({ org, mrtService }) => {
      const rows = await mrtService.getDecisionCounts({
        orgId: org.id,
        groupBy: ['type'],
        timeDivision: 'DAY',
        timeZone: 'UTC',
        filterBy: {
          ...range,
          actionIds: [],
          itemTypeIds: [],
          policyIds: [],
          queueIds: [],
          type: [],
          reviewerIds: [],
        },
      });
      expect(rows.map((r) => ({ ...r, time: iso(r.time) }))).toEqual([
        {
          time: day.toISOString(),
          count: 2,
          action_id: null,
          type: 'IGNORE',
        },
      ]);

      const filteredOut = await mrtService.getDecisionCounts({
        orgId: org.id,
        groupBy: ['type'],
        timeDivision: 'DAY',
        timeZone: 'UTC',
        filterBy: {
          ...range,
          actionIds: [],
          itemTypeIds: [],
          policyIds: [],
          queueIds: [],
          type: ['CUSTOM_ACTION'],
          reviewerIds: [],
        },
      });
      expect(filteredOut).toEqual([]);
    },
  );

  testWithAnalytics(
    'getDecisionCountsTable groups by reviewer',
    async ({ org, user, mrtService }) => {
      const rows = await mrtService.getDecisionCountsTable({
        orgId: org.id,
        groupBy: 'reviewer_id',
        timeZone: 'UTC',
        filterBy: { ...range, queueIds: [], reviewerIds: [user.id] },
      });
      expect(rows).toEqual([
        { count: 2, action_id: null, type: 'IGNORE', reviewer_id: user.id },
      ]);
    },
  );

  testWithAnalytics(
    'getResolvedJobCounts counts decisions per reviewer per day',
    async ({ org, user, queue, mrtService }) => {
      const rows = await mrtService.getResolvedJobCounts({
        orgId: org.id,
        groupBy: ['reviewer_id', 'queue_id'],
        timeDivision: 'HOUR',
        timeZone: 'UTC',
        filterBy: { ...range, queueIds: [queue.id], reviewerIds: [] },
      });
      expect(
        rows
          .map((r) => ({ ...r, time: iso(r.time) }))
          .sort((a, b) => a.time.localeCompare(b.time)),
      ).toEqual([
        {
          time: at(60).toISOString(),
          count: 1,
          queue_id: queue.id,
          reviewer_id: user.id,
        },
        {
          time: at(120).toISOString(),
          count: 1,
          queue_id: queue.id,
          reviewer_id: user.id,
        },
      ]);
    },
  );

  testWithAnalytics(
    'getJobCreationCounts groups by queue and source',
    async ({ org, queue, mrtService }) => {
      const rows = await mrtService.getJobCreationCounts({
        orgId: org.id,
        groupBy: ['queue_id', 'source'],
        timeDivision: 'DAY',
        timeZone: 'UTC',
        filterBy: {
          ...range,
          itemTypeIds: [],
          queueIds: [],
          policyIds: [],
          ruleIds: [],
          sources: ['REPORT'],
        },
      });
      expect(rows.map((r) => ({ ...r, time: iso(r.time) }))).toEqual([
        {
          time: day.toISOString(),
          count: 2,
          queue_id: queue.id,
          source: 'REPORT',
          rule_id: null,
        },
      ]);
    },
  );

  testWithAnalytics(
    'getDecisionTimeToAction and getHandleTime average in seconds',
    async ({ org, user, queue, mrtService }) => {
      const timeToAction = await mrtService.getDecisionTimeToAction({
        orgId: org.id,
        groupBy: ['queue_id'],
        filterBy: { ...range, itemTypeIds: [], queueIds: [queue.id] },
      });
      expect(timeToAction).toEqual([
        { time_to_action: 90 * 60, queue_id: queue.id },
      ]);

      const handleTime = await mrtService.getHandleTime({
        orgId: org.id,
        groupBy: ['reviewer_id'],
        filterBy: { ...range, queueIds: [], reviewerIds: [user.id] },
      });
      expect(handleTime).toEqual([
        { handle_time: 10 * 60, reviewer_id: user.id },
      ]);
    },
  );

  testWithAnalytics(
    'getSkippedJobCounts and getSkippedJobsForRecentDecisions see the skip',
    async ({ org, user, queue, decisions, mrtService }) => {
      const now = new Date();
      const counts = await mrtService.getSkippedJobCounts({
        orgId: org.id,
        groupBy: ['reviewer_id'],
        timeDivision: 'DAY',
        timeZone: 'UTC',
        filterBy: {
          startDate: new Date(now.getTime() - 86_400_000),
          endDate: new Date(now.getTime() + 86_400_000),
          queueIds: [queue.id],
          userIds: [],
        },
      });
      expect(counts).toHaveLength(1);
      expect(counts[0]).toMatchObject({ count: 1, user_id: user.id });

      const skips = await mrtService.getSkippedJobsForRecentDecisions({
        orgId: org.id,
        input: { reviewerIds: [user.id], userSearchString: user.id },
      });
      expect(skips).toEqual([
        {
          jobId: decisions[0].job.id,
          queueId: queue.id,
          userId: user.id,
          ts: expect.any(Date),
        },
      ]);
    },
  );

  testWithAnalytics(
    'getRecentDecisions applies decision-type and policy filters',
    async ({ org, decisions, mrtService }) => {
      const ignored = await mrtService.getRecentDecisions({
        userPermissions: [],
        orgId: org.id,
        input: {
          page: 0,
          decisions: [{ type: 'IGNORE', actionIds: undefined }],
        },
      });
      expect(ignored.map((d) => d.id).sort()).toEqual(
        decisions.map((d) => d.decisionId).sort(),
      );
      expect(ignored[0]).toMatchObject({
        decisions: [{ type: 'IGNORE' }],
        relatedActions: [],
        assignedAt: expect.any(Date),
        jobCreatedAt: day,
      });

      const customAction = await mrtService.getRecentDecisions({
        userPermissions: [],
        orgId: org.id,
        input: {
          page: 0,
          decisions: [{ type: 'CUSTOM_ACTION', actionIds: ['some-action'] }],
        },
      });
      expect(customAction).toEqual([]);

      // An empty policy list matches nothing, as Kysely's `or([])` did.
      const noPolicies = await mrtService.getRecentDecisions({
        userPermissions: [],
        orgId: org.id,
        input: { page: 0, policyIds: [] },
      });
      expect(noPolicies).toEqual([]);
    },
  );

  testWithAnalytics(
    'getDecidedJob and getDecidedJobFromJobId return the stored payload',
    async ({ org, user, queue, decisions, mrtService }) => {
      const [{ decisionId, job }] = decisions;
      const byId = await mrtService.getDecidedJob({
        orgId: org.id,
        id: decisionId,
      });
      expect(byId).toMatchObject({ id: job.id, orgId: org.id });

      const byJobId = await mrtService.getDecidedJobFromJobId({
        orgId: org.id,
        jobId: job.id,
        userPermissions: [],
      });
      expect(byJobId?.job).toMatchObject({ id: job.id });
      expect(byJobId?.decision).toMatchObject({
        id: decisionId,
        itemId: job.payload.item.itemId,
        itemTypeId: job.payload.item.itemTypeIdentifier.id,
        queueId: queue.id,
        reviewerId: user.id,
        jobId: job.id,
        createdAt: at(60),
      });
    },
  );
});
