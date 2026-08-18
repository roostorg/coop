import { sql } from 'kysely';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import makeDummyMrtJobPayload from '../../../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import {
  type JobId,
  type ManualReviewJob,
} from '../manualReviewToolService.js';

describe('DecisionAnalytics', () => {
  const testWithDecisions = () =>
    makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org } = await createOrg(
        {
          KyselyPg: deps.KyselyPg,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const { user } = await createUser(deps.KyselyPg, org.id);
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
        input: { page: 0 },
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
    'pages a real cursor across the id-cast boundary without erroring',
    async ({ org, mrtService, insertDecision }) => {
      const ids = await Promise.all([
        insertDecision(minutesAfterBase(0)),
        insertDecision(minutesAfterBase(1)),
        insertDecision(minutesAfterBase(2)),
      ]);

      const firstPage = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: { page: 0 },
        limit: 2,
      });
      expect(firstPage.map((d) => d.id)).toEqual([ids[2], ids[1]]);

      const last = firstPage[firstPage.length - 1];
      // The cursor's `id` is a real uuid pulled from a previous row, exactly
      // as a real caller would pass it. If the `::uuid` cast on the cursor
      // predicate were missing or wrong, this call raises
      // `22P02 invalid input syntax for type uuid` instead of returning.
      const secondPage = await mrtService.getDecisionsForActivityFeed({
        userPermissions: [],
        orgId: org.id,
        input: { page: 0 },
        cursor: { ts: last.createdAt, id: last.id },
        limit: 2,
      });
      expect(secondPage.map((d) => d.id)).toEqual([ids[0]]);
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
        input: { page: 0 },
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
